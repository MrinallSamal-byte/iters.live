/** @jest-environment node */

jest.mock('../database/firebase', () => require('../test-utils/fake-firebase').createFirebaseMock());

const bcrypt = require('bcrypt');
const firebase = require('../database/firebase');
const guard = require('../services/session-guard.service');
const router = require('../routes/auth.routes');
const { startHarness } = require('../test-utils/route-harness');
const { tokenFor, USERS } = require('../test-utils/fixtures');

describe('auth routes', () => {
  let api;

  beforeAll(() => {
    api = startHarness('/api/auth', router);
  });

  afterAll(() => api.close());

  beforeEach(() => {
    firebase.__reset();
    guard.clearLiveUserCache();
    firebase.auth.verifyIdToken.mockReset();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => jest.restoreAllMocks());

  describe('POST /register-student', () => {
    const valid = {
      name: 'New Student',
      registration_number: 'STU555',
      email: 'new@iter.edu',
      password: 'secret12',
      department: 'CSE',
      year: '2',
      section: 'B'
    };

    test('rejects invalid input instead of silently accepting it', async () => {
      const res = await api.post('/api/auth/register-student', {
        name: '', registration_number: 'a/b', email: 'not-an-email', password: '1'
      });

      expect(res.status).toBe(400);
      const fields = res.body.errors.map((error) => error.path);
      expect(fields).toEqual(expect.arrayContaining(['name', 'registration_number', 'email', 'password']));
      expect(firebase.__all('users')).toHaveLength(0);
    });

    test('creates the student with a hashed password and a numeric year', async () => {
      const res = await api.post('/api/auth/register-student', valid);

      expect(res.status).toBe(201);
      const stored = firebase.__read('users', 'STU555');
      expect(stored.year).toBe(2);
      expect(stored.password).not.toBe('secret12');
      await expect(bcrypt.compare('secret12', stored.password)).resolves.toBe(true);
      expect(res.body.data.user.password).toBeUndefined();
    });

    test('does not store undefined fields when department/year are omitted', async () => {
      const res = await api.post('/api/auth/register-student', {
        name: 'Minimal', registration_number: 'STU556', email: 'min@iter.edu', password: 'secret12'
      });

      expect(res.status).toBe(201);
      expect(firebase.__read('users', 'STU556')).toMatchObject({ department: null, year: null, section: null });
    });

    test('a second registration with the same number is a 409', async () => {
      await api.post('/api/auth/register-student', valid);
      const res = await api.post('/api/auth/register-student', valid);
      expect(res.status).toBe(409);
    });
  });

  describe('POST /login', () => {
    beforeEach(async () => {
      firebase.__seed('users', 'STU1', { ...USERS.student, password: await bcrypt.hash('Student@123', 4) });
      firebase.__seed('users', 'GOOGLE_AB12', { id: 'GOOGLE_AB12', name: 'G', role: 'student', is_active: true });
    });

    test('valid credentials return a session', async () => {
      const res = await api.post('/api/auth/login', { registration_number: 'STU1', password: 'Student@123' });
      expect(res.status).toBe(200);
      expect(res.body.data.appAccessToken).toBeTruthy();
      expect(res.body.data.user.password).toBeUndefined();
    });

    test('a wrong password is a 401', async () => {
      const res = await api.post('/api/auth/login', { registration_number: 'STU1', password: 'nope' });
      expect(res.status).toBe(401);
    });

    test('an account without a password hash (Google sign-in) is a 401, not a server error', async () => {
      const res = await api.post('/api/auth/login', { registration_number: 'GOOGLE_AB12', password: 'anything' });
      expect(res.status).toBe(401);
    });

    test('a registration number that cannot be a document id is a 401, not a server error', async () => {
      const res = await api.post('/api/auth/login', { registration_number: 'a/b', password: 'x' });
      expect(res.status).toBe(401);
    });

    test('an inactive account is refused with 403 after the password is verified', async () => {
      firebase.__seed('users', 'STU1', { ...USERS.student, is_active: false, password: await bcrypt.hash('Student@123', 4) });
      const res = await api.post('/api/auth/login', { registration_number: 'STU1', password: 'Student@123' });
      expect(res.status).toBe(403);
    });

    test('non-string credentials are rejected', async () => {
      const res = await api.post('/api/auth/login', { registration_number: { $ne: '' }, password: ['x'] });
      expect(res.status).toBe(400);
    });
  });

  describe('POST /google-login', () => {
    test('a deactivated account cannot sign in with Google', async () => {
      firebase.__seed('users', 'STU1', { ...USERS.student, is_active: false });
      firebase.auth.verifyIdToken.mockResolvedValue({ uid: 'g1', email: USERS.student.email, name: 'Asha', email_verified: true });

      const res = await api.post('/api/auth/google-login', { idToken: 'token' });
      expect(res.status).toBe(403);
    });

    test('an invalid ID token is a 401', async () => {
      firebase.auth.verifyIdToken.mockRejectedValue(new Error('bad token'));
      const res = await api.post('/api/auth/google-login', { idToken: 'bad' });
      expect(res.status).toBe(401);
    });

    test('a token without an email is a 400', async () => {
      firebase.auth.verifyIdToken.mockResolvedValue({ uid: 'g2' });
      const res = await api.post('/api/auth/google-login', { idToken: 'token' });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /me', () => {
    test('works for app-session tokens (which carry id, not uid)', async () => {
      firebase.__seed('users', 'STU1', { ...USERS.student, password: 'hash', password_hash: 'legacy-hash' });

      const res = await api.get('/api/auth/me', { token: tokenFor(USERS.student) });

      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({ id: 'STU1', name: 'Asha Student' });
      expect(res.body.data.password).toBeUndefined();
      expect(res.body.data.password_hash).toBeUndefined();
    });
  });

  describe('POST /logout-all', () => {
    test('ends every session issued before now, including the caller\'s own token', async () => {
      firebase.__seed('users', 'STU1', { ...USERS.student });
      const token = tokenFor(USERS.student);

      // Make the existing token strictly older than the revocation moment.
      await new Promise((resolve) => setTimeout(resolve, 1100));

      const res = await api.post('/api/auth/logout-all', {}, { token });
      expect(res.status).toBe(200);
      expect(firebase.__read('users', 'STU1').sessions_revoked_at).toBeTruthy();

      const after = await api.get('/api/auth/me', { token });
      expect(after.status).toBe(401);
      expect(after.body.code).toBe('SESSION_REVOKED');
    }, 15000);
  });
});
