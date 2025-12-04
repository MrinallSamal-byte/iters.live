/**
 * Redis Cache Service
 * Production-grade caching service with Redis support and node-cache fallback
 */

const NodeCache = require('node-cache');
const { getRedisClient, isRedisConnected } = require('../config/redis.config');

class RedisCacheService {
  constructor() {
    // Fallback in-memory cache
    this.nodeCache = new NodeCache({
      stdTTL: 600, // 10 minutes
      checkperiod: 120, // Check for expired keys every 2 minutes
      useClones: false
    });

    // API cache (short-lived)
    this.apiCache = new NodeCache({
      stdTTL: 60,
      checkperiod: 20
    });

    // Static cache (long-lived)
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
    this.nodeCache.on('expired', (key) => {
      if (process.env.NODE_ENV === 'development') {
        console.log(`[Cache] Expired: ${key}`);
      }
    });
  }

  /**
   * Get Redis client or null
   * @private
   */
  _getRedis() {
    if (isRedisConnected()) {
      return getRedisClient();
    }
    return null;
  }

  /**
   * Get value from cache
   * @param {string} key - Cache key
   * @returns {Promise<any>} Cached value or undefined
   */
  async get(key) {
    try {
      const redis = this._getRedis();
      
      if (redis) {
        // Try Redis first
        const value = await redis.get(key);
        if (value !== null) {
          return JSON.parse(value);
        }
        return undefined;
      }
      
      // Fallback to node-cache
      return this.nodeCache.get(key);
    } catch (error) {
      console.error('[Cache] Get error:', error);
      // Fallback to node-cache on Redis error
      return this.nodeCache.get(key);
    }
  }

  /**
   * Set value in cache
   * @param {string} key - Cache key
   * @param {any} value - Value to cache
   * @param {number|null} ttl - Time to live in seconds
   * @returns {Promise<boolean>} Success status
   */
  async set(key, value, ttl = null) {
    try {
      const redis = this._getRedis();
      
      if (redis) {
        // Use Redis
        const serialized = JSON.stringify(value);
        if (ttl) {
          await redis.setex(key, ttl, serialized);
        } else {
          await redis.set(key, serialized);
        }
        return true;
      }
      
      // Fallback to node-cache
      if (ttl) {
        return this.nodeCache.set(key, value, ttl);
      }
      return this.nodeCache.set(key, value);
    } catch (error) {
      console.error('[Cache] Set error:', error);
      // Fallback to node-cache on Redis error
      if (ttl) {
        return this.nodeCache.set(key, value, ttl);
      }
      return this.nodeCache.set(key, value);
    }
  }

  /**
   * Delete value from cache
   * @param {string} key - Cache key
   * @returns {Promise<number>} Number of deleted keys
   */
  async del(key) {
    try {
      const redis = this._getRedis();
      
      if (redis) {
        await redis.del(key);
        return 1;
      }
      
      return this.nodeCache.del(key);
    } catch (error) {
      console.error('[Cache] Delete error:', error);
      return this.nodeCache.del(key);
    }
  }

  /**
   * Delete multiple keys
   * @param {string[]} keys - Array of cache keys
   * @returns {Promise<number>} Number of deleted keys
   */
  async delMultiple(keys) {
    try {
      const redis = this._getRedis();
      
      if (redis && keys.length > 0) {
        await redis.del(...keys);
        return keys.length;
      }
      
      return this.nodeCache.del(keys);
    } catch (error) {
      console.error('[Cache] Delete multiple error:', error);
      return this.nodeCache.del(keys);
    }
  }

  /**
   * Check if key exists
   * @param {string} key - Cache key
   * @returns {Promise<boolean>} Existence status
   */
  async has(key) {
    try {
      const redis = this._getRedis();
      
      if (redis) {
        const exists = await redis.exists(key);
        return exists === 1;
      }
      
      return this.nodeCache.has(key);
    } catch (error) {
      console.error('[Cache] Has error:', error);
      return this.nodeCache.has(key);
    }
  }

