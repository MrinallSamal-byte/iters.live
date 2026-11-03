/** @jest-environment node */

jest.mock('../database/firebase', () => require('../test-utils/fake-firebase').createFirebaseMock());
jest.mock('../services/soa-data.service', () => ({
  getPortalSnapshotForUser: jest.fn().mockResolvedValue({ normalizedData: {} }),
  buildAttendanceRouteData: jest.fn(() => ({ records: [], summary: [], source: 'none' })),
  buildMarksRouteData: jest.fn(() => ({ marks: [], summary: [] }))
}));

const firebase = require('../database/firebase');
const guard = require('../services/session-guard.service');
const cacheService = require('../services/cache.service');
const router = require('../routes/attendance.routes');
const alerts = require('../services/attendance-alerts.service');
const { startHarness } = require('../test-utils/route-harness');
const { tokenFor, USERS } = require('../test-utils/fixtures');

const DAY = 24 * 60 * 60 * 1000;
const isoDay = (offsetDays) => new Date(Date.now() + offsetDays * DAY).toISOString().slice(0, 10);

describe('attendance routes', () => {
  let api;
  let teacherToken;
  let studentToken;
  let adminToken;

  beforeAll(() => {
    api = startHarness('/api/attendance', router);
    teacherToken = tokenFor(USERS.teacher);
    studentToken = tokenFor(USERS.student);
    adminToken = tokenFor(USERS.admin);
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

  const mark = (body, token = teacherToken) => api.post('/api/attendance/mark', body, { token });
  const attendanceRows = () => firebase.__all('attendance');

  describe('POST /mark validation', () => {
    const valid = () => ({ student_id: 'STU1', subject: 'Maths', date: isoDay(-1), status: 'present' });

    test('students cannot mark attendance', async () => {
      expect((await mark(valid(), studentToken)).status).toBe(403);
    });

    test('subject is required', async () => {
      const res = await mark({ ...valid(), subject: '   ' });
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/subject/);
    });

    test('rejects an unknown status', async () => {
      expect((await mark({ ...valid(), status: 'maybe' })).status).toBe(400);
    });

    test.each([['not-a-date'], ['2025-02-31'], ['']])('rejects invalid date %p', async (date) => {
      const res = await mark({ ...valid(), date });
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/date/);
    });

    test('rejects dates well in the future', async () => {
      const res = await mark({ ...valid(), date: isoDay(3) });
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/future/);
    });

    test('accepts today (users ahead of UTC may already be on the next calendar day)', async () => {
      expect((await mark({ ...valid(), date: isoDay(0) })).status).toBe(200);
    });

    test('unknown student and non-student ids are 404', async () => {
      expect((await mark({ ...valid(), student_id: 'NOPE' })).status).toBe(404);
      expect((await mark({ ...valid(), student_id: 'TCH1' })).status).toBe(404);
    });

    test('a student id that cannot be a document id is a 400, not a server error', async () => {
      expect((await mark({ ...valid(), student_id: 'a/b' })).status).toBe(400);
    });
  });

  describe('POST /mark storage', () => {
    test('stores a normalised date and the student\'s class', async () => {
      await mark({ student_id: 'STU1', subject: ' Maths ', date: `${isoDay(-1)}T09:30:00.000Z`, status: 'Present' });

      expect(attendanceRows()).toHaveLength(1);
      expect(attendanceRows()[0]).toMatchObject({
        student_id: 'STU1', subject: 'Maths', date: isoDay(-1), status: 'present',
        department: 'CSE', year: 3, section: 'A', marked_by: 'TCH1'
      });
    });

    test('marking the same day again updates instead of duplicating, even with a different time component', async () => {
      await mark({ student_id: 'STU1', subject: 'Maths', date: isoDay(-1), status: 'present' });
      await mark({ student_id: 'STU1', subject: 'Maths', date: `${isoDay(-1)}T18:00:00Z`, status: 'absent' });

      expect(attendanceRows()).toHaveLength(1);
      expect(attendanceRows()[0].status).toBe('absent');
    });
  });

  describe('POST /mark-bulk', () => {
    const bulk = (body, token = teacherToken) => api.post('/api/attendance/mark-bulk', body, { token });

    test('marks a whole class in one request and reports per-student problems', async () => {
      const res = await bulk({
        subject: 'Physics',
        date: isoDay(-1),
        records: [
          { student_id: 'STU1', status: 'present' },
          { student_id: 'STU2', status: 'absent' },
          { student_id: 'GHOST', status: 'present' },
          { student_id: 'TCH1', status: 'present' },
          { student_id: 'STU3', status: 'sleeping' }
        ]
      });

      expect(res.status).toBe(200);
      expect(res.body.data.marked).toBe(2);
      expect(res.body.data.rejected.map((item) => item.student_id).sort()).toEqual(['GHOST', 'STU3', 'TCH1']);
      expect(attendanceRows()).toHaveLength(2);
    });

    test('defaultStatus fills entries that omit a status', async () => {
      const res = await bulk({
        subject: 'Physics', date: isoDay(-1), defaultStatus: 'present',
        records: [{ student_id: 'STU1' }, { student_id: 'STU2', status: 'absent' }]
      });

      expect(res.body.data.marked).toBe(2);
      const byStudent = Object.fromEntries(attendanceRows().map((row) => [row.student_id, row.status]));
      expect(byStudent).toEqual({ STU1: 'present', STU2: 'absent' });
    });

    test('re-submitting the same session corrects rows rather than duplicating them', async () => {
      const body = { subject: 'Physics', date: isoDay(-1), records: [{ student_id: 'STU1', status: 'present' }] };
      await bulk(body);
      await bulk({ ...body, records: [{ student_id: 'STU1', status: 'late' }] });

      expect(attendanceRows()).toHaveLength(1);
      expect(attendanceRows()[0].status).toBe('late');
    });

    test('validates the session fields and the record list', async () => {
      expect((await bulk({ subject: '', date: isoDay(-1), records: [{ student_id: 'STU1', status: 'present' }] })).status).toBe(400);
      expect((await bulk({ subject: 'P', date: isoDay(5), records: [{ student_id: 'STU1', status: 'present' }] })).status).toBe(400);
      expect((await bulk({ subject: 'P', date: isoDay(-1), records: [] })).status).toBe(400);
      expect((await bulk({ subject: 'P', date: isoDay(-1), records: 'x' })).status).toBe(400);
      expect((await bulk({ subject: 'P', date: isoDay(-1), defaultStatus: 'zzz', records: [{ student_id: 'STU1' }] })).status).toBe(400);
    });

    test('caps the request size', async () => {
      const records = Array.from({ length: 301 }, (_, index) => ({ student_id: `S${index}`, status: 'present' }));
      const res = await bulk({ subject: 'P', date: isoDay(-1), records });
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/at most 300/);
    });

    test('returns 400 when nothing could be marked', async () => {
      const res = await bulk({ subject: 'P', date: isoDay(-1), records: [{ student_id: 'GHOST', status: 'present' }] });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    test('students cannot use it', async () => {
      const res = await bulk({ subject: 'P', date: isoDay(-1), records: [{ student_id: 'STU1', status: 'present' }] }, studentToken);
      expect(res.status).toBe(403);
    });
  });

  describe('low-attendance alerts', () => {
    const notificationsFor = (userId) => firebase.__all('notifications').filter((item) => item.user_id === userId);

    async function markDay(offset, status) {
      return mark({ student_id: 'STU1', subject: 'Maths', date: isoDay(offset), status });
    }

    test('notifies once, at the moment an absence takes the subject below the requirement', async () => {
      await markDay(-10, 'present');
      await markDay(-9, 'present');
      await markDay(-8, 'present');
      expect(notificationsFor('STU1')).toHaveLength(0);

      await markDay(-7, 'absent'); // 3/4 = 75% — exactly at the requirement, not below it
      expect(notificationsFor('STU1')).toHaveLength(0);

      await markDay(-6, 'absent'); // 3/5 = 60% — crossed
      expect(notificationsFor('STU1')).toHaveLength(1);
      expect(notificationsFor('STU1')[0]).toMatchObject({ type: 'attendance', metadata: expect.objectContaining({ subject: 'Maths' }) });

      await markDay(-5, 'absent'); // already below: no repeat
      expect(notificationsFor('STU1')).toHaveLength(1);
    });

    test('never alerts for a present mark', async () => {
      await markDay(-3, 'present');
      expect(notificationsFor('STU1')).toHaveLength(0);
    });

    test('crossedBelowThreshold reconstructs the state before an edit', () => {
      const rows = [
        { subject: 'M', date: '2025-01-01', status: 'present' },
        { subject: 'M', date: '2025-01-02', status: 'present' },
        { subject: 'M', date: '2025-01-03', status: 'present' },
        { subject: 'M', date: '2025-01-04', status: 'absent' } // just changed from "present"
      ];
      const result = alerts.crossedBelowThreshold(rows, { subject: 'M', date: '2025-01-04', previousStatus: 'present', threshold: 80 });
      expect(result.before).toBe(100);
      expect(result.after).toBe(75);
      expect(result.crossed).toBe(true);
    });
  });

  describe('GET /at-risk', () => {
    beforeEach(async () => {
      // STU1: Maths 2/4 (50%) -> at risk. STU2: Maths 4/4 -> fine.
      const rows = [
        ['STU1', 'present'], ['STU1', 'present'], ['STU1', 'absent'], ['STU1', 'absent'],
        ['STU2', 'present'], ['STU2', 'present'], ['STU2', 'late'], ['STU2', 'present']
      ];
      rows.forEach(([studentId, status], index) => firebase.__seed('attendance', `r${index}`, {
        student_id: studentId, subject: 'Maths', date: `2025-01-0${(index % 4) + 1}`, status,
        department: 'CSE', year: 3, section: 'A'
      }));
    });

    test('lists students under the threshold with the failing subjects', async () => {
      const res = await api.get('/api/attendance/at-risk', { token: teacherToken });

      expect(res.status).toBe(200);
      expect(res.body.count).toBe(1);
      expect(res.body.students[0]).toMatchObject({
        student_id: 'STU1', name: 'Asha Student', overallPercentage: 50,
        subjects: [{ subject: 'Maths', attended: 2, total: 4, percentage: 50 }]
      });
    });

    test('a stricter threshold flags more students', async () => {
      const res = await api.get('/api/attendance/at-risk?threshold=100', { token: teacherToken });
      expect(res.body.students.map((student) => student.student_id)).toEqual(['STU1']);
    });

    test('an admin must say which department', async () => {
      expect((await api.get('/api/attendance/at-risk', { token: adminToken })).status).toBe(400);
      const res = await api.get('/api/attendance/at-risk?department=CSE', { token: adminToken });
      expect(res.status).toBe(200);
    });

    test('students cannot see the report', async () => {
      expect((await api.get('/api/attendance/at-risk', { token: studentToken })).status).toBe(403);
    });
  });

  describe('GET /student/:id and /bunk-plan', () => {
    beforeEach(() => {
      // 6 of 10 attended
      for (let index = 0; index < 10; index += 1) {
        firebase.__seed('attendance', `b${index}`, {
          student_id: 'STU1', subject: 'Maths', date: `2025-02-${String(index + 1).padStart(2, '0')}`,
          status: index < 6 ? 'present' : 'absent'
        });
      }
    });

    test('a student cannot read someone else\'s attendance', async () => {
      expect((await api.get('/api/attendance/student/STU2', { token: studentToken })).status).toBe(403);
      expect((await api.get('/api/attendance/student/STU1', { token: studentToken })).status).toBe(200);
    });

    test('a teacher can read a student\'s attendance', async () => {
      const res = await api.get('/api/attendance/student/STU1', { token: teacherToken });
      expect(res.status).toBe(200);
      expect(res.body.data.summary[0]).toMatchObject({ subject: 'Maths', total_classes: 10, present_count: 6, percentage: 60 });
    });

    test('bunk plan: classes needed to recover to the threshold', async () => {
      const res = await api.get('/api/attendance/bunk-plan?threshold=75', { token: studentToken });
      // deficit = 0.75*10 - 6 = 1.5 ; each attended class closes 0.25 -> 6 classes
      expect(res.body.subjects[0]).toMatchObject({ canMiss: 0, recoverNeeded: 6 });
    });

    test('bunk plan at a 100% requirement reports "cannot recover" as null, not Infinity', async () => {
      const res = await api.get('/api/attendance/bunk-plan?threshold=100', { token: studentToken });
      expect(res.status).toBe(200);
      expect(res.body.subjects[0].recoverNeeded).toBeNull();
    });

    test('bunk plan: how many classes can still be missed', async () => {
      firebase.__reset();
      Object.values(USERS).forEach((user) => firebase.__seed('users', user.id, user));
      await cacheService.flush().catch(() => {});
      for (let index = 0; index < 10; index += 1) {
        firebase.__seed('attendance', `c${index}`, { student_id: 'STU1', subject: 'Maths', date: `2025-03-${String(index + 1).padStart(2, '0')}`, status: index < 9 ? 'present' : 'absent' });
      }
      const res = await api.get('/api/attendance/bunk-plan?threshold=75', { token: studentToken });
      expect(res.body.subjects[0]).toMatchObject({ canMiss: 2, recoverNeeded: 0 });
    });
  });
});
