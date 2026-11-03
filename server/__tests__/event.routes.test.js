/** @jest-environment node */

jest.mock('../database/firebase', () => require('../test-utils/fake-firebase').createFirebaseMock());

const firebase = require('../database/firebase');
const guard = require('../services/session-guard.service');
const router = require('../routes/event.routes');
const registration = require('../services/event-registration.service');
const { startHarness } = require('../test-utils/route-harness');
const { tokenFor, USERS } = require('../test-utils/fixtures');

const DAY = 24 * 60 * 60 * 1000;
const isoDay = (offset) => new Date(Date.now() + offset * DAY).toISOString().slice(0, 10);

describe('events', () => {
  let api;
  let tokens;

  beforeAll(() => {
    api = startHarness('/api/events', router);
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
    for (let index = 3; index <= 6; index += 1) {
      firebase.__seed('users', `STU${index}`, { ...USERS.student, id: `STU${index}`, registration_number: `STU${index}` });
    }
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => jest.restoreAllMocks());

  const createEvent = (overrides = {}, token = tokens.teacher) => api.post('/api/events', {
    title: 'Hack Night', event_date: isoDay(7), event_time: '18:30', location: 'Lab 2', ...overrides
  }, { token });

  async function newEvent(overrides, token) {
    const res = await createEvent(overrides, token);
    expect(res.status).toBe(201);
    return res.body.data.id;
  }

  const register = (id, token) => api.post(`/api/events/${id}/register`, {}, { token });
  const registrationsFor = (id) => firebase.__all('event_registrations').filter((row) => row.event_id === id);

  describe('creating events', () => {
    test('stores a normalised event with a zero counter', async () => {
      const id = await newEvent({ max_participants: '25' });
      expect(firebase.__read('events', id)).toMatchObject({
        title: 'Hack Night', event_date: isoDay(7), max_participants: 25, registration_count: 0, created_by: 'TCH1', is_active: true
      });
    });

    test.each([
      [{ title: 'ab' }, /title/],
      [{ event_date: 'soon' }, /event_date/],
      [{ event_time: '25:99' }, /event_time/],
      [{ max_participants: 0 }, /max_participants/],
      [{ max_participants: 1.5 }, /max_participants/],
      [{ registration_deadline: 'later' }, /registration_deadline/],
      [{ image_url: 'javascript:alert(1)' }, /image_url/]
    ])('rejects %j', async (overrides, message) => {
      const res = await createEvent(overrides);
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(message);
    });

    test('students cannot create events', async () => {
      expect((await createEvent({}, tokens.student)).status).toBe(403);
    });
  });

  describe('registration capacity', () => {
    test('concurrent registrations never exceed max_participants', async () => {
      const id = await newEvent({ max_participants: 2 });
      const ids = ['STU1', 'STU2', 'STU3', 'STU4', 'STU5'];

      const results = await Promise.all(ids.map((studentId) => register(id, tokenFor({ ...USERS.student, id: studentId, registration_number: studentId }))));

      const statuses = results.map((result) => result.status).sort();
      expect(statuses.filter((status) => status === 200)).toHaveLength(2);
      expect(statuses.filter((status) => status === 409)).toHaveLength(3);
      expect(registrationsFor(id)).toHaveLength(2);
      expect(firebase.__read('events', id).registration_count).toBe(2);
    });

    test('the same student registering twice at once gets one seat', async () => {
      const id = await newEvent({ max_participants: 10 });

      const results = await Promise.all([register(id, tokens.student), register(id, tokens.student), register(id, tokens.student)]);

      expect(results.every((result) => result.status === 200)).toBe(true);
      expect(registrationsFor(id)).toHaveLength(1);
      expect(firebase.__read('events', id).registration_count).toBe(1);
    });

    test('events without a capacity are unlimited', async () => {
      const id = await newEvent();
      await Promise.all(['STU1', 'STU2', 'STU3'].map((studentId) => register(id, tokenFor({ ...USERS.student, id: studentId, registration_number: studentId }))));
      expect(firebase.__read('events', id).registration_count).toBe(3);
    });

    test('a passed deadline closes registration; a missing event is 404', async () => {
      const id = await newEvent({ registration_deadline: new Date(Date.now() - 1000).toISOString() });
      expect((await register(id, tokens.student)).status).toBe(400);
      expect((await register('missing', tokens.student)).status).toBe(404);
    });

    test('rows from before the counter existed are counted from their registrations', async () => {
      firebase.__seed('events', 'legacy', { title: 'Old', event_date: isoDay(3), max_participants: 2, is_active: true });
      firebase.__seed('event_registrations', 'r1', { event_id: 'legacy', user_id: 'STU3' });
      firebase.__seed('event_registrations', 'r2', { event_id: 'legacy', user_id: 'STU4' });

      expect((await register('legacy', tokens.student)).status).toBe(409); // already full
      // A legacy registration (random id) is recognised as "already registered".
      const again = await register('legacy', tokenFor({ ...USERS.student, id: 'STU3', registration_number: 'STU3' }));
      expect(again.status).toBe(200);
      expect(again.body.message).toBe('Already registered');
    });
  });

  describe('cancelling a registration', () => {
    test('frees the seat and keeps the counter exact', async () => {
      const id = await newEvent({ max_participants: 1 });
      await register(id, tokens.student);
      expect((await register(id, tokens.student2)).status).toBe(409);

      const res = await api.delete(`/api/events/${id}/register`, { token: tokens.student });
      expect(res.status).toBe(200);
      expect(res.body.data.registration_count).toBe(0);

      expect((await register(id, tokens.student2)).status).toBe(200);
      expect(firebase.__read('events', id).registration_count).toBe(1);
    });

    test('is a 404 when the user was not registered, and the counter never goes negative', async () => {
      const id = await newEvent();
      const res = await api.delete(`/api/events/${id}/register`, { token: tokens.student });
      expect(res.status).toBe(404);
      expect(firebase.__read('events', id).registration_count).toBe(0);
    });
  });

  describe('listing', () => {
    test('is public, hides cancelled events, and reports each viewer\'s own registration', async () => {
      const open = await newEvent({ title: 'Open event' });
      const cancelled = await newEvent({ title: 'Cancelled event' });
      await register(open, tokens.student);
      await api.delete(`/api/events/${cancelled}`, { token: tokens.teacher });

      const anonymous = await api.get('/api/events');
      expect(anonymous.status).toBe(200);
      expect(anonymous.body.data.map((event) => event.title)).toEqual(['Open event']);
      expect(anonymous.body.data[0].is_registered).toBeUndefined();

      const asRegistered = await api.get('/api/events', { token: tokens.student });
      expect(asRegistered.body.data[0]).toMatchObject({ is_registered: true, registration_count: 1 });

      const asOther = await api.get('/api/events', { token: tokens.student2 });
      expect(asOther.body.data[0].is_registered).toBe(false);
    });

    test('GET /registrations/mine returns my events soonest-first', async () => {
      const later = await newEvent({ title: 'Later', event_date: isoDay(20) });
      const sooner = await newEvent({ title: 'Sooner', event_date: isoDay(2) });
      await newEvent({ title: 'Not mine' });
      await register(later, tokens.student);
      await register(sooner, tokens.student);

      const res = await api.get('/api/events/registrations/mine', { token: tokens.student });
      expect(res.body.data.map((event) => event.title)).toEqual(['Sooner', 'Later']);
      expect(res.body.data[0].registered_at).toBeTruthy();
      expect((await api.get('/api/events/registrations/mine')).status).toBe(401);
    });
  });

  describe('editing and cancelling', () => {
    test('only the organizer or an admin may edit or cancel', async () => {
      const id = await newEvent();
      expect((await api.put(`/api/events/${id}`, { title: 'Hijacked' }, { token: tokens.teacher2 })).status).toBe(403);
      expect((await api.delete(`/api/events/${id}`, { token: tokens.teacher2 })).status).toBe(403);
      expect((await api.put(`/api/events/${id}`, { title: 'Hack Night 2' }, { token: tokens.teacher })).status).toBe(200);
      expect((await api.put(`/api/events/${id}`, { location: 'Auditorium' }, { token: tokens.admin })).status).toBe(200);
    });

    test('moving the event tells everyone registered; a title-only edit does not', async () => {
      const id = await newEvent();
      await register(id, tokens.student);
      await register(id, tokens.student2);
      const base = firebase.__all('notifications').length;

      await api.put(`/api/events/${id}`, { title: 'Hack Night: renamed' }, { token: tokens.teacher });
      expect(firebase.__all('notifications')).toHaveLength(base);

      await api.put(`/api/events/${id}`, { event_date: isoDay(9) }, { token: tokens.teacher });
      const updates = firebase.__all('notifications').filter((item) => item.title === 'Event updated');
      expect(updates.map((item) => item.user_id).sort()).toEqual(['STU1', 'STU2']);
    });

    test('capacity cannot be lowered below the people already registered', async () => {
      const id = await newEvent({ max_participants: 5 });
      await register(id, tokens.student);
      await register(id, tokens.student2);

      expect((await api.put(`/api/events/${id}`, { max_participants: 1 }, { token: tokens.teacher })).status).toBe(409);
      expect((await api.put(`/api/events/${id}`, { max_participants: 2 }, { token: tokens.teacher })).status).toBe(200);
      expect((await api.put(`/api/events/${id}`, { max_participants: null }, { token: tokens.teacher })).status).toBe(200);
    });

    test('cancelling notifies attendees, closes registration, and is audited', async () => {
      const id = await newEvent();
      await register(id, tokens.student);

      expect((await api.delete(`/api/events/${id}`, { token: tokens.teacher })).status).toBe(200);

      expect(firebase.__read('events', id)).toMatchObject({ is_active: false, cancelled_by: 'TCH1' });
      expect(firebase.__all('notifications').some((item) => item.title === 'Event cancelled' && item.user_id === 'STU1')).toBe(true);
      expect((await register(id, tokens.student2)).status).toBe(404);
      expect(firebase.__all('activity_log').map((entry) => entry.action)).toEqual(expect.arrayContaining(['event_create', 'event_cancel']));
    });

    test('404 for a missing or already cancelled event', async () => {
      expect((await api.put('/api/events/missing', { title: 'Valid title' }, { token: tokens.teacher })).status).toBe(404);
      const id = await newEvent();
      await api.delete(`/api/events/${id}`, { token: tokens.teacher });
      expect((await api.delete(`/api/events/${id}`, { token: tokens.teacher })).status).toBe(404);
    });
  });

  test('registration documents use a deterministic id so the database itself refuses duplicates', () => {
    expect(registration.registrationId('E1', 'U1')).toBe('E1_U1');
  });
});
