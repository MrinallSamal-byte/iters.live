/**
 * Calendar subscription tokens.
 *
 * Google Calendar, Apple Calendar and Outlook subscribe to a plain URL and
 * cannot send an Authorization header, so the iCal feed needs a credential that
 * lives in the URL itself. That credential is a signed token with its own
 * audience (it can never be used as an API session) which is:
 *   - revocable: it embeds a per-user feed version; "reset link" bumps it,
 *   - bound to the live account: a deactivated user's feed stops working.
 */

const jwt = require('jsonwebtoken');
const { getRecord, updateRecord, isValidDocId } = require('./firebase-data.service');

const FEED_AUDIENCE = 'iter-calendar-feed';
const FEED_ISSUER = 'iterasn-hub';
const FEED_TYPE = 'calendar-feed';

function feedSecret() {
  // Set (or generated for development) when middleware/auth loads utils/app-session.
  return process.env.JWT_SECRET;
}

function feedTtl() {
  return process.env.CALENDAR_FEED_TTL || '365d';
}

function versionOf(record) {
  const version = Number(record && record.calendar_feed_version);
  return Number.isInteger(version) && version >= 1 ? version : 1;
}

function createFeedToken(user, version = 1) {
  return jwt.sign(
    {
      typ: FEED_TYPE,
      fv: version,
      // Fallback identity for accounts that have no stored record (demo mode).
      u: {
        id: user.id,
        role: user.role,
        department: user.department || null,
        year: user.year ?? null,
        section: user.section || null,
        registration_number: user.registration_number || null
      }
    },
    feedSecret(),
    {
      subject: String(user.id),
      audience: FEED_AUDIENCE,
      issuer: FEED_ISSUER,
      expiresIn: feedTtl()
    }
  );
}

/**
 * @returns {{ id: string, fv: number, claims: object }}  throws when invalid
 */
function verifyFeedToken(token) {
  const payload = jwt.verify(token, feedSecret(), {
    audience: FEED_AUDIENCE,
    issuer: FEED_ISSUER
  });

  if (payload.typ !== FEED_TYPE || !payload.sub) {
    throw new Error('Not a calendar feed token');
  }
  return { id: String(payload.sub), fv: Number(payload.fv) || 1, claims: payload.u || {} };
}

/**
 * Turn a feed token into the user the feed is built for, or null when the
 * token is invalid, revoked, or the account is inactive.
 */
async function resolveFeedUser(token) {
  let parsed;
  try {
    parsed = verifyFeedToken(token);
  } catch (_) {
    return null;
  }

  const record = isValidDocId(parsed.id) ? await getRecord('users', parsed.id) : null;
  if (!record) {
    // No stored record (demo mode): trust the signed claims.
    return parsed.fv === 1 ? { ...parsed.claims, id: parsed.id } : null;
  }

  if (record.is_active === false) return null;
  if (versionOf(record) !== parsed.fv) return null;

  return {
    id: parsed.id,
    name: record.name,
    role: record.role,
    department: record.department || null,
    year: record.year ?? null,
    section: record.section || null,
    registration_number: record.registration_number || null
  };
}

async function currentFeedVersion(userId) {
  const record = isValidDocId(userId) ? await getRecord('users', userId) : null;
  return versionOf(record);
}

/**
 * Invalidate every previously issued feed link for this user and return the
 * version a replacement link should carry.
 */
async function rotateFeedVersion(userId) {
  const next = (await currentFeedVersion(userId)) + 1;
  await updateRecord('users', userId, { calendar_feed_version: next });
  return next;
}

module.exports = {
  FEED_AUDIENCE,
  createFeedToken,
  verifyFeedToken,
  resolveFeedUser,
  currentFeedVersion,
  rotateFeedVersion
};
