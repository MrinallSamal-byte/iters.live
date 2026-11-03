/** @jest-environment node */

jest.mock('../database/firebase', () => require('../test-utils/fake-firebase').createFirebaseMock());

const fs = require('fs');
const os = require('os');
const path = require('path');
const firebase = require('../database/firebase');
const guard = require('../services/session-guard.service');
const router = require('../routes/file.routes');
const { startHarness } = require('../test-utils/route-harness');
const { tokenFor, USERS } = require('../test-utils/fixtures');

describe('file routes', () => {
  let api;
  let tokens;
  let tmpDir;
  let diskPath;

  beforeAll(() => {
    api = startHarness('/api/files', router);
    tokens = {
      student: tokenFor(USERS.student),
      student2: tokenFor(USERS.student2),
      teacher: tokenFor(USERS.teacher),
      admin: tokenFor(USERS.admin)
    };
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'iter-files-'));
    diskPath = path.join(tmpDir, 'notes.pdf');
    fs.writeFileSync(diskPath, 'PDF-CONTENT');
  });

  afterAll(async () => {
    await api.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    firebase.__reset();
    guard.clearLiveUserCache();
    Object.values(USERS).forEach((user) => firebase.__seed('users', user.id, user));
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => jest.restoreAllMocks());

  const seedFile = (id, overrides = {}) => firebase.__seed('files', id, {
    original_name: `${id}.pdf`, stored_name: `${id}-stored.pdf`, file_path: diskPath, checksum: 'sha-secret',
    category: 'note', subject: 'Maths', file_size: 100, download_count: 0, approved: true, uploaded_by: 'TCH1',
    created_at: `2025-01-0${id.length}T00:00:00.000Z`, ...overrides
  });

  describe('GET /', () => {
    test('with no files the list is empty — no invented documents', async () => {
      const res = await api.get('/api/files', { token: tokens.student });

      expect(res.status).toBe(200);
      expect(res.body.data.files).toEqual([]);
      expect(res.body.data.pagination).toEqual({ page: 1, limit: 20, total: 0, totalPages: 1 });
    });

    test('never exposes server paths, stored names or checksums', async () => {
      seedFile('f1');
      const res = await api.get('/api/files', { token: tokens.student });
      const body = JSON.stringify(res.body);

      expect(body).not.toContain(diskPath);
      expect(body).not.toContain('sha-secret');
      expect(body).not.toContain('stored');
      expect(res.body.data.files[0]).toMatchObject({ id: 'f1', download_url: '/api/files/download/f1' });
    });

    test('paginates with a true total', async () => {
      for (let index = 1; index <= 25; index += 1) seedFile(`n${index}`, { created_at: `2025-01-01T00:00:${String(index).padStart(2, '0')}.000Z` });

      const page2 = await api.get('/api/files?limit=10&page=2', { token: tokens.student });

      expect(page2.body.data.files).toHaveLength(10);
      expect(page2.body.data.pagination).toEqual({ page: 2, limit: 10, total: 25, totalPages: 3 });
      expect(page2.body.data.files[0].id).toBe('n15'); // newest first
    });

    test('students only see approved files; staff can filter by approval', async () => {
      seedFile('ok', { approved: true });
      seedFile('pending', { approved: false });

      const asStudent = await api.get('/api/files?approved=false', { token: tokens.student });
      expect(asStudent.body.data.files.map((file) => file.id)).toEqual(['ok']);

      const pending = await api.get('/api/files?approved=false', { token: tokens.admin });
      expect(pending.body.data.files.map((file) => file.id)).toEqual(['pending']);
    });

    test('filters by category/subject and searches names and descriptions', async () => {
      seedFile('a1', { category: 'note', original_name: 'Graph theory.pdf' });
      seedFile('b1', { category: 'pyq', original_name: 'Exam 2024.pdf', description: 'includes graph questions' });
      seedFile('c1', { category: 'pyq', subject: 'Physics', original_name: 'Waves.pdf' });

      const ids = async (query) => (await api.get(`/api/files?${query}`, { token: tokens.admin })).body.data.files.map((file) => file.id).sort();
      expect(await ids('category=pyq')).toEqual(['b1', 'c1']);
      expect(await ids('category=pyq&subject=Physics')).toEqual(['c1']);
      expect(await ids('search=GRAPH')).toEqual(['a1', 'b1']);
    });

    test('a datastore failure is an error, not a screenful of fake files', async () => {
      const original = firebase.db.collection;
      firebase.db.collection = () => { throw new Error('firestore down'); };
      try {
        const res = await api.get('/api/files', { token: tokens.student });
        expect(res.status).toBe(500);
        expect(JSON.stringify(res.body)).not.toMatch(/Priya Verma|Data_Structures/);
      } finally {
        firebase.db.collection = original;
      }
    });
  });

  describe('GET /stats/overview', () => {
    test('is all zeros when there are no files', async () => {
      const res = await api.get('/api/files/stats/overview', { token: tokens.student });

      expect(res.body.data.overview).toEqual({ total_files: 0, total_size: 0, total_downloads: 0, approved_files: 0, pending_files: 0 });
      expect(res.body.data.byCategory).toEqual([]);
    });

    test('adds up the real files', async () => {
      seedFile('s1', { file_size: 100, download_count: 3, approved: true, category: 'note' });
      seedFile('s2', { file_size: 50, download_count: 1, approved: false, category: 'pyq' });

      const res = await api.get('/api/files/stats/overview', { token: tokens.student });

      expect(res.body.data.overview).toEqual({ total_files: 2, total_size: 150, total_downloads: 4, approved_files: 1, pending_files: 1 });
      expect(res.body.data.byCategory.sort((a, b) => a.category.localeCompare(b.category)))
        .toEqual([{ category: 'note', count: 1, size: 100 }, { category: 'pyq', count: 1, size: 50 }]);
    });
  });

  describe('GET /download/:id', () => {
    test('streams the file with its original name and counts the download atomically', async () => {
      seedFile('d1');

      const results = await Promise.all([
        api.get('/api/files/download/d1', { token: tokens.student, raw: true }),
        api.get('/api/files/download/d1', { token: tokens.student2, raw: true })
      ]);

      expect(results.map((res) => res.status)).toEqual([200, 200]);
      expect(results[0].text).toBe('PDF-CONTENT');
      expect(results[0].headers['content-disposition']).toContain('d1.pdf');
      expect(firebase.__read('files', 'd1').download_count).toBe(2);
    });

    test('students cannot download unapproved files, except their own', async () => {
      seedFile('u1', { approved: false, uploaded_by: 'TCH1' });
      seedFile('u2', { approved: false, uploaded_by: 'STU1' });

      expect((await api.get('/api/files/download/u1', { token: tokens.student })).status).toBe(403);
      expect((await api.get('/api/files/download/u2', { token: tokens.student, raw: true })).status).toBe(200);
      expect((await api.get('/api/files/download/u1', { token: tokens.teacher, raw: true })).status).toBe(200);
    });

    test('404 for a missing record, a malformed id, or a file gone from disk', async () => {
      seedFile('gone', { file_path: path.join(tmpDir, 'missing.pdf') });
      expect((await api.get('/api/files/download/nope', { token: tokens.student })).status).toBe(404);
      expect((await api.get('/api/files/download/a%2Fb', { token: tokens.student })).status).toBe(404);
      expect((await api.get('/api/files/download/gone', { token: tokens.student })).status).toBe(404);
    });

    test('requires authentication', async () => {
      seedFile('d2');
      expect((await api.get('/api/files/download/d2')).status).toBe(401);
    });
  });

  describe('approve and delete', () => {
    test('only an admin can approve; the uploader is told and the action audited', async () => {
      seedFile('p1', { approved: false, uploaded_by: 'STU1', status: 'pending' });

      expect((await api.post('/api/files/approve/p1', {}, { token: tokens.teacher })).status).toBe(403);
      expect((await api.post('/api/files/approve/p1', {}, { token: tokens.admin })).status).toBe(200);

      expect(firebase.__read('files', 'p1')).toMatchObject({ approved: true, status: 'approved', approved_by: 'ADM1' });
      expect(firebase.__all('notifications').some((item) => item.user_id === 'STU1' && item.title === 'File approved')).toBe(true);
      expect(firebase.__all('activity_log').some((entry) => entry.action === 'file_approve')).toBe(true);
      expect((await api.post('/api/files/approve/missing', {}, { token: tokens.admin })).status).toBe(404);
    });

    test('only the owner or an admin can delete, and the stored file is removed', async () => {
      const ownPath = path.join(tmpDir, 'own.pdf');
      fs.writeFileSync(ownPath, 'x');
      seedFile('del1', { uploaded_by: 'STU1', file_path: ownPath });

      expect((await api.delete('/api/files/del1', { token: tokens.student2 })).status).toBe(403);
      expect((await api.delete('/api/files/del1', { token: tokens.student })).status).toBe(200);

      expect(firebase.__read('files', 'del1')).toBeUndefined();
      expect(fs.existsSync(ownPath)).toBe(false);
      expect((await api.delete('/api/files/del1', { token: tokens.admin })).status).toBe(404);
    });
  });
});