  /**
   * Get or set pattern: Get from cache, or execute function and cache result
   * @param {string} key - Cache key
   * @param {Function} fetchFunction - Function to execute if cache miss
   * @param {number|null} ttl - Time to live in seconds
   * @returns {Promise<any>} Cached or fetched value
   */
  async getOrSet(key, fetchFunction, ttl = null) {
    const cached = await this.get(key);
    
    if (cached !== undefined) {
      return cached;
    }

    try {
      const value = await fetchFunction();
      await this.set(key, value, ttl);
      return value;
    } catch (error) {
      console.error('[Cache] GetOrSet error:', error);
      throw error;
    }
  }

  /**
   * Invalidate cache by pattern
   * @param {string|RegExp} pattern - Pattern to match keys
   * @returns {Promise<number>} Number of deleted keys
   */
  async invalidatePattern(pattern) {
    try {
      const redis = this._getRedis();
      
      if (redis) {
        // Redis pattern matching (only supports glob patterns, not regex)
        let cursor = '0';
        let deletedCount = 0;
        
        // Convert pattern to glob pattern
        let matchPattern;
        if (typeof pattern === 'string') {
          matchPattern = `*${pattern}*`;
        } else if (pattern instanceof RegExp) {
          // For RegExp, fall back to client-side filtering
          // Get all keys and filter them
          const allKeys = await redis.keys('*');
          const matchingKeys = allKeys.filter(key => pattern.test(key));
          if (matchingKeys.length > 0) {
            await redis.del(...matchingKeys);
          }
          return matchingKeys.length;
        } else {
          matchPattern = '*';
        }
        
        do {
          const [newCursor, keys] = await redis.scan(cursor, 'MATCH', matchPattern, 'COUNT', 100);
          cursor = newCursor;
          
          if (keys.length > 0) {
            await redis.del(...keys);
            deletedCount += keys.length;
          }
        } while (cursor !== '0');
        
        return deletedCount;
      }
      
      // Fallback to node-cache
      const keys = this.nodeCache.keys();
      const matchingKeys = keys.filter(key => {
        if (typeof pattern === 'string') {
          return key.includes(pattern);
        } else if (pattern instanceof RegExp) {
          return pattern.test(key);
        }
        return false;
      });
      
      return this.nodeCache.del(matchingKeys);
    } catch (error) {
      console.error('[Cache] Invalidate pattern error:', error);
      return 0;
    }
  }

