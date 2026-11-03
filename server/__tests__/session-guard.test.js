/** @jest-environment node */

jest.mock('../database/firebase', () => require('../test-utils/fake-firebase').createFirebaseMock());

const firebase = require('../database/firebase');
const express = require('express');
const guard = require('../services/session-guard.service');
const { authMiddleware, optionalAuth, roleMiddleware } = require('../middleware/auth');
const { startHarness } = require('../test-utils/route-harness');
const { tokenFor, USERS } = require('../test-utils/fixtures');
const { verifyAppSessionToken } = require('../utils/app-session');

function seedUser(user, extra = {}) {
  firebase.__seed('users', user.id, { ...user, password: 'bcrypt-hash-must-never-leak', ...extra });
}

describe('session guard', () => {
  beforeEach(() => {
    firebase.__reset();
    guard.clearLiveUserCache();
  });

  test('a normal active session is allowed', async () => {
    seedUser(USERS.student);
    const token = tokenFor(USERS.student);
    const payload = verifyAppSessionToken(token);

    const verdict = await guard.evaluateSession(payload.user, payload);
    expect(verdict.allowed).toBe(true);
  });

  test('a deactivated account is denied even though its token is still valid', async () => {
    seedUser(USERS.student, { is_active: false });
    const payload = verifyAppSessionToken(tokenFor(USERS.student));

    await expect(guard.evaluateSession(payload.user, payload)).resolves.toEqual({ allowed: false, reason: 'inactive' });
  });

  test('tokens issued before sessions_revoked_at are denied; later ones are accepted', async () => {
    seedUser(USERS.student);
    const oldPayload = verifyAppSessionToken(tokenFor(USERS.student));

    // Revoke "in the future" relative to the old token's iat.
    firebase.__seed('users', 'STU1', {
      ...USERS.student,
      sessions_revoked_at: new Date((oldPayload.iat + 5) * 1000).toISOString()
    });
    guard.clearLiveUserCache();

    await expect(guard.evaluateSession(oldPayload.user, oldPayload)).resolves.toMatchObject({ allowed: false, reason: 'revoked' });

    const freshPayload = { ...oldPayload, iat: oldPayload.iat + 10 };
    await expect(guard.evaluateSession(oldPayload.user, freshPayload)).resolves.toMatchObject({ allowed: true });
  });

  test('revokeUserSessions stores a timestamp and takes effect immediately in this process', async () => {
    seedUser(USERS.student);
    const payload = verifyAppSessionToken(tokenFor(USERS.student));
    await guard.evaluateSession(payload.user, payload); // warm the cache

    // Move the token into the past so "revoked now" is strictly later than its iat.
    const aged = { ...payload, iat: Math.floor(Date.now() / 1000) - 60 };
    await guard.revokeUserSessions('STU1');

    expect(firebase.__read('users', 'STU1').sessions_revoked_at).toBeTruthy();
    await expect(guard.evaluateSession(payload.user, aged)).resolves.toMatchObject({ allowed: false, reason: 'revoked' });
  });

  test('live role and department replace stale token claims, but credentials never leak in', async () => {
    seedUser(USERS.student, { role: 'teacher', department: 'ECE' });
    const payload = verifyAppSessionToken(tokenFor(USERS.student));

    const verdict = await guard.evaluateSession(payload.user, payload);
    expect(verdict.user).toMatchObject({ role: 'teacher', department: 'ECE' });
    expect(verdict.user.password).toBeUndefined();
  });

  test('demo-mode tokens and users without a stored record pass through untouched', async () => {
    const demo = await guard.evaluateSession(USERS.student, { demoMode: true, iat: 1 });
    expect(demo).toMatchObject({ allowed: true });

    const unknown = await guard.evaluateSession({ id: 'GHOST', role: 'student' }, { iat: 1 });
    expect(unknown).toMatchObject({ allowed: true });
  });

  test('fails open (and says so) when the lookup itself errors', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const original = firebase.db.collection;
    firebase.db.collection = () => { throw new Error('datastore down'); };

    try {
      const verdict = await guard.evaluateSession({ id: 'STU9', role: 'student' }, { iat: 1 });
      expect(verdict.allowed).toBe(true);
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('datastore down'));
    } finally {
      firebase.db.collection = original;
      warn.mockRestore();
    }
  });

  test('caches the lookup so repeated requests cost one read', async () => {
    seedUser(USERS.student);
    const payload = verifyAppSessionToken(tokenFor(USERS.student));
    firebase.__stats.documentsRead = 0;

    await guard.evaluateSession(payload.user, payload);
    await guard.evaluateSession(payload.user, payload);
    await guard.evaluateSession(payload.user, payload);

    expect(firebase.__stats.documentsRead).toBe(1);
  });
});

