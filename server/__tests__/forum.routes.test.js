/** @jest-environment node */

jest.mock('../database/firebase', () => require('../test-utils/fake-firebase').createFirebaseMock());

const firebase = require('../database/firebase');
const guard = require('../services/session-guard.service');
const router = require('../routes/forum.routes');
const { startHarness } = require('../test-utils/route-harness');
const { tokenFor, USERS } = require('../test-utils/fixtures');

describe('forum routes', () => {
  let api;
  let tokens;

  beforeAll(() => {
    api = startHarness('/api/forum', router);
    tokens = {
      asha: tokenFor(USERS.student),
      ravi: tokenFor(USERS.student2),
      teacher: tokenFor(USERS.teacher),
      admin: tokenFor(USERS.admin)
    };
  });

  afterAll(() => api.close());

  beforeEach(() => {
    firebase.__reset();
    guard.clearLiveUserCache();
    Object.values(USERS).forEach((user) => firebase.__seed('users', user.id, user));
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => jest.restoreAllMocks());

  const ask = (overrides = {}, token = tokens.asha) => api.post('/api/forum/questions', {
    title: 'How do BSTs work?', description: 'Explain insertion', category: 'Data Structures', tags: ['dsa', 'tree'], ...overrides
  }, { token });

  async function askId(overrides, token) {
    const res = await ask(overrides, token);
    expect(res.status).toBe(201);
    return res.body.question.id;
  }

  const answer = (questionId, content = 'Walk the tree comparing keys.', token = tokens.ravi) =>
    api.post(`/api/forum/questions/${questionId}/answers`, { content }, { token });

  describe('empty forum', () => {
    test('shows nothing rather than invented questions, stats or contributors', async () => {
      const list = await api.get('/api/forum/questions');
      expect(list.body.questions).toEqual([]);
      expect(list.body.pagination.total).toBe(0);

      expect((await api.get('/api/forum/stats')).body.stats).toEqual({ total_questions: 0, answered_questions: 0, active_users: 0, total_answers: 0 });
      expect((await api.get('/api/forum/contributors')).body.contributors).toEqual([]);
    });

    test('an unknown question is a 404, not a made-up one', async () => {
      const res = await api.get('/api/forum/questions/does-not-exist');
      expect(res.status).toBe(404);
    });

    test('a datastore failure is an error, never fabricated success', async () => {
      const original = firebase.db.collection;
      firebase.db.collection = () => { throw new Error('firestore down'); };
      try {
        expect((await api.get('/api/forum/questions')).status).toBe(500);
        expect((await ask()).status).toBe(500);
      } finally {
        firebase.db.collection = original;
      }
    });
  });

  describe('asking', () => {
    test('stores the author and a zero answer count', async () => {
      const id = await askId();
      expect(firebase.__read('forum_questions', id)).toMatchObject({
        user_id: 'STU1', author_name: 'Asha Student', status: 'open', answer_count: 0, upvotes: 0, tags: 'dsa,tree'
      });
    });

    test.each([
      [{ title: ' ' }, /required/],
      [{ description: '' }, /required/],
      [{ category: undefined }, /required/],
      [{ title: 'x'.repeat(201) }, /limited/]
    ])('rejects %j', async (overrides, message) => {
      const res = await ask(overrides);
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(message);
    });

    test('requires sign-in', async () => {
      expect((await api.post('/api/forum/questions', { title: 't', description: 'd', category: 'c' })).status).toBe(401);
    });
  });

  describe('answering', () => {
    test('the question counter, status and author notification stay consistent', async () => {
      const id = await askId();
      const res = await answer(id);

      expect(res.status).toBe(201);
      expect(firebase.__read('forum_questions', id)).toMatchObject({ answer_count: 1, status: 'answered' });
      expect(firebase.__all('notifications').some((item) => item.user_id === 'STU1' && item.title === 'New answer to your question')).toBe(true);

      await answer(id, 'Another view', tokens.teacher);
      expect(firebase.__read('forum_questions', id).answer_count).toBe(2);
    });

    test('answering your own question does not notify yourself', async () => {
      const id = await askId();
      await answer(id, 'Self answer', tokens.asha);
      expect(firebase.__all('notifications')).toHaveLength(0);
    });

    test('404 for an unknown question, 400 for empty or oversized content', async () => {
      const id = await askId();
      expect((await answer('missing')).status).toBe(404);
      expect((await answer(id, '   ')).status).toBe(400);
      expect((await answer(id, 'x'.repeat(10001))).status).toBe(400);
    });
  });

  describe('listing and detail', () => {
    test('filters, searches, sorts and paginates', async () => {
      const first = await askId({ title: 'Binary trees', category: 'DSA', tags: 'tree' });
      const second = await askId({ title: 'SQL joins', category: 'DB', tags: 'sql' });
      await askId({ title: 'Pointers in C', category: 'C', tags: 'c' });
      await answer(second);
      await api.post(`/api/forum/questions/${first}/upvote`, {}, { token: tokens.ravi });

      const titles = async (query) => (await api.get(`/api/forum/questions?${query}`)).body.questions.map((question) => question.title);

      expect(await titles('category=DB')).toEqual(['SQL joins']);
      expect(await titles('status=answered')).toEqual(['SQL joins']);
      expect(await titles('search=POINTERS')).toEqual(['Pointers in C']);
      expect(await titles('tag=tree')).toEqual(['Binary trees']);
      expect((await titles('sortBy=unanswered')).sort()).toEqual(['Binary trees', 'Pointers in C']);
      expect((await titles('sortBy=popular'))[0]).toBe('Binary trees');
      expect((await api.get('/api/forum/questions?limit=2&page=2')).body.questions).toHaveLength(1);
      expect((await api.get('/api/forum/questions?limit=2')).body.pagination).toMatchObject({ total: 3, totalPages: 2 });
    });

    test('a question is returned with its answers, accepted first, then most upvoted', async () => {
      const id = await askId();
      const low = (await answer(id, 'low')).body.answer.id;
      const high = (await answer(id, 'high', tokens.teacher)).body.answer.id;
      const accepted = (await answer(id, 'accepted', tokens.admin)).body.answer.id;
      await api.post(`/api/forum/answers/${high}/upvote`, {}, { token: tokens.asha });
      await api.post(`/api/forum/answers/${accepted}/accept`, {}, { token: tokens.asha });

      const res = await api.get(`/api/forum/questions/${id}`);

      expect(res.body.question.answers.map((item) => item.id)).toEqual([accepted, high, low]);
      expect(res.body.question.answers[0].is_accepted).toBe(true);
    });

    test('voter identities are never exposed, only whether the viewer voted', async () => {
      const id = await askId();
      await api.post(`/api/forum/questions/${id}/upvote`, {}, { token: tokens.ravi });

      const asRavi = await api.get(`/api/forum/questions/${id}`, { token: tokens.ravi });
      const anonymous = await api.get(`/api/forum/questions/${id}`);

      expect(JSON.stringify(asRavi.body)).not.toContain('upvotedBy');
      expect(JSON.stringify(asRavi.body)).not.toContain('STU2');
      expect(asRavi.body.question.userHasUpvoted).toBe(true);
      expect(anonymous.body.question.userHasUpvoted).toBe(false);
    });

    test('older posts without a stored author name get one from the user record', async () => {
      firebase.__seed('forum_questions', 'old', { user_id: 'STU2', title: 'Legacy', description: 'd', category: 'c', status: 'open', created_at: '2024-01-01T00:00:00.000Z' });
      const res = await api.get('/api/forum/questions');
      expect(res.body.questions[0].author_name).toBe('Ravi Student');
    });
  });

  describe('voting', () => {
    test('toggles, keeps the count equal to the number of voters, and blocks self-votes', async () => {
      const id = await askId();

      const on = await api.post(`/api/forum/questions/${id}/upvote`, {}, { token: tokens.ravi });
      expect(on.body).toMatchObject({ upvotes: 1, userHasUpvoted: true });

      await api.post(`/api/forum/questions/${id}/upvote`, {}, { token: tokens.teacher });
      expect(firebase.__read('forum_questions', id).upvotes).toBe(2);

      const off = await api.post(`/api/forum/questions/${id}/upvote`, {}, { token: tokens.ravi });
      expect(off.body).toMatchObject({ upvotes: 1, userHasUpvoted: false });

      const own = await api.post(`/api/forum/questions/${id}/upvote`, {}, { token: tokens.asha });
      expect(own.status).toBe(400);
    });

    test('simultaneous votes from different users are all counted', async () => {
      const id = await askId();
      await Promise.all([tokens.ravi, tokens.teacher, tokens.admin].map((token) => api.post(`/api/forum/questions/${id}/upvote`, {}, { token })));
      expect(firebase.__read('forum_questions', id).upvotes).toBe(3);
    });

    test('voting on something that does not exist is a 404, not a fake success', async () => {
      expect((await api.post('/api/forum/questions/nope/upvote', {}, { token: tokens.ravi })).status).toBe(404);
      expect((await api.post('/api/forum/answers/nope/upvote', {}, { token: tokens.ravi })).status).toBe(404);
    });
  });

  describe('accepting an answer', () => {
    test('only the asker (or an admin) can accept, one answer at a time, and the author is told', async () => {
      const id = await askId();
      const first = (await answer(id, 'first')).body.answer.id;
      const second = (await answer(id, 'second', tokens.teacher)).body.answer.id;

      expect((await api.post(`/api/forum/answers/${first}/accept`, {}, { token: tokens.ravi })).status).toBe(403);
      expect((await api.post(`/api/forum/answers/${first}/accept`, {}, { token: tokens.asha })).status).toBe(200);
      expect((await api.post(`/api/forum/answers/${second}/accept`, {}, { token: tokens.admin })).status).toBe(200);

      expect(firebase.__read('forum_answers', first).is_accepted).toBe(false);
      expect(firebase.__read('forum_answers', second).is_accepted).toBe(true);
      expect(firebase.__all('notifications').some((item) => item.user_id === 'STU2' && item.title === 'Your answer was accepted')).toBe(true);
    });

    test('404 for a missing answer', async () => {
      expect((await api.post('/api/forum/answers/nope/accept', {}, { token: tokens.asha })).status).toBe(404);
    });
  });

  describe('stats and contributors', () => {
    test('are computed from real activity', async () => {
      const q1 = await askId();
      await askId({ title: 'Second question' }, tokens.ravi);
      const a1 = (await answer(q1, 'a1', tokens.ravi)).body.answer.id;
      await answer(q1, 'a2', tokens.teacher);
      await api.post(`/api/forum/answers/${a1}/upvote`, {}, { token: tokens.asha });
      await api.post(`/api/forum/answers/${a1}/upvote`, {}, { token: tokens.admin });

      const stats = (await api.get('/api/forum/stats')).body.stats;
      expect(stats).toEqual({ total_questions: 2, answered_questions: 1, active_users: 3, total_answers: 2 });

      const contributors = (await api.get('/api/forum/contributors')).body.contributors;
      expect(contributors[0]).toMatchObject({ id: 'STU2', name: 'Ravi Student', answer_count: 1, total_upvotes: 2 });
      expect(contributors[1]).toMatchObject({ id: 'TCH1', name: 'Dr Teacher' });
    });
  });
});
