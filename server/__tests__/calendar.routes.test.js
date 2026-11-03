/** @jest-environment node */

jest.mock('../database/firebase', () => require('../test-utils/fake-firebase').createFirebaseMock());
jest.mock('../services/soa-data.service', () => ({
  getPortalSnapshotForUser: jest.fn().mockResolvedValue({ normalizedData: { timetable: [] } })
}));

const jwt = require('jsonwebtoken');
const firebase = require('../database/firebase');
const guard = require('../services/session-guard.service');
const feed = require('../services/calendar-feed.service');
const router = require('../routes/calendar.routes');
const { startHarness } = require('../test-utils/route-harness');
const { tokenFor, USERS } = require('../test-utils/fixtures');

const tokenFromUrl = (url) => new URL(url).searchParams.get('token');

describe('calendar feed', () => {
  let api;
  let studentToken;

  beforeAll(() => {
    api = startHarness('/api/calendar.ics', router);
    studentToken = tokenFor(USERS.student);
  });

  afterAll(() => api.close());

  beforeEach(() => {
    firebase.__reset();
    guard.clearLiveUserCache();
    Object.values(USERS).forEach((user) => firebase.__seed('users', user.id, user));
    firebase.__seed('assignments', 'A1', {
      title: 'Lab report', department: 'CSE', year: 3, deadline: '2030-05-01T10:00:00.000Z', is_active: true
    });
    firebase.__seed('assignments', 'A2', {
      title: 'Other year', department: 'CSE', year: 2, deadline: '2030-05-02T10:00:00.000Z', is_active: true
    });
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => jest.restoreAllMocks());

  const subscribe = () => api.post('/api/calendar.ics/subscription', {}, { token: studentToken });

  test('POST /subscription returns https and webcal links that carry a token', async () => {
    const res = await subscribe();

    expect(res.status).toBe(200);
    expect(res.body.data.url).toMatch(/\/api\/calendar\.ics\?token=/);
    expect(res.body.data.webcalUrl).toMatch(/^webcal:\/\//);
    expect(res.body.data.version).toBe(1);
  });

  test('the subscription link works without any Authorization header and returns that student\'s calendar', async () => {
    const { data } = (await subscribe()).body;
    const path = new URL(data.url).pathname + new URL(data.url).search;

    const res = await api.get(path, { raw: true });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/calendar/);
    expect(res.headers['cache-control']).toBe('private, max-age=900');
    expect(res.text).toContain('BEGIN:VCALENDAR');
    expect(res.text).toContain('SUMMARY:Due: Lab report');
    expect(res.text).not.toContain('Other year'); // another year's assignment
  });

  test('a garbage or wrongly-scoped token is rejected', async () => {
    expect((await api.get('/api/calendar.ics?token=garbage')).status).toBe(401);

    // An API session token must not be usable as a feed token.
    expect((await api.get(`/api/calendar.ics?token=${encodeURIComponent(studentToken)}`)).status).toBe(401);

    // And a feed token must not work as an API session.
    const { data } = (await subscribe()).body;
    const asSession = await api.post('/api/calendar.ics/subscription', {}, { token: tokenFromUrl(data.url) });
    expect(asSession.status).toBe(401);
  });

  test('resetting the link kills every earlier link and issues a working replacement', async () => {
    const first = (await subscribe()).body.data;
    const reset = await api.post('/api/calendar.ics/subscription/reset', {}, { token: studentToken });

    expect(reset.body.data.version).toBe(2);
    expect(firebase.__read('users', 'STU1').calendar_feed_version).toBe(2);

    expect((await api.get(`/api/calendar.ics?token=${encodeURIComponent(tokenFromUrl(first.url))}`)).status).toBe(401);
    expect((await api.get(`/api/calendar.ics?token=${encodeURIComponent(tokenFromUrl(reset.body.data.url))}`, { raw: true })).status).toBe(200);
  });

  test('the link stops working when the account is deactivated', async () => {
    const { data } = (await subscribe()).body;
    firebase.__seed('users', 'STU1', { ...USERS.student, is_active: false });

    expect((await api.get(`/api/calendar.ics?token=${encodeURIComponent(tokenFromUrl(data.url))}`)).status).toBe(401);
  });

  test('an expired link is rejected', async () => {
    const expired = jwt.sign(
      { typ: 'calendar-feed', fv: 1, u: {} },
      process.env.JWT_SECRET,
      { subject: 'STU1', audience: feed.FEED_AUDIENCE, issuer: 'iterasn-hub', expiresIn: -10 }
    );
    expect((await api.get(`/api/calendar.ics?token=${encodeURIComponent(expired)}`)).status).toBe(401);
  });

  test('the normal Bearer-authenticated download still works', async () => {
    const res = await api.get('/api/calendar.ics', { token: studentToken, raw: true });
    expect(res.status).toBe(200);
    expect(res.text).toContain('Lab report');
  });

  test('folded lines never exceed 75 octets or split a multi-byte character', async () => {
    firebase.__seed('assignments', 'A3', {
      title: 'Ünïcødé 研究报告 '.repeat(12), department: 'CSE', year: 3, deadline: '2030-05-03T10:00:00.000Z', is_active: true
    });

    const res = await api.get('/api/calendar.ics', { token: studentToken, raw: true });
    const lines = res.text.split('\r\n');

    expect(lines.every((line) => Buffer.byteLength(line, 'utf8') <= 75)).toBe(true);
    // Unfolding must reproduce a valid string with no replacement characters.
    const unfolded = res.text.replace(/\r\n /g, '');
    expect(unfolded).not.toContain('�');
    expect(unfolded).toContain('研究报告');
  });
});