describe('auth middleware', () => {
  let api;

  beforeAll(() => {
    const router = express.Router();
    router.get('/me', authMiddleware, (req, res) => res.json({ user: req.user }));
    router.get('/admin-only', authMiddleware, roleMiddleware('admin'), (req, res) => res.json({ ok: true }));
    router.get('/array-roles', authMiddleware, roleMiddleware(['teacher', 'admin']), (req, res) => res.json({ ok: true }));
    router.get('/optional', optionalAuth, (req, res) => res.json({ user: req.user || null }));
    api = startHarness('/t', router);
  });

  afterAll(() => api.close());

  beforeEach(() => {
    firebase.__reset();
    guard.clearLiveUserCache();
  });

  test('rejects a request without a token', async () => {
    const res = await api.get('/t/me');
    expect(res.status).toBe(401);
  });

  test('a deactivated user gets 403 on the very next request', async () => {
    seedUser(USERS.student);
    const token = tokenFor(USERS.student);
    expect((await api.get('/t/me', { token })).status).toBe(200);

    firebase.__seed('users', 'STU1', { ...USERS.student, is_active: false });
    guard.invalidateLiveUser('STU1');

    const res = await api.get('/t/me', { token });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('ACCOUNT_INACTIVE');
  });

  test('a revoked session gets 401 with a SESSION_REVOKED code', async () => {
    seedUser(USERS.student, { sessions_revoked_at: new Date(Date.now() + 60_000).toISOString() });
    const res = await api.get('/t/me', { token: tokenFor(USERS.student) });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('SESSION_REVOKED');
  });

  test('a demoted admin loses admin access immediately (live role wins over the token)', async () => {
    seedUser(USERS.admin);
    const token = tokenFor(USERS.admin);
    expect((await api.get('/t/admin-only', { token })).status).toBe(200);

    firebase.__seed('users', 'ADM1', { ...USERS.admin, role: 'student' });
    guard.invalidateLiveUser('ADM1');

    expect((await api.get('/t/admin-only', { token })).status).toBe(403);
  });

  test('req.user never carries a password hash', async () => {
    seedUser(USERS.student);
    const res = await api.get('/t/me', { token: tokenFor(USERS.student) });
    expect(res.body.user.password).toBeUndefined();
    expect(res.body.user.password_hash).toBeUndefined();
  });

  test('roleMiddleware accepts an array of roles (the bulk routes pass one)', async () => {
    seedUser(USERS.teacher);
    seedUser(USERS.student);

    expect((await api.get('/t/array-roles', { token: tokenFor(USERS.teacher) })).status).toBe(200);
    expect((await api.get('/t/array-roles', { token: tokenFor(USERS.student) })).status).toBe(403);
  });

  test('optionalAuth treats a revoked session as a guest', async () => {
    seedUser(USERS.student, { is_active: false });
    const res = await api.get('/t/optional', { token: tokenFor(USERS.student) });
    expect(res.status).toBe(200);
    expect(res.body.user).toBeNull();
  });
});