  /**
   * Flush all cache
   * @returns {Promise<boolean>} Success status
   */
  async flush() {
    try {
      const redis = this._getRedis();
      
      if (redis) {
        await redis.flushdb();
        return true;
      }
      
      this.nodeCache.flushAll();
      this.apiCache.flushAll();
      this.staticCache.flushAll();
      this.sessionCache.flushAll();
      return true;
    } catch (error) {
      console.error('[Cache] Flush error:', error);
      return false;
    }
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache statistics
   */
  getStats() {
    const redis = this._getRedis();
    
    return {
      type: redis ? 'redis' : 'node-cache',
      connected: isRedisConnected(),
      main: this.nodeCache.getStats(),
      api: this.apiCache.getStats(),
      static: this.staticCache.getStats(),
      session: this.sessionCache.getStats()
    };
  }

  /**
   * API response caching methods
   */
  async getApi(key) {
    try {
      const redis = this._getRedis();
      
      if (redis) {
        const value = await redis.get(`api:${key}`);
        if (value !== null) {
          return JSON.parse(value);
        }
        return undefined;
      }
      
      return this.apiCache.get(key);
    } catch (error) {
      console.error('[Cache] GetApi error:', error);
      return this.apiCache.get(key);
    }
  }

  async setApi(key, value, ttl = 60) {
    try {
      const redis = this._getRedis();
      
      if (redis) {
        await redis.setex(`api:${key}`, ttl, JSON.stringify(value));
        return true;
      }
      
      return this.apiCache.set(key, value, ttl);
    } catch (error) {
      console.error('[Cache] SetApi error:', error);
      return this.apiCache.set(key, value, ttl);
    }
  }

  async delApi(key) {
    try {
      const redis = this._getRedis();
      
      if (redis) {
        await redis.del(`api:${key}`);
        return 1;
      }
      
      return this.apiCache.del(key);
    } catch (error) {
      console.error('[Cache] DelApi error:', error);
      return this.apiCache.del(key);
    }
  }

  /**
   * Static data caching methods
   */
  async getStatic(key) {
    try {
      const redis = this._getRedis();
      
      if (redis) {
        const value = await redis.get(`static:${key}`);
        if (value !== null) {
          return JSON.parse(value);
        }
        return undefined;
      }
      
      return this.staticCache.get(key);
    } catch (error) {
      console.error('[Cache] GetStatic error:', error);
      return this.staticCache.get(key);
    }
  }

  async setStatic(key, value, ttl = 3600) {
    try {
      const redis = this._getRedis();
      
      if (redis) {
        await redis.setex(`static:${key}`, ttl, JSON.stringify(value));
        return true;
      }
      
      return this.staticCache.set(key, value, ttl);
    } catch (error) {
      console.error('[Cache] SetStatic error:', error);
      return this.staticCache.set(key, value, ttl);
    }
  }

  async delStatic(key) {
    try {
      const redis = this._getRedis();
      
      if (redis) {
        await redis.del(`static:${key}`);
        return 1;
      }
      
      return this.staticCache.del(key);
    } catch (error) {
      console.error('[Cache] DelStatic error:', error);
      return this.staticCache.del(key);
    }
  }

  /**
   * Session caching methods
   */
  async getSession(key) {
    try {
      const redis = this._getRedis();
      
      if (redis) {
        const value = await redis.get(`session:${key}`);
        if (value !== null) {
          return JSON.parse(value);
        }
        return undefined;
      }
      
      return this.sessionCache.get(key);
    } catch (error) {
      console.error('[Cache] GetSession error:', error);
      return this.sessionCache.get(key);
    }
  }

  async setSession(key, value, ttl = 1800) {
    try {
      const redis = this._getRedis();
      
      if (redis) {
        await redis.setex(`session:${key}`, ttl, JSON.stringify(value));
        return true;
      }
      
      return this.sessionCache.set(key, value, ttl);
    } catch (error) {
      console.error('[Cache] SetSession error:', error);
      return this.sessionCache.set(key, value, ttl);
    }
  }

  async delSession(key) {
    try {
      const redis = this._getRedis();
      
      if (redis) {
        await redis.del(`session:${key}`);
        return 1;
      }
      
      return this.sessionCache.del(key);
    } catch (error) {
      console.error('[Cache] DelSession error:', error);
      return this.sessionCache.del(key);
    }
  }

  /**
   * Convenience methods for common cache keys
   */
  
  // User data caching
  async getUserData(userId) {
    return await this.get(`user:${userId}`);
  }

  async setUserData(userId, data, ttl = 600) {
    return await this.set(`user:${userId}`, data, ttl);
  }

  async invalidateUserData(userId) {
    return await this.del(`user:${userId}`);
  }

  // Analytics caching
  async getAnalytics(type, params = {}) {
    const key = `analytics:${type}:${JSON.stringify(params)}`;
    return await this.get(key);
  }

  async setAnalytics(type, params, data, ttl = 600) {
    const key = `analytics:${type}:${JSON.stringify(params)}`;
    return await this.set(key, data, ttl);
  }

  async invalidateAnalytics() {
    return await this.invalidatePattern('analytics:');
  }
}

// Export singleton instance
module.exports = new RedisCacheService();
