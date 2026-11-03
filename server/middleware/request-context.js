/**
 * Request-scoped helpers: correlation ids, log-safe URLs and rate-limit keys.
 */

const crypto = require('crypto');
const { verifyAppSessionToken } = require('../utils/app-session');

// Accept an upstream id (load balancer, client) only if it is short and boring.
const SAFE_REQUEST_ID = /^[A-Za-z0-9._-]{8,64}$/;

// Query parameters that carry credentials and must never reach a log line.
const SENSITIVE_QUERY_PARAMS = ['token', 'access_token', 'accessToken', 'idToken', 'password', 'key'];

/**
 * Give every request an id, echo it as X-Request-Id and expose it as req.id so
 * a user's "something went wrong" report can be matched to one log line.
 */
function requestId(req, res, next) {
  const incoming = req.headers['x-request-id'];
  req.id = typeof incoming === 'string' && SAFE_REQUEST_ID.test(incoming)
    ? incoming
    : crypto.randomUUID();
  res.setHeader('X-Request-Id', req.id);
  next();
}

/**
 * The request URL with credential-bearing query values replaced. Calendar
 * subscription links carry a token in the URL, so access logs must not.
 */
function redactUrl(url = '') {
  const queryStart = url.indexOf('?');
  if (queryStart === -1) return url;

  const path = url.slice(0, queryStart);
  const params = new URLSearchParams(url.slice(queryStart + 1));
  for (const name of SENSITIVE_QUERY_PARAMS) {
    if (params.has(name)) params.set(name, '[redacted]');
  }
  const query = params.toString().replace(/%5Bredacted%5D/g, '[redacted]');
  return query ? `${path}?${query}` : path;
}

/**
 * Rate-limit bucket for a request.
 *
 * Keying purely on IP puts everyone behind one campus NAT into a single
 * bucket, so a few busy students lock out the rest. A request carrying a valid
 * session is counted against that user; everyone else against their IP. Only a
 * *verified* token is trusted for this, so forging tokens cannot be used to
 * escape the per-IP limit.
 */
function rateLimitKey(req) {
  const header = req.headers && req.headers.authorization;
  if (typeof header === 'string' && header.startsWith('Bearer ')) {
    try {
      const session = verifyAppSessionToken(header.substring(7));
      const userId = session && session.user && (session.user.id || session.user.registration_number);
      if (userId) return `user:${userId}`;
    } catch (_) {
      // Not a valid app-session token: fall back to the IP bucket.
    }
  }
  return `ip:${req.ip}`;
}

module.exports = {
  requestId,
  redactUrl,
  rateLimitKey,
  SENSITIVE_QUERY_PARAMS
};
