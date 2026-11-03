/** @jest-environment node */

jest.mock('../database/firebase', () => require('../test-utils/fake-firebase').createFirebaseMock());

const bcrypt = require('bcrypt');
const firebase = require('../database/firebase');
const guard = require('../services/session-guard.service');
const router = require('../routes/admin.routes');
const userRouter = require('../routes/user.routes');
const { startHarness } = require('../test-utils/route-harness');
const { tokenFor, USERS } = require('../test-utils/fixtures');

describe('admin routes', () => {
  let api;
  let admin;
  let student;

  beforeAll(() => {
    api = startHarness('/api/admin', router, { extraRoutes: [{ path: '/api/users', router: userRouter }] });
    admin = tokenFor(USERS.admin);
    student = tokenFor(USERS.student);
  });

  afterAll(() => api.close());

  beforeEach(() => {
    firebase.__reset();
    guard.clearLiveUserCache();
    Object.values(USERS).forEach((user, index) => firebase.__seed('users', user.id, {
      ...user, created_at: `2025-01-0${index + 1}T00:00:00.000Z`, password: 'hash'
    }));
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => jest.restoreAllMocks());

  const audit = (action) => firebase.__all('activity_log').filter((entry) => entry.action === action);

  test('every admin route is closed to non-admins', async () => {
    expect((await api.get('/api/admin/users', { token: student })).status).toBe(403);
    expect((await api.get('/api/admin/stats', { token: student })).status).toBe(403);
    expect((await api.get('/api/admin/activity-log', { token: student })).status).toBe(403);
    expect((await api.get('/api/admin/users')).status).toBe(401);
  });

  describe('GET /users', () => {
    beforeEach(() => {
      for (let index = 0; index < 12; index += 1) {
        firebase.__seed('users', `X${index}`, {
          id: `X${index}`, name: `Extra ${index}`, registration_number: `X${index}`, email: `x${index}@iter.edu`,
          role: 'student', department: index % 2 ? 'ECE' : 'CSE', is_active: index !== 3, created_at: `2025-02-${String(index + 1).padStart(2, '0')}T00:00:00.000Z`
        });
      }
    });

    test('paginates with a real total and never exposes credentials', async () => {
      const res = await api.get('/api/admin/users?limit=5&page=2', { token: admin });

      expect(res.body.pagination).toEqual({ page: 2, limit: 5, total: 17, totalPages: 4 });
      expect(res.body.data).toHaveLength(5);
      expect(JSON.stringify(res.body)).not.toContain('hash');
    });

    test('searches name, registration number and email', async () => {
      expect((await api.get('/api/admin/users?q=extra%207', { token: admin })).body.data.map((user) => user.id)).toEqual(['X7']);
      expect((await api.get('/api/admin/users?q=X11', { token: admin })).body.data.map((user) => user.id)).toEqual(['X11']);
      expect((await api.get('/api/admin/users?q=teacher@iter', { token: admin })).body.data.map((user) => user.id)).toEqual(['TCH1']);
    });

    test('filters by role, department and status', async () => {
      const inactive = await api.get('/api/admin/users?status=inactive', { token: admin });
      expect(inactive.body.data.map((user) => user.id)).toEqual(['X3']);

      const csEngineers = await api.get('/api/admin/users?role=student&department=ECE&status=active', { token: admin });
      expect(csEngineers.body.data.every((user) => user.department === 'ECE' && user.is_active)).toBe(true);
    });

    test('rejects bad filter values and clamps absurd paging', async () => {
      expect((await api.get('/api/admin/users?role=wizard', { token: admin })).status).toBe(400);
      expect((await api.get('/api/admin/users?status=maybe', { token: admin })).status).toBe(400);
      const res = await api.get('/api/admin/users?page=-4&limit=999999', { token: admin });
      expect(res.body.pagination).toMatchObject({ page: 1, limit: 5000 });
    });

    test('exports the filtered list as CSV with spreadsheet formulas neutralised', async () => {
      firebase.__seed('users', 'EVIL', {
        id: 'EVIL', name: '=HYPERLINK("http://evil.example","click")', registration_number: 'EVIL', email: 'e@iter.edu',
        role: 'student', department: 'CSE', is_active: true, created_at: '2025-03-01T00:00:00.000Z'
      });

      const res = await api.get('/api/admin/users?format=csv&q=evil', { token: admin, raw: true });

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/text\/csv/);
      expect(res.headers['content-disposition']).toMatch(/users\.csv/);
      const lines = res.text.trim().split('\n');
      expect(lines[0]).toBe('registration_number,name,email,role,department,year,section,phone_number,status,created_at');
      expect(lines).toHaveLength(2);
      expect(lines[1]).toContain("\"'=HYPERLINK(");
      expect(audit('user_export')).toHaveLength(1);
    });
  });

  describe('creating users', () => {
    const create = (overrides = {}) => api.post('/api/admin/users', {
      name: 'New Teacher', registration_number: 'TCH900', email: 'new@iter.edu', password: 'longenough1', role: 'teacher', department: 'CSE', ...overrides
    }, { token: admin });

    test('stores a hashed password and records who did it', async () => {
      const res = await create();

      expect(res.status).toBe(201);
      const stored = firebase.__read('users', 'TCH900');
      await expect(bcrypt.compare('longenough1', stored.password)).resolves.toBe(true);
      expect(stored.is_active).toBe(true);
      expect(audit('user_create')[0]).toMatchObject({ user_id: 'ADM1', entity_id: 'TCH900' });
    });

    test('a duplicate registration number is refused atomically and does not overwrite', async () => {
      await create();
      const second = await create({ name: 'Impostor' });

      expect(second.status).toBe(409);
      expect(firebase.__read('users', 'TCH900').name).toBe('New Teacher');
    });

    test.each([
      [{ registration_number: 'a/b' }, /registration_number/],
      [{ password: 'short' }, /password/],
      [{ email: 'nope' }, /email/],
      [{ year: 12 }, /year/],
      [{ role: 'god' }, /Role/],
      [{ name: '' }, /required/]
    ])('rejects %j', async (overrides, message) => {
      const res = await create(overrides);
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(message);
    });
  });

  describe('deactivating and demoting', () => {
    test('deactivation takes effect on the very next request and survives re-activation', async () => {
      const studentToken = tokenFor(USERS.student);
      // Sanity: before deactivation the student's session works.
      expect((await api.put('/api/users/profile', { name: 'Asha S' }, { token: studentToken })).status).toBe(200);

      await new Promise((resolve) => setTimeout(resolve, 1100)); // token iat must predate the revocation
      const res = await api.patch('/api/admin/users/STU1/status', { isActive: false }, { token: admin });
      expect(res.status).toBe(200);

      const blocked = await api.put('/api/users/profile', { name: 'Still here' }, { token: studentToken });
      expect(blocked.status).toBe(403);

      // Re-activating must not resurrect the old token.
      await api.patch('/api/admin/users/STU1/status', { isActive: true }, { token: admin });
      const stillBlocked = await api.put('/api/users/profile', { name: 'Back again' }, { token: studentToken });
      expect(stillBlocked.status).toBe(401);
      expect(stillBlocked.body.code).toBe('SESSION_REVOKED');
      expect(audit('user_deactivate')).toHaveLength(1);
      expect(audit('user_activate')).toHaveLength(1);
    }, 15000);

    test('toggle-active flips the state and reports it', async () => {
      const off = await api.put('/api/admin/users/STU2/toggle-active', {}, { token: admin });
      expect(off.body.isActive).toBe(false);
      const on = await api.put('/api/admin/users/STU2/toggle-active', {}, { token: admin });
      expect(on.body.isActive).toBe(true);
    });

    test('an admin cannot deactivate themselves', async () => {
      const res = await api.patch('/api/admin/users/ADM1/status', { isActive: false }, { token: admin });
      expect(res.status).toBe(409);
      expect(firebase.__read('users', 'ADM1').is_active).toBe(true);
    });

    test('the last active administrator can be neither deactivated nor demoted', async () => {
      firebase.__seed('users', 'ADM2', { ...USERS.admin, id: 'ADM2', registration_number: 'ADM2', is_active: true });
      const secondAdmin = tokenFor({ ...USERS.admin, id: 'ADM2', registration_number: 'ADM2' });

      // Two admins: ADM2 may deactivate ADM1 ...
      expect((await api.patch('/api/admin/users/ADM1/status', { isActive: false }, { token: secondAdmin })).status).toBe(200);
      // ... but now ADM2 is the last one standing.
      const demote = await api.patch('/api/admin/users/ADM2', { role: 'teacher' }, { token: secondAdmin });
      expect(demote.status).toBe(409);
      const selfOff = await api.patch('/api/admin/users/ADM2/status', { isActive: false }, { token: secondAdmin });
      expect(selfOff.status).toBe(409);
    });

    test('a demoted admin loses admin access immediately', async () => {
      firebase.__seed('users', 'ADM2', { ...USERS.admin, id: 'ADM2', registration_number: 'ADM2' });
      const secondAdmin = tokenFor({ ...USERS.admin, id: 'ADM2', registration_number: 'ADM2' });
      expect((await api.get('/api/admin/stats', { token: secondAdmin })).status).toBe(200);

      const res = await api.patch('/api/admin/users/ADM2', { role: 'student' }, { token: admin });
      expect(res.status).toBe(200);

      expect((await api.get('/api/admin/stats', { token: secondAdmin })).status).toBe(403);
      expect(audit('user_role_change')[0].metadata).toMatchObject({ before: { role: 'admin' }, after: { role: 'student' } });
    });

    test('edits are validated and 404 for unknown users', async () => {
      expect((await api.patch('/api/admin/users/STU1', { email: 'bad' }, { token: admin })).status).toBe(400);
      expect((await api.patch('/api/admin/users/STU1', { name: '  ' }, { token: admin })).status).toBe(400);
      expect((await api.patch('/api/admin/users/STU1', { role: 'root' }, { token: admin })).status).toBe(400);
      expect((await api.patch('/api/admin/users/NOPE', { name: 'x' }, { token: admin })).status).toBe(404);
      expect((await api.patch('/api/admin/users/a%2Fb/status', { isActive: false }, { token: admin })).status).toBe(404);
      expect((await api.patch('/api/admin/users/STU1/status', { isActive: 'no' }, { token: admin })).status).toBe(400);
    });
  });

  test('POST /users/:id/revoke-sessions signs the user out everywhere', async () => {
    const studentToken = tokenFor(USERS.student);
    await new Promise((resolve) => setTimeout(resolve, 1100));

    const res = await api.post('/api/admin/users/STU1/revoke-sessions', {}, { token: admin });
    expect(res.status).toBe(200);

    const after = await api.put('/api/users/profile', { name: 'x' }, { token: studentToken });
    expect(after.status).toBe(401);
    expect(audit('user_revoke_sessions')).toHaveLength(1);
    expect((await api.post('/api/admin/users/NOPE/revoke-sessions', {}, { token: admin })).status).toBe(404);
  }, 15000);

  describe('GET /stats', () => {
    test('reports real figures — average attendance is computed, not a constant', async () => {
      ['present', 'present', 'late', 'absent'].forEach((status, index) => firebase.__seed('attendance', `a${index}`, { student_id: 'STU1', status }));
      firebase.__seed('events', 'e1', { title: 'On', is_active: true });
      firebase.__seed('events', 'e2', { title: 'Cancelled', is_active: false });
      firebase.__seed('assignments', 'as1', { title: 'x' });

      const res = await api.get('/api/admin/stats', { token: admin });

      expect(res.body.data).toMatchObject({
        totalStudents: 2, totalTeachers: 2, totalAdmins: 1, totalAssignments: 1, totalEvents: 1, avgAttendance: 75
      });
      expect(res.body.data.departments).toEqual([{ name: 'CSE', total: 4 }]);
    });

    test('with no attendance recorded the average is null rather than an invented number', async () => {
      const res = await api.get('/api/admin/stats', { token: admin });
      expect(res.body.data.avgAttendance).toBeNull();
    });
  });

  describe('GET /activity-log', () => {
    beforeEach(() => {
      const entries = [
        ['L1', 'marks_upload', 'TCH1', 'marks', '2025-03-01T10:00:00.000Z'],
        ['L2', 'marks_update', 'TCH1', 'marks', '2025-03-02T10:00:00.000Z'],
        ['L3', 'user_create', 'ADM1', 'user', '2025-03-03T10:00:00.000Z'],
        ['L4', 'marks_upload', 'TCH2', 'marks', '2025-03-04T23:30:00.000Z']
      ];
      entries.forEach(([id, action, userId, entityType, createdAt]) => firebase.__seed('activity_log', id, {
        action, user_id: userId, entity_type: entityType, created_at: createdAt, summary: `${action} summary`
      }));
    });

    test('lists newest first with the actor\'s name and paging metadata', async () => {
      const res = await api.get('/api/admin/activity-log?limit=2', { token: admin });

      expect(res.body.data.map((entry) => entry.id)).toEqual(['L4', 'L3']);
      expect(res.body.data[0].user_name).toBe('Prof Other');
      expect(res.body.pagination).toEqual({ page: 1, limit: 2, total: 4, totalPages: 2 });
    });

    test('filters by action, actor, entity and date range (a bare end date includes that whole day)', async () => {
      const ids = async (query) => (await api.get(`/api/admin/activity-log?${query}`, { token: admin })).body.data.map((entry) => entry.id).sort();

      expect(await ids('action=marks_upload')).toEqual(['L1', 'L4']);
      expect(await ids('user_id=TCH1')).toEqual(['L1', 'L2']);
      expect(await ids('entity_type=user')).toEqual(['L3']);
      expect(await ids('from=2025-03-02&to=2025-03-03')).toEqual(['L2', 'L3']);
      expect(await ids('to=2025-03-04')).toEqual(['L1', 'L2', 'L3', 'L4']); // L4 is 23:30 on the 4th
    });

    test('rejects invalid dates and can export CSV', async () => {
      expect((await api.get('/api/admin/activity-log?from=yesterday-ish', { token: admin })).status).toBe(400);

      const csv = await api.get('/api/admin/activity-log?format=csv', { token: admin, raw: true });
      expect(csv.headers['content-type']).toMatch(/text\/csv/);
      expect(csv.text.split('\n')[0]).toBe('created_at,user_name,actor_role,action,entity_type,entity_id,summary,ip');
    });
  });

  describe('password change (users router)', () => {
    beforeEach(async () => {
      firebase.__seed('users', 'STU1', { ...USERS.student, password: await bcrypt.hash('OldPassw0rd', 4) });
    });

    const change = (body, token = student) => api.put('/api/users/password', body, { token });

    test('works against the same `password` field that login uses', async () => {
      const res = await change({ currentPassword: 'OldPassw0rd', newPassword: 'NewPassw0rd!' });

      expect(res.status).toBe(200);
      const stored = firebase.__read('users', 'STU1');
      await expect(bcrypt.compare('NewPassw0rd!', stored.password)).resolves.toBe(true);
      expect(stored.sessions_revoked_at).toBeTruthy();
    });

    test('still reads hashes written by the old endpoint under `password_hash`', async () => {
      firebase.__seed('users', 'STU1', { ...USERS.student, password_hash: await bcrypt.hash('LegacyPass1', 4) });
      expect((await change({ currentPassword: 'LegacyPass1', newPassword: 'FreshPassw0rd' })).status).toBe(200);
      expect(firebase.__read('users', 'STU1').password_hash).toBeNull();
    });

    test('rejects a wrong current password, a weak new one, and an unchanged one', async () => {
      expect((await change({ currentPassword: 'wrong', newPassword: 'NewPassw0rd!' })).status).toBe(401);
      expect((await change({ currentPassword: 'OldPassw0rd', newPassword: 'short' })).status).toBe(400);
      expect((await change({ currentPassword: 'OldPassw0rd', newPassword: 'OldPassw0rd' })).status).toBe(400);
    });

    test('Google-only accounts are told so', async () => {
      firebase.__seed('users', 'STU1', { ...USERS.student });
      const res = await change({ currentPassword: 'x', newPassword: 'NewPassw0rd!' });
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Google/);
    });
  });

  describe('profile updates (users router)', () => {
    test.each([
      [{ name: '   ' }, /name/],
      [{ name: 'x'.repeat(200) }, /name/],
      [{ phone_number: 'call me' }, /phone/],
      [{ profile_picture: '//evil.example/x.png' }, /profile_picture/],
      [{ profile_picture: 'javascript:alert(1)' }, /profile_picture/],
      [{ profile_picture: 123 }, /profile_picture/],
      [{}, /No valid fields/]
    ])('rejects %j', async (body, message) => {
      const res = await api.put('/api/users/profile', body, { token: student });
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(message);
    });

    test('accepts valid partial updates and trims the name', async () => {
      const res = await api.put('/api/users/profile', { name: '  Asha K  ', phone_number: '+91 98765-43210' }, { token: student });
      expect(res.status).toBe(200);
      expect(firebase.__read('users', 'STU1')).toMatchObject({ name: 'Asha K', phone_number: '+91 98765-43210' });
    });
  });
});
