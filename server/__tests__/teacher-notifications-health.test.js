/** @jest-environment node */

jest.mock('../database/firebase', () => require('../test-utils/fake-firebase').createFirebaseMock());

const firebase = require('../database/firebase');
const guard = require('../services/session-guard.service');
const teacherRouter = require('../routes/teacher.routes');
const notificationRouter = require('../routes/notification.routes');
const healthRouter = require('../routes/health.routes');
const { startHarness } = require('../test-utils/route-harness');
const { tokenFor, USERS } = require('../test-utils/fixtures');

describe('teacher routes', () => {
  let api;
  let tokens;

  beforeAll(() => {
    api = startHarness('/api/teacher', teacherRouter);
    tokens = { teacher: tokenFor(USERS.teacher), teacher2: tokenFor(USERS.teacher2), admin: tokenFor(USERS.admin), student: tokenFor(USERS.student) };
  });

  afterAll(() => api.close());

  beforeEach(() => {
    firebase.__reset();
    guard.clearLiveUserCache();
    Object.values(USERS).forEach((user) => firebase.__seed('users', user.id, user));
    firebase.__seed('users', 'ECE1', { id: 'ECE1', name: 'Ece Student', role: 'student', department: 'ECE', is_active: true });
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => jest.restoreAllMocks());

  test('stats are scoped to the teacher\'s department', async () => {
    firebase.__seed('attendance', 'a1', { student_id: 'STU1', status: 'present', date: '2025-01-01', department: 'CSE' });
    firebase.__seed('attendance', 'a2', { student_id: 'ECE1', status: 'absent', date: '2025-01-01', department: 'ECE' });
    firebase.__seed('marks', 'm1', { student_id: 'STU1', marks_obtained: 80, total_marks: 100, department: 'CSE' });
    firebase.__seed('marks', 'm2', { student_id: 'ECE1', marks_obtained: 10, total_marks: 100, department: 'ECE' });

    const teacher = await api.get('/api/teacher/stats', { token: tokens.teacher });
    expect(teacher.body.stats).toMatchObject({ totalStudents: 2, avgAttendance: 100, classAverage: 80 });

    const admin = await api.get('/api/teacher/stats', { token: tokens.admin });
    expect(admin.body.stats).toMatchObject({ totalStudents: 3, avgAttendance: 50, classAverage: 45 });
  });

  test('pending submissions count only the teacher\'s own assignments', async () => {
    firebase.__seed('assignments', 'mine', { title: 'Mine', created_by: 'TCH1' });
    firebase.__seed('assignments', 'theirs', { title: 'Theirs', created_by: 'TCH2' });
    firebase.__seed('assignment_submissions', 's1', { assignment_id: 'mine', student_id: 'STU1', status: 'submitted' });
    firebase.__seed('assignment_submissions', 's2', { assignment_id: 'theirs', student_id: 'STU2', status: 'submitted' });

    const res = await api.get('/api/teacher/stats', { token: tokens.teacher });
    expect(res.body.stats.pendingSubmissions).toBe(1);
  });

  test('submissions list contains only own assignments, with ids the grading screen needs', async () => {
    firebase.__seed('assignments', 'mine', { title: 'Mine', subject: 'Physics', created_by: 'TCH1' });
    firebase.__seed('assignments', 'theirs', { title: 'Theirs', created_by: 'TCH2' });
    firebase.__seed('assignment_submissions', 's1', { assignment_id: 'mine', student_id: 'STU1', status: 'submitted', submitted_at: '2025-01-02T00:00:00.000Z' });
    firebase.__seed('assignment_submissions', 's2', { assignment_id: 'theirs', student_id: 'STU2', status: 'submitted', submitted_at: '2025-01-03T00:00:00.000Z' });
    firebase.__seed('assignment_submissions', 's3', { assignment_id: 'mine', student_id: 'STU2', status: 'graded', submitted_at: '2025-01-01T00:00:00.000Z' });

    const pending = await api.get('/api/teacher/submissions?status=pending', { token: tokens.teacher });
    expect(pending.body.data).toEqual([expect.objectContaining({
      id: 's1', assignment_id: 'mine', student_id: 'STU1', assignment_title: 'Mine', student_name: 'Asha Student', student_reg: 'STU1', status: 'submitted'
    })]);

    const all = await api.get('/api/teacher/submissions', { token: tokens.teacher });
    expect(all.body.data.map((row) => row.id)).toEqual(['s1', 's3']); // newest first

    const asAdmin = await api.get('/api/teacher/submissions', { token: tokens.admin });
    expect(asAdmin.body.data).toHaveLength(3);
  });

  test('students are refused', async () => {
    expect((await api.get('/api/teacher/stats', { token: tokens.student })).status).toBe(403);
  });
});

describe('notification routes', () => {
  let api;
  let token;

  beforeAll(() => {
    api = startHarness('/api/notifications', notificationRouter);
    token = tokenFor(USERS.student);
  });

  afterAll(() => api.close());

  beforeEach(() => {
    firebase.__reset();
    guard.clearLiveUserCache();
    firebase.__seed('users', 'STU1', USERS.student);
    for (let index = 0; index < 30; index += 1) {
      firebase.__seed('notifications', `n${index}`, {
        user_id: 'STU1', title: `N${index}`, message: 'm', type: 'info', is_read: index % 2 === 0,
        created_at: `2025-01-01T00:00:${String(index).padStart(2, '0')}.000Z`
      });
    }
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => jest.restoreAllMocks());

  test('a negative page is treated as page 1, not as a slice from the end', async () => {
    const res = await api.get('/api/notifications?page=-3&pageSize=5', { token });
    expect(res.body.pagination.page).toBe(1);
    expect(res.body.notifications.map((item) => item.title)).toEqual(['N29', 'N28', 'N27', 'N26', 'N25']);
  });

  test('pageSize is capped', async () => {
    const res = await api.get('/api/notifications?pageSize=100000', { token });
    expect(res.body.pagination.pageSize).toBe(100);
    expect((await api.get('/api/notifications?pageSize=0', { token })).body.pagination.pageSize).toBe(20);
  });

  test('filters by read state and reports the unread count', async () => {
    const res = await api.get('/api/notifications?isRead=false&pageSize=100', { token });
    expect(res.body.notifications).toHaveLength(15);
    expect(res.body.unreadCount).toBe(15);
  });

  test('users cannot read or delete each other\'s notifications', async () => {
    const other = tokenFor(USERS.student2);
    firebase.__seed('users', 'STU2', USERS.student2);
    expect((await api.put('/api/notifications/n1/read', {}, { token: other })).status).toBe(404);
    expect((await api.delete('/api/notifications/n1', { token: other })).status).toBe(404);
    expect(firebase.__read('notifications', 'n1')).toBeDefined();
  });

  test('a service failure is reported generically, without internal error text', async () => {
    const original = firebase.db.collection;
    firebase.db.collection = () => { throw new Error('secret internal detail'); };
    try {
      const res = await api.get('/api/notifications', { token });
      expect(res.status).toBe(500);
      expect(JSON.stringify(res.body)).not.toContain('secret internal detail');
    } finally {
      firebase.db.collection = original;
    }
  });
});

describe('health readiness', () => {
  let api;

  beforeAll(() => {
    api = startHarness('/api/health', healthRouter);
  });

  afterAll(() => api.close());

  test('/ready is 200 when the datastore answers and carries no internal detail', async () => {
    const res = await api.get('/api/health/ready');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ready: true });
    expect(res.headers['cache-control']).toBe('no-store');
  });

  test('/ready is 503 when the datastore is down', async () => {
    const original = firebase.db.collection;
    firebase.db.collection = () => { throw new Error('connection reset by 10.1.2.3'); };
    try {
      const res = await api.get('/api/health/ready');
      expect(res.status).toBe(503);
      expect(res.body).toEqual({ ready: false });
    } finally {
      firebase.db.collection = original;
    }
  });

  test('/detailed counts collections with the aggregation and survives a CPU-less container', async () => {
    firebase.__reset();
    guard.clearLiveUserCache();
    Object.values(USERS).forEach((user) => firebase.__seed('users', user.id, user));
    const os = require('os');
    const cpus = jest.spyOn(os, 'cpus').mockReturnValue([]);
    firebase.__stats.documentsRead = 0;

    const res = await api.get('/api/health/detailed', { token: tokenFor(USERS.admin) });
    cpus.mockRestore();

    expect(res.status).toBe(200);
    expect(res.body.system.cpuModel).toBeNull();
    expect(res.body.database.collections.find((item) => item.name === 'users').count).toBe(Object.keys(USERS).length);
    expect(firebase.__stats.documentsRead).toBeLessThanOrEqual(1); // only the session-guard lookup, no collection downloads
  });

  test('/refresh-views reports that mirroring is off instead of pretending to refresh', async () => {
    const res = await api.post('/api/health/refresh-views', {}, { token: tokenFor(USERS.admin) });
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/not enabled/);
  });
});
