/**
 * Cache Service Tests
 * Tests for Redis cache service with fallback to node-cache
 */

const redisCacheService = require('../server/services/redis-cache.service');

describe('Cache Service', () => {
  beforeEach(async () => {
    // Clear cache before each test
    await redisCacheService.flush();
  });

  afterAll(async () => {
    // Clean up after tests
    await redisCacheService.flush();
  });

  describe('Basic Operations', () => {
    test('should set and get a value', async () => {
      const key = 'test-key';
      const value = { data: 'test-value' };

      await redisCacheService.set(key, value);
      const result = await redisCacheService.get(key);

      expect(result).toEqual(value);
    });

    test('should return undefined for non-existent key', async () => {
      const result = await redisCacheService.get('non-existent-key');
      expect(result).toBeUndefined();
    });

    test('should delete a value', async () => {
      const key = 'test-key';
      const value = 'test-value';

      await redisCacheService.set(key, value);
      await redisCacheService.del(key);
      const result = await redisCacheService.get(key);

      expect(result).toBeUndefined();
    });

    test('should check if key exists', async () => {
      const key = 'test-key';
      const value = 'test-value';

      await redisCacheService.set(key, value);
      const exists = await redisCacheService.has(key);

      expect(exists).toBe(true);
    });

    test('should return false for non-existent key', async () => {
      const exists = await redisCacheService.has('non-existent-key');
      expect(exists).toBe(false);
    });
  });

  describe('TTL Operations', () => {
    test('should expire key after TTL', async () => {
      const key = 'ttl-key';
      const value = 'ttl-value';

      await redisCacheService.set(key, value, 1); // 1 second TTL

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 1500));

      const result = await redisCacheService.get(key);
      expect(result).toBeUndefined();
    });

    test('should not expire key before TTL', async () => {
      const key = 'ttl-key';
      const value = 'ttl-value';

      await redisCacheService.set(key, value, 5); // 5 second TTL

      // Check immediately
      const result = await redisCacheService.get(key);
      expect(result).toEqual(value);
    });
  });

  describe('Multiple Keys', () => {
    test('should delete multiple keys', async () => {
      const keys = ['key1', 'key2', 'key3'];

      for (const key of keys) {
        await redisCacheService.set(key, `value-${key}`);
      }

      await redisCacheService.delMultiple(keys);

      for (const key of keys) {
        const result = await redisCacheService.get(key);
        expect(result).toBeUndefined();
      }
    });
  });

  describe('Get or Set', () => {
    test('should fetch and cache on cache miss', async () => {
      const key = 'fetch-key';
      const fetchedValue = { data: 'fetched-value' };
      const fetchFunction = jest.fn().mockResolvedValue(fetchedValue);

      const result = await redisCacheService.getOrSet(key, fetchFunction);

      expect(result).toEqual(fetchedValue);
      expect(fetchFunction).toHaveBeenCalledTimes(1);

      // Second call should use cache
      const result2 = await redisCacheService.getOrSet(key, fetchFunction);
      expect(result2).toEqual(fetchedValue);
      expect(fetchFunction).toHaveBeenCalledTimes(1); // Not called again
    });

    test('should throw error if fetch function fails', async () => {
      const key = 'error-key';
      const fetchFunction = jest.fn().mockRejectedValue(new Error('Fetch failed'));

      await expect(
        redisCacheService.getOrSet(key, fetchFunction)
      ).rejects.toThrow('Fetch failed');
    });
  });

  describe('Pattern Invalidation', () => {
    test('should invalidate keys matching pattern', async () => {
      const keys = [
        'user:123:profile',
        'user:123:settings',
        'user:456:profile',
        'other:123:data'
      ];

      for (const key of keys) {
        await redisCacheService.set(key, `value-${key}`);
      }

      // Invalidate user:123 pattern
      await redisCacheService.invalidatePattern('user:123');

      // Check that user:123 keys are deleted
      expect(await redisCacheService.get('user:123:profile')).toBeUndefined();
      expect(await redisCacheService.get('user:123:settings')).toBeUndefined();

      // Check that other keys still exist
      expect(await redisCacheService.get('user:456:profile')).toBeDefined();
      expect(await redisCacheService.get('other:123:data')).toBeDefined();
    });
  });

  describe('Specialized Caches', () => {
    test('should use API cache', async () => {
      const key = 'test-api';
      const value = { api: 'data' };

      await redisCacheService.setApi(key, value, 60);
      const result = await redisCacheService.getApi(key);

      expect(result).toEqual(value);
    });

    test('should use static cache', async () => {
      const key = 'test-static';
      const value = { static: 'data' };

      await redisCacheService.setStatic(key, value, 3600);
      const result = await redisCacheService.getStatic(key);

      expect(result).toEqual(value);
    });

    test('should use session cache', async () => {
      const key = 'test-session';
      const value = { session: 'data' };

      await redisCacheService.setSession(key, value, 1800);
      const result = await redisCacheService.getSession(key);

      expect(result).toEqual(value);
    });
  });

  describe('User Data Caching', () => {
    test('should cache user data', async () => {
      const userId = 123;
      const userData = {
        id: userId,
        name: 'Test User',
        email: 'test@example.com'
      };

      await redisCacheService.setUserData(userId, userData);
      const result = await redisCacheService.getUserData(userId);

      expect(result).toEqual(userData);
    });

    test('should invalidate user data', async () => {
      const userId = 123;
      const userData = { id: userId, name: 'Test User' };

      await redisCacheService.setUserData(userId, userData);
      await redisCacheService.invalidateUserData(userId);
      const result = await redisCacheService.getUserData(userId);

      expect(result).toBeUndefined();
    });
  });

  describe('Analytics Caching', () => {
    test('should cache analytics data', async () => {
      const type = 'student-performance';
      const params = { studentId: 123, month: 6 };
      const analyticsData = { score: 85, attendance: 90 };

      await redisCacheService.setAnalytics(type, params, analyticsData);
      const result = await redisCacheService.getAnalytics(type, params);

      expect(result).toEqual(analyticsData);
    });

    test('should invalidate all analytics', async () => {
      const type1 = 'student-performance';
      const type2 = 'teacher-analytics';
      const params = { id: 123 };

      await redisCacheService.setAnalytics(type1, params, { data: 'test1' });
      await redisCacheService.setAnalytics(type2, params, { data: 'test2' });

      await redisCacheService.invalidateAnalytics();

      expect(await redisCacheService.getAnalytics(type1, params)).toBeUndefined();
      expect(await redisCacheService.getAnalytics(type2, params)).toBeUndefined();
    });
  });

  describe('Cache Statistics', () => {
    test('should return cache statistics', () => {
      const stats = redisCacheService.getStats();

      expect(stats).toHaveProperty('type');
      expect(stats).toHaveProperty('connected');
      expect(stats).toHaveProperty('main');
      expect(stats).toHaveProperty('api');
      expect(stats).toHaveProperty('static');
      expect(stats).toHaveProperty('session');
    });

    test('should indicate cache type', () => {
      const stats = redisCacheService.getStats();
      expect(['redis', 'node-cache']).toContain(stats.type);
    });
  });

  describe('Flush Operations', () => {
    test('should flush all caches', async () => {
      // Set data in different caches
      await redisCacheService.set('main-key', 'main-value');
      await redisCacheService.setApi('api-key', 'api-value');
      await redisCacheService.setStatic('static-key', 'static-value');

      // Flush all
      await redisCacheService.flush();

      // Verify all are cleared
      expect(await redisCacheService.get('main-key')).toBeUndefined();
      expect(await redisCacheService.getApi('api-key')).toBeUndefined();
      expect(await redisCacheService.getStatic('static-key')).toBeUndefined();
    });
  });

  describe('Complex Data Types', () => {
    test('should cache arrays', async () => {
      const key = 'array-key';
      const value = [1, 2, 3, 4, 5];

      await redisCacheService.set(key, value);
      const result = await redisCacheService.get(key);

      expect(result).toEqual(value);
    });

    test('should cache nested objects', async () => {
      const key = 'nested-key';
      const value = {
        user: {
          id: 123,
          profile: {
            name: 'Test User',
            settings: {
              theme: 'dark',
              notifications: true
            }
          }
        }
      };

      await redisCacheService.set(key, value);
      const result = await redisCacheService.get(key);

      expect(result).toEqual(value);
    });

    test('should cache null values', async () => {
      const key = 'null-key';
      const value = null;

      await redisCacheService.set(key, value);
      const result = await redisCacheService.get(key);

      expect(result).toBeNull();
    });
  });
});
