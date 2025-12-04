/**
 * Caching service for frequently accessed data
 * Uses Redis in production with node-cache fallback
 * This is a compatibility wrapper that maintains the same API
 */

const redisCacheService = require('./redis-cache.service');

class CacheService {
  constructor() {
    // Delegate to Redis cache service
    this.delegate = redisCacheService;
  }

  /**
   * Get value from cache
   */
  async get(key) {
    return await this.delegate.get(key);
  }

  /**
   * Set value in cache
   */
  async set(key, value, ttl = null) {
    return await this.delegate.set(key, value, ttl);
  }

  /**
   * Delete value from cache
   */
  async del(key) {
    return await this.delegate.del(key);
  }

  /**
   * Delete multiple keys
   */
  async delMultiple(keys) {
    return await this.delegate.delMultiple(keys);
  }

  /**
   * Check if key exists
   */
  async has(key) {
    return await this.delegate.has(key);
  }

  /**
   * Get or set pattern: Get from cache, or execute function and cache result
   */
  async getOrSet(key, fetchFunction, ttl = null) {
    return await this.delegate.getOrSet(key, fetchFunction, ttl);
  }

  /**
   * Invalidate cache by pattern
   */
  async invalidatePattern(pattern) {
    return await this.delegate.invalidatePattern(pattern);
  }

  /**
   * Flush all cache
   */
  async flush() {
    return await this.delegate.flush();
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return this.delegate.getStats();
  }

  /**
   * API response caching methods
   */
  async getApi(key) {
    return await this.delegate.getApi(key);
  }

  async setApi(key, value, ttl = 60) {
    return await this.delegate.setApi(key, value, ttl);
  }

  async delApi(key) {
    return await this.delegate.delApi(key);
  }

  /**
   * Static data caching methods
   */
  async getStatic(key) {
    return await this.delegate.getStatic(key);
  }

  async setStatic(key, value, ttl = 3600) {
    return await this.delegate.setStatic(key, value, ttl);
  }

  async delStatic(key) {
    return await this.delegate.delStatic(key);
  }

  /**
   * Session caching methods
   */
  async getSession(key) {
    return await this.delegate.getSession(key);
  }

  async setSession(key, value, ttl = 1800) {
    return await this.delegate.setSession(key, value, ttl);
  }

  async delSession(key) {
    return await this.delegate.delSession(key);
  }

  /**
   * Convenience methods for common cache keys
   */
  
  // User data caching
  async getUserData(userId) {
    return await this.delegate.getUserData(userId);
  }

  async setUserData(userId, data, ttl = 600) {
    return await this.delegate.setUserData(userId, data, ttl);
  }

  async invalidateUserData(userId) {
    return await this.delegate.invalidateUserData(userId);
  }

  // Attendance caching
  async getAttendance(studentId, subject = null) {
    const key = subject 
      ? `attendance:${studentId}:${subject}`
      : `attendance:${studentId}`;
    return await this.get(key);
  }

  async setAttendance(studentId, data, subject = null, ttl = 300) {
    const key = subject 
      ? `attendance:${studentId}:${subject}`
      : `attendance:${studentId}`;
    return await this.set(key, data, ttl);
  }

  async invalidateAttendance(studentId, subject = null) {
    if (subject) {
      return await this.del(`attendance:${studentId}:${subject}`);
    } else {
      return await this.invalidatePattern(`attendance:${studentId}`);
    }
  }

  // Marks caching
  async getMarks(studentId, subject = null) {
    const key = subject 
      ? `marks:${studentId}:${subject}`
      : `marks:${studentId}`;
    return await this.get(key);
  }

  async setMarks(studentId, data, subject = null, ttl = 300) {
    const key = subject 
      ? `marks:${studentId}:${subject}`
      : `marks:${studentId}`;
    return await this.set(key, data, ttl);
  }

  async invalidateMarks(studentId, subject = null) {
    if (subject) {
      return await this.del(`marks:${studentId}:${subject}`);
    } else {
      return await this.invalidatePattern(`marks:${studentId}`);
    }
  }

  // Timetable caching
  async getTimetable(department, year, section) {
    return await this.getStatic(`timetable:${department}:${year}:${section}`);
  }

  async setTimetable(department, year, section, data) {
    return await this.setStatic(`timetable:${department}:${year}:${section}`, data);
  }

  async invalidateTimetable(department = null, year = null, section = null) {
    if (department && year && section) {
      return await this.delStatic(`timetable:${department}:${year}:${section}`);
    } else if (department) {
      return await this.invalidatePattern(`timetable:${department}`);
    } else {
      return await this.invalidatePattern('timetable:');
    }
  }

  // Files caching
  async getFilesList(category = null) {
    const key = category ? `files:${category}` : 'files:all';
    return await this.get(key);
  }

  async setFilesList(data, category = null, ttl = 300) {
    const key = category ? `files:${category}` : 'files:all';
    return await this.set(key, data, ttl);
  }

  async invalidateFiles(category = null) {
    if (category) {
      return await this.del(`files:${category}`);
    } else {
      return await this.invalidatePattern('files:');
    }
  }

  // Analytics caching
  async getAnalytics(type, params = {}) {
    return await this.delegate.getAnalytics(type, params);
  }

  async setAnalytics(type, params, data, ttl = 600) {
    return await this.delegate.setAnalytics(type, params, data, ttl);
  }

  async invalidateAnalytics() {
    return await this.delegate.invalidateAnalytics();
  }
}

// Export singleton instance
module.exports = new CacheService();
