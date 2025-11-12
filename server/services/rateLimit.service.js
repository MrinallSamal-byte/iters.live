const rateLimit = require('express-rate-limit');
const db = require('../database/db');

/**
 * Advanced rate limiting with per-user tracking and account lockout
 */

// Store for tracking failed login attempts
const failedAttempts = new Map();
const lockedAccounts = new Map();

// Configuration
const config = {
  maxLoginAttempts: 5,
  lockoutDurationMinutes: 30,
  loginWindowMinutes: 15,
  accountLockoutAttempts: 10,
  accountLockoutDurationHours: 24
};

/**
 * Track failed login attempt
 */
async function trackFailedLogin(identifier, ipAddress) {
  const key = `${identifier}:${ipAddress}`;
  const now = Date.now();

  // Clean old attempts
  cleanOldAttempts();

  // Get or create attempt record
  let attempts = failedAttempts.get(key) || {
    count: 0,
    firstAttempt: now,
    attempts: []
  };

  attempts.count++;
  attempts.attempts.push(now);

  // Check if within time window
  const windowStart = now - (config.loginWindowMinutes * 60 * 1000);
  attempts.attempts = attempts.attempts.filter(time => time > windowStart);
  attempts.count = attempts.attempts.length;

  failedAttempts.set(key, attempts);

  // Check if should lock account
  if (attempts.count >= config.maxLoginAttempts) {
    const lockUntil = now + (config.lockoutDurationMinutes * 60 * 1000);
    lockedAccounts.set(identifier, lockUntil);

    // Log to database
    try {
      await db.query(
        `INSERT INTO account_lockouts (identifier, ip_address, locked_until, reason)
         VALUES (?, ?, FROM_UNIXTIME(?), 'Too many failed login attempts')`,
        [identifier, ipAddress, Math.floor(lockUntil / 1000)]
      );
    } catch (error) {
      console.error('Failed to log account lockout:', error);
    }

    return {
      locked: true,
      remainingAttempts: 0,
      lockoutMinutes: config.lockoutDurationMinutes
    };
  }

  return {
    locked: false,
    remainingAttempts: config.maxLoginAttempts - attempts.count,
    attemptsCount: attempts.count
  };
}

/**
 * Check if account is locked
 */
function isAccountLocked(identifier) {
  const lockUntil = lockedAccounts.get(identifier);
  
  if (!lockUntil) {
    return { locked: false };
  }

  const now = Date.now();
  
  if (now >= lockUntil) {
    // Lock expired, remove it
    lockedAccounts.delete(identifier);
    failedAttempts.delete(identifier);
    return { locked: false };
  }

  const remainingMinutes = Math.ceil((lockUntil - now) / (60 * 1000));
  
  return {
    locked: true,
    remainingMinutes
  };
}

/**
 * Clear failed attempts on successful login
 */
function clearFailedAttempts(identifier, ipAddress) {
  const key = `${identifier}:${ipAddress}`;
  failedAttempts.delete(key);
  lockedAccounts.delete(identifier);
}

/**
 * Clean old attempts from memory
 */
function cleanOldAttempts() {
  const now = Date.now();
  const cutoff = now - (config.loginWindowMinutes * 60 * 1000);

  for (const [key, data] of failedAttempts.entries()) {
    data.attempts = data.attempts.filter(time => time > cutoff);
    if (data.attempts.length === 0) {
      failedAttempts.delete(key);
    } else {
      data.count = data.attempts.length;
      failedAttempts.set(key, data);
    }
  }

  // Clean expired locks
  for (const [identifier, lockUntil] of lockedAccounts.entries()) {
    if (now >= lockUntil) {
      lockedAccounts.delete(identifier);
    }
  }
}

/**
 * Per-user rate limiter
 */
const createUserRateLimiter = (options = {}) => {
  const {
    windowMs = 15 * 60 * 1000, // 15 minutes
    max = 100, // limit each user to 100 requests per windowMs
    message = 'Too many requests, please try again later',
    skipSuccessfulRequests = false,
    skipFailedRequests = false
  } = options;

  return rateLimit({
    windowMs,
    max,
    message: { success: false, message },
    skipSuccessfulRequests,
    skipFailedRequests,
    keyGenerator: (req) => {
      // Use user ID if authenticated, otherwise IP
      return req.user ? `user:${req.user.id}` : `ip:${req.ip}`;
    },
    handler: (req, res) => {
      res.status(429).json({
        success: false,
        message,
        retryAfter: Math.ceil(windowMs / 1000)
      });
    }
  });
};

/**
 * Strict rate limiter for sensitive operations
 */
const strictRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per 15 minutes
  skipSuccessfulRequests: true,
  keyGenerator: (req) => {
    return req.user ? `user:${req.user.id}` : `ip:${req.ip}`;
  },
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: 'Too many attempts. Please try again after 15 minutes.',
      retryAfter: 900
    });
  }
});

/**
 * Login rate limiter
 */
const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 login attempts per 15 minutes
  skipSuccessfulRequests: true,
  keyGenerator: (req) => {
    return req.body.identifier || req.ip;
  },
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: 'Too many login attempts. Please try again after 15 minutes.',
      retryAfter: 900
    });
  }
});

/**
 * API rate limiter
 */
const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.user ? `user:${req.user.id}` : `ip:${req.ip}`;
  },
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: 'API rate limit exceeded. Please slow down.',
      retryAfter: 60
    });
  }
});

/**
 * File upload rate limiter
 */
const uploadRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50, // 50 uploads per hour
  skipSuccessfulRequests: false,
  keyGenerator: (req) => {
    return req.user ? `user:${req.user.id}` : `ip:${req.ip}`;
  },
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: 'Upload limit exceeded. Please try again after 1 hour.',
      retryAfter: 3600
    });
  }
});

/**
 * Get rate limit status for user
 */
async function getRateLimitStatus(userId) {
  // This would integrate with your rate limiting store
  // For now, return a placeholder
  return {
    userId,
    limits: {
      api: { max: 60, remaining: 60, reset: Date.now() + 60000 },
      uploads: { max: 50, remaining: 50, reset: Date.now() + 3600000 }
    }
  };
}

// Clean up old data periodically (every 30 minutes)
setInterval(cleanOldAttempts, 30 * 60 * 1000);

module.exports = {
  trackFailedLogin,
  isAccountLocked,
  clearFailedAttempts,
  createUserRateLimiter,
  strictRateLimiter,
  loginRateLimiter,
  apiRateLimiter,
  uploadRateLimiter,
  getRateLimitStatus,
  config
};
