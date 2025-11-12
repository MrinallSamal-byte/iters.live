const NodeCache = require('node-cache');

/**
 * Caching service for frequently accessed data
 * Uses in-memory cache with TTL support
 */

class CacheService {
  constructor() {
    // Main cache with 10 minute TTL
    this.cache = new NodeCache({
      stdTTL: 600, // 10 minutes
      checkperiod: 120, // Check for expired keys every 2 minutes
      useClones: false // Don't clone objects (better performance)
    });

    // Short-lived cache for API responses (1 minute)
    this.apiCache = new NodeCache({
      stdTTL: 60,
      checkperiod: 20
    });

    // Long-lived cache for static data (1 hour)
    this.staticCache = new NodeCache({
      stdTTL: 3600,
      checkperiod: 600
    });

    // Session cache
    this.sessionCache = new NodeCache({
      stdTTL: 1800, // 30 minutes
      checkperiod: 300
    });

    this.setupEventListeners();
  }

  setupEventListeners() {
    // Log cache statistics
    this.cache.on('expired', (key, value) => {
      if (process.env.NODE_ENV === 'development') {
        console.log(`Cache expired: ${key}`);
      }
    });

    this.cache.on('flush', () => {
      if (process.env.NODE_ENV === 'development') {
        console.log('Cache flushed');
      }
    });
  }

  /**
   * Get value from cache
   */
  get(key) {
    try {
      return this.cache.get(key);
    } catch (error) {
      console.error('Cache get error:', error);
      return undefined;
    }
  }

  /**
   * Set value in cache
   */
  set(key, value, ttl = null) {
    try {
      if (ttl) {
        return this.cache.set(key, value, ttl);
      }
      return this.cache.set(key, value);
    } catch (error) {
      console.error('Cache set error:', error);
      return false;
    }
  }

  /**
   * Delete value from cache
   */
  del(key) {
    try {
      return this.cache.del(key);
    } catch (error) {
      console.error('Cache delete error:', error);
      return 0;
    }
  }

  /**
   * Delete multiple keys
   */
  delMultiple(keys) {
    try {
      return this.cache.del(keys);
    } catch (error) {
      console.error('Cache delete multiple error:', error);
      return 0;
    }
  }

  /**
   * Check if key exists
   */
  has(key) {
    return this.cache.has(key);
  }

  /**
   * Get or set pattern: Get from cache, or execute function and cache result
   */
  async getOrSet(key, fetchFunction, ttl = null) {
    const cached = this.get(key);
    
    if (cached !== undefined) {
      return cached;
    }

    try {
      const value = await fetchFunction();
      this.set(key, value, ttl);
      return value;
    } catch (error) {
      console.error('Cache getOrSet error:', error);
      throw error;
    }
  }

  /**
   * Invalidate cache by pattern
   */
  invalidatePattern(pattern) {
    try {
      const keys = this.cache.keys();
      const matchingKeys = keys.filter(key => {
        if (typeof pattern === 'string') {
          return key.includes(pattern);
        } else if (pattern instanceof RegExp) {
          return pattern.test(key);
        }
        return false;
      });

      return this.cache.del(matchingKeys);
    } catch (error) {
      console.error('Cache invalidate pattern error:', error);
      return 0;
    }
  }

  /**
   * Flush all cache
   */
  flush() {
    try {
      this.cache.flushAll();
      this.apiCache.flushAll();
      this.staticCache.flushAll();
      return true;
    } catch (error) {
      console.error('Cache flush error:', error);
      return false;
    }
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      main: this.cache.getStats(),
      api: this.apiCache.getStats(),
      static: this.staticCache.getStats(),
      session: this.sessionCache.getStats()
    };
  }

  /**
   * API response caching methods
   */
  getApi(key) {
    return this.apiCache.get(key);
  }

  setApi(key, value, ttl = 60) {
    return this.apiCache.set(key, value, ttl);
  }

  delApi(key) {
    return this.apiCache.del(key);
  }

  /**
   * Static data caching methods
   */
  getStatic(key) {
    return this.staticCache.get(key);
  }

  setStatic(key, value, ttl = 3600) {
    return this.staticCache.set(key, value, ttl);
  }

  delStatic(key) {
    return this.staticCache.del(key);
  }

  /**
   * Session caching methods
   */
  getSession(key) {
    return this.sessionCache.get(key);
  }

  setSession(key, value, ttl = 1800) {
    return this.sessionCache.set(key, value, ttl);
  }

  delSession(key) {
    return this.sessionCache.del(key);
  }

  /**
   * Convenience methods for common cache keys
   */
  
  // User data caching
  getUserData(userId) {
    return this.get(`user:${userId}`);
  }

  setUserData(userId, data, ttl = 600) {
    return this.set(`user:${userId}`, data, ttl);
  }

  invalidateUserData(userId) {
    return this.del(`user:${userId}`);
  }

  // Attendance caching
  getAttendance(studentId, subject = null) {
    const key = subject 
      ? `attendance:${studentId}:${subject}`
      : `attendance:${studentId}`;
    return this.get(key);
  }

  setAttendance(studentId, data, subject = null, ttl = 300) {
    const key = subject 
      ? `attendance:${studentId}:${subject}`
      : `attendance:${studentId}`;
    return this.set(key, data, ttl);
  }

  invalidateAttendance(studentId, subject = null) {
    if (subject) {
      return this.del(`attendance:${studentId}:${subject}`);
    } else {
      return this.invalidatePattern(`attendance:${studentId}`);
    }
  }

  // Marks caching
  getMarks(studentId, subject = null) {
    const key = subject 
      ? `marks:${studentId}:${subject}`
      : `marks:${studentId}`;
    return this.get(key);
  }

  setMarks(studentId, data, subject = null, ttl = 300) {
    const key = subject 
      ? `marks:${studentId}:${subject}`
      : `marks:${studentId}`;
    return this.set(key, data, ttl);
  }

  invalidateMarks(studentId, subject = null) {
    if (subject) {
      return this.del(`marks:${studentId}:${subject}`);
    } else {
      return this.invalidatePattern(`marks:${studentId}`);
    }
  }

  // Timetable caching
  getTimetable(department, year, section) {
    return this.getStatic(`timetable:${department}:${year}:${section}`);
  }

  setTimetable(department, year, section, data) {
    return this.setStatic(`timetable:${department}:${year}:${section}`, data);
  }

  invalidateTimetable(department = null, year = null, section = null) {
    if (department && year && section) {
      return this.delStatic(`timetable:${department}:${year}:${section}`);
    } else if (department) {
      return this.invalidatePattern(`timetable:${department}`);
    } else {
      return this.invalidatePattern('timetable:');
    }
  }

  // Files caching
  getFilesList(category = null) {
    const key = category ? `files:${category}` : 'files:all';
    return this.get(key);
  }

  setFilesList(data, category = null, ttl = 300) {
    const key = category ? `files:${category}` : 'files:all';
    return this.set(key, data, ttl);
  }

  invalidateFiles(category = null) {
    if (category) {
      return this.del(`files:${category}`);
    } else {
      return this.invalidatePattern('files:');
    }
  }

  // Analytics caching
  getAnalytics(type, params = {}) {
    const key = `analytics:${type}:${JSON.stringify(params)}`;
    return this.get(key);
  }

  setAnalytics(type, params, data, ttl = 600) {
    const key = `analytics:${type}:${JSON.stringify(params)}`;
    return this.set(key, data, ttl);
  }

  invalidateAnalytics() {
    return this.invalidatePattern('analytics:');
  }
}

// Export singleton instance
module.exports = new CacheService();
