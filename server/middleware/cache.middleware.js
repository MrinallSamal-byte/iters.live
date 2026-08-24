/**
 * Cache Middleware
 * Provides request/response caching for API routes
 */

const cacheService = require('../services/cache.service');

/**
 * Cache middleware factory
 * @param {Object} options - Caching options
 * @param {number} options.ttl - Time to live in seconds
 * @param {Function} options.keyGenerator - Function to generate cache key from request
 * @param {Function} options.shouldCache - Function to determine if response should be cached
 * @returns {Function} Express middleware
 */
function cacheMiddleware(options = {}) {
  const {
    ttl = 300, // 5 minutes default
    keyGenerator = defaultKeyGenerator,
    shouldCache = defaultShouldCache
  } = options;

  return async (req, res, next) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Generate cache key
    const cacheKey = keyGenerator(req);

    try {
      // Try to get from cache
      const cached = await cacheService.get(cacheKey);

      if (cached) {
        console.log(`[Cache] Hit: ${cacheKey}`);
        return res.json(cached);
      }

      console.log(`[Cache] Miss: ${cacheKey}`);

      // Store original json method
      const originalJson = res.json.bind(res);

      // Override json method to cache response
      res.json = function(data) {
        // Check if response should be cached
        if (shouldCache(req, res, data)) {
          // Cache the response asynchronously
          cacheService.set(cacheKey, data, ttl).catch(err => {
            console.error('[Cache] Error caching response:', err);
          });
        }

        // Call original json method
        return originalJson(data);
      };

      next();
    } catch (error) {
      console.error('[Cache] Middleware error:', error);
      next();
    }
  };
}

/**
 * Default cache key generator
 * @param {Object} req - Express request object
 * @returns {string} Cache key
 */
function defaultKeyGenerator(req) {
  const userId = req.user ? req.user.id : 'anonymous';
  const url = req.originalUrl || req.url;
  return `api:${userId}:${url}`;
}

/**
 * Default function to determine if response should be cached
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Object} data - Response data
 * @returns {boolean} Whether to cache the response
 */
function defaultShouldCache(req, res, data) {
  // Only cache successful responses
  return res.statusCode === 200 && data && data.success === true;
}

/**
 * Analytics cache middleware
 * Specialized caching for analytics endpoints with longer TTL
 */
function analyticsCacheMiddleware(ttl = 600) {
  return cacheMiddleware({
    ttl,
    keyGenerator: (req) => {
      const userId = req.user ? req.user.id : 'anonymous';
      const userRole = req.user ? req.user.role : 'guest';
      const url = req.originalUrl || req.url;
      // Include query params in cache key for analytics
      return `analytics:${userRole}:${userId}:${url}`;
    }
  });
}

module.exports = {
  cacheMiddleware,
  analyticsCacheMiddleware
};
