/** @jest-environment node */

jest.mock('../database/firebase', () => require('../test-utils/fake-firebase').createFirebaseMock());
jest.mock('../services/soa-data.service', () => ({
  getPortalSnapshotForUser: jest.fn().mockResolvedValue({ normalizedData: {} }),
  buildAttendanceRouteData: jest.fn(() => ({ records: [], summary: [], source: 'none' })),
  buildMarksRouteData: jest.fn(() => ({ marks: [], summary: [], cgpa: null, semesterResults: [] }))
}));

const firebase = require('../database/firebase');
const guard = require('../services/session-guard.service');
const cacheService = require('../services/cache.service');
const router = require('../routes/marks.routes');
const { startHarness } = require('../test-utils/route-harness');
const { tokenFor, USERS } = require('../test-utils/fixtures');

describe('marks routes', () => {
  let api;
  let teacherToken;
  let studentToken;

  beforeAll(() => {
    api = startHarness('/api/marks', router);
    teacherToken = tokenFor(USERS.teacher);
    studentToken = tokenFor(USERS.student);
  });

  afterAll(() => api.close());

  beforeEach(async () => {
    firebase.__reset();
    guard.clearLiveUserCache();
    await cacheService.flush().catch(() => {});
    Object.values(USERS).forEach((user) => firebase.__seed('users', user.id, user));
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => jest.restoreAllMocks());

  const upload = (overrides = {}, token = teacherToken) => api.post('/api/marks/upload', {
    student_id: 'STU1', subject: 'Maths', exam_type: 'Midterm',
    marks_obtained: 42, total_marks: 50, exam_date: '2025-02-10', ...overrides
  }, { token });

  const rows = () => firebase.__all('marks');
  const auditEntries = (action) => firebase.__all('activity_log').filter((entry) => entry.action === action);

  describe('POST /upload', () => {
    test('stores the mark with the student\'s class and writes an audit entry', async () => {
      const res = await upload();

      expect(res.status).toBe(200);
      expect(rows()[0]).toMatchObject({
        student_id: 'STU1', subject: 'Maths', marks_obtained: 42, total_marks: 50,
        exam_date: '2025-02-10', department: 'CSE', year: 3, uploaded_by: 'TCH1'
      });
      expect(auditEntries('marks_upload')).toHaveLength(1);
      expect(firebase.__all('notifications').filter((item) => item.user_id === 'STU1')).toHaveLength(1);
    });

    test.each([
      [{ marks_obtained: 51 }, /marks_obtained/],
      [{ marks_obtained: -1 }, /marks_obtained/],
      [{ marks_obtained: 4.25 }, /one decimal/],
      [{ total_marks: 0 }, /total_marks/],
      [{ total_marks: 10.5 }, /total_marks/],
      [{ exam_date: 'garbage' }, /exam_date/],
      [{ exam_date: '2999-01-01' }, /future/],
      [{ subject: '' }, /required/]
    ])('rejects invalid input %j', async (overrides, message) => {
      const res = await upload(overrides);
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(message);
      expect(rows()).toHaveLength(0);
    });

    test('accepts a single decimal place', async () => {
      expect((await upload({ marks_obtained: 41.5 })).status).toBe(200);
    });

    test('a duplicate for the same exam day is a 409', async () => {
      await upload();
      expect((await upload()).status).toBe(409);
    });

    test('unknown or non-student ids are 404, malformed ids 400', async () => {
      expect((await upload({ student_id: 'GHOST' })).status).toBe(404);
      expect((await upload({ student_id: 'TCH1' })).status).toBe(404);
      expect((await upload({ student_id: 'a/b' })).status).toBe(400);
    });

    test('defaults exam_date to today when omitted', async () => {
      const res = await api.post('/api/marks/upload', {
        student_id: 'STU1',
        subject: 'Physics',
        exam_type: 'Midterm',
        marks_obtained: 40,
        total_marks: 50
      }, { token: teacherToken });
      expect(res.status).toBe(200);
      expect(rows().find(r => r.subject === 'Physics').exam_date).toBe(new Date().toISOString().slice(0, 10));
    });

    test('students cannot upload marks', async () => {
      expect((await upload({}, studentToken)).status).toBe(403);
    });
  });

  describe('POST /upload-bulk', () => {
    test('uploads marks for multiple students in a single batch', async () => {
      const res = await api.post('/api/marks/upload-bulk', {
        subject: 'Maths',
        exam_type: 'Quiz 1',
        total_marks: 25,
        exam_date: '2025-02-15',
        records: [
          { student_id: 'STU1', marks_obtained: 22 },
          { student_id: 'STU2', marks_obtained: 19 }
        ]
      }, { token: teacherToken });

      expect(res.status).toBe(200);
      expect(res.body.data.marked).toBe(2);
      expect(res.body.data.rejected).toHaveLength(0);
      expect(auditEntries('marks_upload_bulk')).toHaveLength(1);
      expect(rows().filter(r => r.exam_type === 'Quiz 1')).toHaveLength(2);
    });

    test('reports rejected entries without failing the valid entries', async () => {
      const res = await api.post('/api/marks/upload-bulk', {
        subject: 'Chemistry',
        exam_type: 'Quiz 1',
        total_marks: 20,
        records: [
          { student_id: 'STU1', marks_obtained: 18 },
          { student_id: 'STU1', marks_obtained: 99 }, // exceeds total_marks
          { student_id: 'NON_EXISTENT', marks_obtained: 15 }
        ]
      }, { token: teacherToken });

      expect(res.status).toBe(200);
      expect(res.body.data.marked).toBe(1);
      expect(res.body.data.rejected).toHaveLength(2);
    });

    test('validates required fields', async () => {
      const res = await api.post('/api/marks/upload-bulk', {
        subject: '',
        exam_type: 'Quiz',
        total_marks: 20,
        records: [{ student_id: 'STU1', marks_obtained: 10 }]
      }, { token: teacherToken });
      expect(res.status).toBe(400);
    });

    test('students cannot call bulk upload', async () => {
      const res = await api.post('/api/marks/upload-bulk', {
        subject: 'Maths',
        exam_type: 'Quiz',
        total_marks: 20,
        records: [{ student_id: 'STU1', marks_obtained: 10 }]
      }, { token: studentToken });
      expect(res.status).toBe(403);
    });
  });

  describe('PUT /:id (correct a mark)', () => {
    let id;

    beforeEach(async () => {
      await upload();
      id = rows()[0].id;
    });

    test('updates the value, audits before/after, and tells the student', async () => {
      const res = await api.put(`/api/marks/${id}`, { marks_obtained: 45 }, { token: teacherToken });

      expect(res.status).toBe(200);
      expect(firebase.__read('marks', id)).toMatchObject({ marks_obtained: 45, total_marks: 50, updated_by: 'TCH1' });

      const [entry] = auditEntries('marks_update');
      expect(entry.metadata.before.marks_obtained).toBe(42);
      expect(entry.metadata.after.marks_obtained).toBe(45);
      expect(firebase.__all('notifications').some((item) => item.title === 'Marks Corrected')).toBe(true);
    });

    test('the corrected value is what the student sees next (cache invalidated)', async () => {
      const before = await api.get('/api/marks/student/STU1', { token: studentToken });
      expect(before.body.data.marks[0].marks_obtained).toBe(42);

      await api.put(`/api/marks/${id}`, { marks_obtained: 48 }, { token: teacherToken });

      const after = await api.get('/api/marks/student/STU1', { token: studentToken });
      expect(after.body.data.marks[0].marks_obtained).toBe(48);
    });

    test('cannot exceed the (possibly new) total', async () => {
      expect((await api.put(`/api/marks/${id}`, { marks_obtained: 60 }, { token: teacherToken })).status).toBe(400);
      expect((await api.put(`/api/marks/${id}`, { total_marks: 30 }, { token: teacherToken })).status).toBe(400);
      expect((await api.put(`/api/marks/${id}`, { total_marks: 60, marks_obtained: 55 }, { token: teacherToken })).status).toBe(200);
    });

    test('cannot move onto another record\'s exam day', async () => {
      await upload({ exam_date: '2025-03-01' });
      const res = await api.put(`/api/marks/${id}`, { exam_date: '2025-03-01' }, { token: teacherToken });
      expect(res.status).toBe(409);
    });

    test('404 for a missing record, 403 for students', async () => {
      expect((await api.put('/api/marks/nope', { marks_obtained: 1 }, { token: teacherToken })).status).toBe(404);
      expect((await api.put(`/api/marks/${id}`, { marks_obtained: 1 }, { token: studentToken })).status).toBe(403);
    });
  });

  describe('DELETE /:id', () => {
    test('removes the mark, keeps a copy in the audit log, and refreshes the student view', async () => {
      await upload();
      const id = rows()[0].id;
      await api.get('/api/marks/student/STU1', { token: studentToken }); // warm cache

      const res = await api.delete(`/api/marks/${id}`, { token: teacherToken });

      expect(res.status).toBe(200);
      expect(rows()).toHaveLength(0);
      expect(auditEntries('marks_delete')[0].metadata.removed).toMatchObject({ marks_obtained: 42 });

      const after = await api.get('/api/marks/student/STU1', { token: studentToken });
      expect(after.body.data.marks).toHaveLength(0);
    });

    test('students cannot delete', async () => {
      await upload();
      expect((await api.delete(`/api/marks/${rows()[0].id}`, { token: studentToken })).status).toBe(403);
    });
  });

  describe('GET /summary', () => {
    test('class averages use only classmates in the same subjects, not every mark in the system', async () => {
      await upload({ marks_obtained: 40 });
      // classmate in the same subject and department
      firebase.__seed('marks', 'm-peer', { student_id: 'STU2', subject: 'Maths', exam_type: 'Midterm', marks_obtained: 20, total_marks: 50, exam_date: '2025-02-10', department: 'CSE' });
      // unrelated subject and another department: must not be read at all
      firebase.__seed('marks', 'm-other-subject', { student_id: 'STU2', subject: 'Art', exam_type: 'Midterm', marks_obtained: 1, total_marks: 50, department: 'CSE' });
      firebase.__seed('marks', 'm-other-dept', { student_id: 'STU9', subject: 'Maths', exam_type: 'Midterm', marks_obtained: 1, total_marks: 50, department: 'ECE' });
      firebase.__stats.documentsRead = 0;

      const res = await api.get('/api/marks/summary', { token: studentToken });

      expect(res.status).toBe(200);
      expect(res.body.data.trendData[0].classAverage).toBe(30); // (40 + 20) / 2
      expect(res.body.data.classAverage).toEqual([{ subject: 'Maths', marks: 60 }]);
      expect(firebase.__stats.documentsRead).toBeLessThanOrEqual(4); // own mark + peers in Maths/CSE
    });
  });

  describe('GET /student/:id', () => {
    test('students only see their own marks; malformed ids are rejected', async () => {
      expect((await api.get('/api/marks/student/STU2', { token: studentToken })).status).toBe(403);
      expect((await api.get('/api/marks/student/a%2Fb', { token: teacherToken })).status).toBe(400);
    });
  });
});
