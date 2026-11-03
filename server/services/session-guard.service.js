/**
 * Session guard
 *
 * App session tokens are self-contained JWTs (valid for days). Without a
 * server-side check, deactivating a user, demoting an admin, or forcing a
 * logout would have no effect until the token expired. This guard re-checks
 * the live user record on every authenticated request, with a short in-process
 * cache so it costs at most one document read per user per TTL window.
 *
 * Rules applied to a valid token:
 *   1. account `is_active === false`                       -> denied ("inactive")
 *   2. token issued before `sessions_revoked_at`           -> denied ("revoked")
 *   3. otherwise the live role/department/etc. replace the stale token claims
 *
 * Demo-mode tokens and users without a stored record (e.g. portal-only
 * sessions) are passed through unchanged. If the lookup itself fails the
 * request is allowed (fail-open): the token is cryptographically valid and a
 * datastore outage should not log everybody out.
 */

const NodeCache = require('node-cache');
const { getRecord, updateRecord } = require('./firebase-data.service');

const LIVE_USER_TTL_SECONDS = Math.max(1, Number(process.env.SESSION_GUARD_TTL_SECONDS) || 30);

const liveUserCache = new NodeCache({
  stdTTL: LIVE_USER_TTL_SECONDS,
  checkperiod: 60,
  useClones: false
});

const MISSING = Object.freeze({ missing: true });

// Claims that may be refreshed from the stored record. Credentials and any
// other stored fields are deliberately excluded.
const LIVE_FIELDS = [
  'role',
  'department',
  'year',
  'section',
  'semester',
  'name',
  'email',
  'phone_number',
  'profile_picture'
];

function userIdOf(user) {
  return user?.id || user?.uid || user?.registration_number || null;
}

async function loadLiveUser(userId) {
  const key = String(userId);
  const cached = liveUserCache.get(key);
  if (cached !== undefined) {
    return cached === MISSING ? null : cached;
  }

  const record = await getRecord('users', key, { preferRealtime: false });
  liveUserCache.set(key, record || MISSING);
  return record || null;
}

function invalidateLiveUser(userId) {
  if (userId === undefined || userId === null) return;
  liveUserCache.del(String(userId));
}

function clearLiveUserCache() {
  liveUserCache.flushAll();
}

/**
 * Decide whether a verified app-session token may still be used.
 *
 * @param {object} sessionUser   user claims embedded in the token
 * @param {object} tokenPayload  decoded JWT payload (needs `iat`, `demoMode`)
 * @returns {Promise<{allowed: boolean, reason?: string, user?: object}>}
 */
async function evaluateSession(sessionUser, tokenPayload = {}) {
  if (!sessionUser) {
    return { allowed: false, reason: 'invalid' };
  }

  if (tokenPayload.demoMode) {
    return { allowed: true, user: sessionUser };
  }

  const userId = userIdOf(sessionUser);
  if (!userId) {
    return { allowed: true, user: sessionUser };
  }

  let record;
  try {
    record = await loadLiveUser(userId);
  } catch (error) {
    console.warn(`Session guard lookup failed for ${userId}; allowing request: ${error.message}`);
    return { allowed: true, user: sessionUser };
  }

  if (!record) {
    return { allowed: true, user: sessionUser };
  }

  if (record.is_active === false) {
    return { allowed: false, reason: 'inactive' };
  }

  const revokedAt = Date.parse(record.sessions_revoked_at || '');
  if (!Number.isNaN(revokedAt) && Number.isFinite(tokenPayload.iat)
    && tokenPayload.iat < Math.floor(revokedAt / 1000)) {
    return { allowed: false, reason: 'revoked' };
  }

  const user = { ...sessionUser };
  for (const field of LIVE_FIELDS) {
    if (record[field] !== undefined && record[field] !== null) {
      user[field] = record[field];
    }
  }
  return { allowed: true, user };
}

/**
 * Invalidate every token issued before now for this user.
 * Returns the ISO timestamp that was stored.
 */
async function revokeUserSessions(userId) {
  const revokedAt = new Date().toISOString();
  await updateRecord('users', userId, { sessions_revoked_at: revokedAt });
  invalidateLiveUser(userId);
  return revokedAt;
}

module.exports = {
  LIVE_USER_TTL_SECONDS,
  evaluateSession,
  invalidateLiveUser,
  clearLiveUserCache,
  revokeUserSessions
};
