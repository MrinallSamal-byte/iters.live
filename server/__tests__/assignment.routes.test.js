/** @jest-environment node */

jest.mock('../database/firebase', () => require('../test-utils/fake-firebase').createFirebaseMock());

const firebase = require('../database/firebase');
const guard = require('../services/session-guard.service');
const router = require('../routes/assignment.routes');
const { startHarness } = require('../test-utils/route-harness');
const { tokenFor, USERS } = require('../test-utils/fixtures');

const HOUR = 60 * 60 * 1000;

describe('assignment routes', () => {
  let api;
  let tokens;

  beforeAll(() => {
    api = startHarness('/api/assignments', router);
    tokens = {
      teacher: tokenFor(USERS.teacher),
      teacher2: tokenFor(USERS.teacher2),
      student: tokenFor(USERS.student),
      student2: tokenFor(USERS.student2),
      admin: tokenFor(USERS.admin)
    };
  });

  afterAll(() => api.close());

  beforeEach(() => {
    firebase.__reset();
    guard.clearLiveUserCache();
    Object.values(USERS).forEach((user) => firebase.__seed('users', user.id, user));
    // A student of another year, who must not be notified or see the assignment.
    firebase.__seed('users', 'STU4', { ...USERS.student, id: 'STU4', registration_number: 'STU4', year: 2 });
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => jest.restoreAllMocks());

  const inHours = (hours) => new Date(Date.now() + hours * HOUR).toISOString();

  const create = (overrides = {}, token = tokens.teacher) => api.post('/api/assignments', {
    title: 'Lab report 1', description: 'Write it up', subject: 'Physics',
    department: 'CSE', year: '3', total_marks: 20, deadline: inHours(48), ...overrides
  }, { token });

  async function createAndGetId(overrides, token) {
    const res = await create(overrides, token);
    expect(res.status).toBe(201);
    return res.body.data.id;
  }

  describe('POST / (create)', () => {
    test('stores a numeric year and an ISO deadline, and notifies exactly the class', async () => {
      const res = await create();

      expect(res.status).toBe(201);
      const stored = firebase.__read('assignments', res.body.data.id);
      expect(stored).toMatchObject({ year: 3, department: 'CSE', created_by: 'TCH1', allow_late: false, is_active: true });
      expect(new Date(stored.deadline).toISOString()).toBe(stored.deadline);

      const recipients = firebase.__all('notifications').filter((item) => item.type === 'assignment').map((item) => item.user_id).sort();
      expect(recipients).toEqual(['STU1', 'STU2']); // STU4 is year 2; teachers/admin are not students
      expect(res.body.data.notified).toBe(2);
    });

    test.each([
      [{ title: 'ab' }, /title/],
      [{ department: '' }, /department/],
      [{ year: '9' }, /year/],
      [{ year: 'abc' }, /year/],
      [{ deadline: 'someday' }, /deadline/],
      [{ deadline: inHours(-1) }, /future/],
      [{ total_marks: -5 }, /total_marks/]
    ])('rejects %j', async (overrides, message) => {
      const res = await create(overrides);
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(message);
      expect(firebase.__all('assignments')).toHaveLength(0);
    });

    test('students cannot create assignments', async () => {
      expect((await create({}, tokens.student)).status).toBe(403);
    });
  });

  describe('student view', () => {
    test('shows only the student\'s class, flags overdue work, and resolves legacy string years', async () => {
      await create({ title: 'Current' });
      firebase.__seed('assignments', 'legacy', {
        title: 'Legacy', department: 'CSE', year: '3', deadline: inHours(-10), is_active: true
      });
      firebase.__seed('assignments', 'other-year', { title: 'Y2', department: 'CSE', year: 2, deadline: inHours(5), is_active: true });
      firebase.__seed('assignments', 'closed', { title: 'Closed', department: 'CSE', year: 3, deadline: inHours(5), is_active: false });

      const res = await api.get('/api/assignments/student', { token: tokens.student });

      const byTitle = Object.fromEntries(res.body.data.map((item) => [item.title, item]));
      expect(Object.keys(byTitle).sort()).toEqual(['Current', 'Legacy']);
      expect(byTitle.Legacy.is_overdue).toBe(true);
      expect(byTitle.Current.is_overdue).toBe(false);
    });
  });

  describe('POST /:id/submit', () => {
    const submit = (id, body = { submission_text: 'my answer' }, token = tokens.student) =>
      api.post(`/api/assignments/${id}/submit`, body, { token });

    test('accepts an on-time submission', async () => {
      const id = await createAndGetId();
      const res = await submit(id);

      expect(res.status).toBe(200);
      expect(res.body.data.is_late).toBe(false);
      expect(firebase.__all('assignment_submissions')[0]).toMatchObject({ student_id: 'STU1', status: 'submitted', is_late: false });
    });

    test('resubmitting replaces the earlier answer instead of adding a second row', async () => {
      const id = await createAndGetId();
      await submit(id, { submission_text: 'v1' });
      await submit(id, { submission_text: 'v2' });

      const rows = firebase.__all('assignment_submissions');
      expect(rows).toHaveLength(1);
      expect(rows[0].submission_text).toBe('v2');
    });

    test('refuses submissions to a deadline that has passed unless late work is allowed', async () => {
      firebase.__seed('assignments', 'strict', { title: 'Strict', department: 'CSE', year: 3, deadline: inHours(-1), allow_late: false, is_active: true });
      firebase.__seed('assignments', 'lenient', { title: 'Lenient', department: 'CSE', year: 3, deadline: inHours(-1), allow_late: true, is_active: true });
      firebase.__seed('assignments', 'legacy', { title: 'Legacy', department: 'CSE', year: 3, deadline: inHours(-1), is_active: true });

      const strict = await submit('strict');
      expect(strict.status).toBe(403);
      expect(strict.body.code).toBe('DEADLINE_PASSED');

      const lenient = await submit('lenient');
      expect(lenient.status).toBe(200);
      expect(lenient.body.data.is_late).toBe(true);

      // Rows from before the setting existed keep working, just flagged late.
      const legacy = await submit('legacy');
      expect(legacy.status).toBe(200);
      expect(legacy.body.data.is_late).toBe(true);
    });

    test('a graded submission can no longer be changed', async () => {
      const id = await createAndGetId();
      await submit(id);
      await api.post(`/api/assignments/${id}/grade`, { student_id: 'STU1', marks_obtained: 15 }, { token: tokens.teacher });

      const res = await submit(id, { submission_text: 'sneaky edit' });
      expect(res.status).toBe(409);
      expect(res.body.code).toBe('ALREADY_GRADED');
    });

    test('404 for a missing or closed assignment, 403 for another class, 400 for an empty submission', async () => {
      expect((await submit('missing')).status).toBe(404);

      const id = await createAndGetId({ year: 2 });
      expect((await submit(id)).status).toBe(403);

      const own = await createAndGetId();
      expect((await submit(own, {})).status).toBe(400);

      await api.delete(`/api/assignments/${own}`, { token: tokens.teacher });
      expect((await submit(own)).status).toBe(404);
    });
  });

  describe('grading', () => {
    let id;

    beforeEach(async () => {
      id = await createAndGetId({ total_marks: 20 });
      await api.post(`/api/assignments/${id}/submit`, { submission_text: 'answer' }, { token: tokens.student });
    });

    const grade = (body, token = tokens.teacher) => api.post(`/api/assignments/${id}/grade`, body, { token });

    test('records the grade, notifies the student, and audits it', async () => {
      const res = await grade({ student_id: 'STU1', marks_obtained: 17, feedback: 'Good' });

      expect(res.status).toBe(200);
      expect(firebase.__all('assignment_submissions')[0]).toMatchObject({ status: 'graded', marks_obtained: 17, feedback: 'Good' });
      expect(firebase.__all('notifications').some((item) => item.title === 'Assignment Graded' && item.user_id === 'STU1')).toBe(true);
      expect(firebase.__all('activity_log').some((entry) => entry.action === 'assignment_grade')).toBe(true);
    });

    test.each([
      [{ student_id: 'STU1', marks_obtained: 25 }, /exceed/],
      [{ student_id: 'STU1', marks_obtained: -1 }, /marks_obtained/],
      [{ student_id: 'STU1', marks_obtained: '' }, /marks_obtained/],
      [{ student_id: 'STU1' }, /marks_obtained/],
      [{ marks_obtained: 5 }, /student_id/]
    ])('rejects %j', async (body, message) => {
      const res = await grade(body);
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(message);
    });

    test('a missing mark is not silently stored as zero', async () => {
      await grade({ student_id: 'STU1' });
      expect(firebase.__all('assignment_submissions')[0].status).toBe('submitted');
    });

    test('404 when the student has no submission, or the assignment does not exist', async () => {
      expect((await grade({ student_id: 'STU2', marks_obtained: 5 })).status).toBe(404);
      const res = await api.post('/api/assignments/nope/grade', { student_id: 'STU1', marks_obtained: 5 }, { token: tokens.teacher });
      expect(res.status).toBe(404);
    });
  });

  describe('teacher dashboard data (GET /mine)', () => {
    test('lists only the teacher\'s own assignments with real counts and stats', async () => {
      const mine = await createAndGetId({ title: 'Mine' });
      await createAndGetId({ title: 'Theirs' }, tokens.teacher2);

      await api.post(`/api/assignments/${mine}/submit`, { submission_text: 'a' }, { token: tokens.student });
      await api.post(`/api/assignments/${mine}/submit`, { submission_text: 'b' }, { token: tokens.student2 });
      await api.post(`/api/assignments/${mine}/grade`, { student_id: 'STU1', marks_obtained: 10 }, { token: tokens.teacher });

      const res = await api.get('/api/assignments/mine', { token: tokens.teacher });

      expect(res.status).toBe(200);
      expect(res.body.data.map((item) => item.title)).toEqual(['Mine']);
      expect(res.body.data[0].counts).toEqual({ submitted: 2, graded: 1, pending: 1, late: 0, expected: 2 });
      expect(res.body.stats).toEqual({ totalAssignments: 1, activeAssignments: 1, pendingSubmissions: 1, avgSubmissionRate: 100 });
    });

    test('an admin sees everyone\'s; a student cannot call it', async () => {
      await createAndGetId({ title: 'Alpha' });
      await createAndGetId({ title: 'Bravo' }, tokens.teacher2);

      expect((await api.get('/api/assignments/mine', { token: tokens.admin })).body.data).toHaveLength(2);
      expect((await api.get('/api/assignments/mine', { token: tokens.student })).status).toBe(403);
    });

    test('with no assignments the rate is null, not a made-up number', async () => {
      const res = await api.get('/api/assignments/mine', { token: tokens.teacher });
      expect(res.body.stats).toEqual({ totalAssignments: 0, activeAssignments: 0, pendingSubmissions: 0, avgSubmissionRate: null });
    });
  });

  describe('submissions list for grading', () => {
    test('includes names, the submitted text and the late flag', async () => {
      const id = await createAndGetId();
      await api.post(`/api/assignments/${id}/submit`, { submission_text: 'my essay' }, { token: tokens.student });

      const res = await api.get(`/api/assignments/${id}/submissions`, { token: tokens.teacher });

      expect(res.body.data[0]).toMatchObject({
        student_id: 'STU1', student_name: 'Asha Student', registration_number: 'STU1',
        submission_text: 'my essay', is_late: false, status: 'submitted'
      });
    });
  });

  describe('PUT /:id and DELETE /:id', () => {
    test('only the owner (or an admin) may edit', async () => {
      const id = await createAndGetId();

      expect((await api.put(`/api/assignments/${id}`, { title: 'Hijacked' }, { token: tokens.teacher2 })).status).toBe(403);
      expect((await api.put(`/api/assignments/${id}`, { title: 'Fixed title' }, { token: tokens.teacher })).status).toBe(200);
      expect((await api.put(`/api/assignments/${id}`, { title: 'Admin edit' }, { token: tokens.admin })).status).toBe(200);
      expect(firebase.__read('assignments', id).title).toBe('Admin edit');
    });

    test('changing the deadline tells students who have not submitted, and re-arms the reminder', async () => {
      const id = await createAndGetId();
      await api.post(`/api/assignments/${id}/submit`, { submission_text: 'done' }, { token: tokens.student });
      firebase.__seed('assignments', id, { ...firebase.__read('assignments', id), reminder_sent_at: inHours(-1) });
      const before = firebase.__all('notifications').length;

      const res = await api.put(`/api/assignments/${id}`, { deadline: inHours(96) }, { token: tokens.teacher });

      expect(res.status).toBe(200);
      const changes = firebase.__all('notifications').slice(before).filter((item) => item.title === 'Assignment deadline changed');
      expect(changes.map((item) => item.user_id)).toEqual(['STU2']); // STU1 already submitted
      expect(firebase.__read('assignments', id).reminder_sent_at).toBeNull();
    });

    test('validates edits', async () => {
      const id = await createAndGetId();
      expect((await api.put(`/api/assignments/${id}`, { title: 'x' }, { token: tokens.teacher })).status).toBe(400);
      expect((await api.put(`/api/assignments/${id}`, { deadline: 'never' }, { token: tokens.teacher })).status).toBe(400);
      expect((await api.put(`/api/assignments/${id}`, {}, { token: tokens.teacher })).status).toBe(400);
      expect((await api.put('/api/assignments/missing', { title: 'Valid title' }, { token: tokens.teacher })).status).toBe(404);
    });

    test('delete closes the assignment but keeps submissions and grades', async () => {
      const id = await createAndGetId();
      await api.post(`/api/assignments/${id}/submit`, { submission_text: 'work' }, { token: tokens.student });

      expect((await api.delete(`/api/assignments/${id}`, { token: tokens.teacher2 })).status).toBe(403);
      expect((await api.delete(`/api/assignments/${id}`, { token: tokens.teacher })).status).toBe(200);

      expect(firebase.__read('assignments', id)).toMatchObject({ is_active: false, closed_by: 'TCH1' });
      expect(firebase.__all('assignment_submissions')).toHaveLength(1);
      expect((await api.get('/api/assignments/student', { token: tokens.student })).body.data).toHaveLength(0);
    });
  });

  describe('POST /:id/auto-grade', () => {
    async function setup() {
      const id = await createAndGetId({ total_marks: 4 });
      await api.post(`/api/assignments/${id}/answer-key`, {
        answerKey: [{ questionId: 'q1', correctAnswer: 'A', points: 2 }, { questionId: 'q2', correctAnswer: 'B', points: 2 }]
      }, { token: tokens.teacher });
      await api.post(`/api/assignments/${id}/submit`, { submission_answers: { q1: 'A', q2: 'B' } }, { token: tokens.student });
      await api.post(`/api/assignments/${id}/submit`, { submission_answers: { q1: 'A', q2: 'C' } }, { token: tokens.student2 });
      return id;
    }

    test('grades every submission and tells each student', async () => {
      const id = await setup();
      const res = await api.post(`/api/assignments/${id}/auto-grade`, {}, { token: tokens.teacher });

      expect(res.body.data).toEqual({ graded: 2, skippedManual: 0 });
      const byStudent = Object.fromEntries(firebase.__all('assignment_submissions').map((row) => [row.student_id, row.marks_obtained]));
      expect(byStudent).toEqual({ STU1: 4, STU2: 2 });
    });

    test('keeps a grade the teacher entered by hand unless overwrite is requested', async () => {
      const id = await setup();
      await api.post(`/api/assignments/${id}/grade`, { student_id: 'STU2', marks_obtained: 3, feedback: 'partial credit' }, { token: tokens.teacher });

      const first = await api.post(`/api/assignments/${id}/auto-grade`, {}, { token: tokens.teacher });
      expect(first.body.data).toEqual({ graded: 1, skippedManual: 1 });
      expect(firebase.__all('assignment_submissions').find((row) => row.student_id === 'STU2').marks_obtained).toBe(3);

      const forced = await api.post(`/api/assignments/${id}/auto-grade`, { overwrite: true }, { token: tokens.teacher });
      expect(forced.body.data.graded).toBe(2);
      expect(firebase.__all('assignment_submissions').find((row) => row.student_id === 'STU2').marks_obtained).toBe(2);
    });

    test('404 without an answer key or for a missing assignment', async () => {
      const id = await createAndGetId();
      expect((await api.post(`/api/assignments/${id}/auto-grade`, {}, { token: tokens.teacher })).status).toBe(404);
      expect((await api.post('/api/assignments/missing/auto-grade', {}, { token: tokens.teacher })).status).toBe(404);
    });
  });

  describe('GET /:id/my-submission', () => {
    test('returns the student\'s own submission and 404 when there is none', async () => {
      const id = await createAndGetId();
      expect((await api.get(`/api/assignments/${id}/my-submission`, { token: tokens.student })).status).toBe(404);

      await api.post(`/api/assignments/${id}/submit`, { submission_text: 'mine' }, { token: tokens.student });
      const res = await api.get(`/api/assignments/${id}/my-submission`, { token: tokens.student });

      expect(res.status).toBe(200);
      expect(res.body.data.submission_text).toBe('mine');
      expect((await api.get(`/api/assignments/${id}/my-submission`, { token: tokens.student2 })).status).toBe(404);
    });
  });

  describe('POST /reminders/run', () => {
    test('requires an admin or the cron secret', async () => {
      expect((await api.post('/api/assignments/reminders/run', {})).status).toBe(401);
      expect((await api.post('/api/assignments/reminders/run', {}, { token: tokens.teacher })).status).toBe(403);
      expect((await api.post('/api/assignments/reminders/run', {}, { token: tokens.admin })).status).toBe(200);
    });

    test('accepts the shared cron secret instead of a user session', async () => {
      process.env.CRON_SECRET = 'cron-secret-value';
      try {
        const ok = await api.post('/api/assignments/reminders/run', {}, { headers: { 'x-cron-secret': 'cron-secret-value' } });
        expect(ok.status).toBe(200);
        const bad = await api.post('/api/assignments/reminders/run', {}, { headers: { 'x-cron-secret': 'wrong-secret-value' } });
        expect(bad.status).toBe(401);
      } finally {
        delete process.env.CRON_SECRET;
      }
    });

    test('rejects a nonsensical window', async () => {
      const res = await api.post('/api/assignments/reminders/run', { windowHours: -3 }, { token: tokens.admin });
      expect(res.status).toBe(400);
    });
  });
});
