/**
 * Redis Configuration
 * Provides Redis client configuration and connection management
 */

const Redis = require('ioredis');

let redisClient = null;
let isConnected = false;

/**
 * Initialize Redis connection
 * @returns {Promise<Redis|null>} Redis client or null if connection fails
 */
async function initRedis() {
  // Skip Redis in development or if Redis URL is not configured
  if (process.env.NODE_ENV !== 'production' || !process.env.REDIS_URL) {
    console.log('[Redis] Running in development mode or Redis URL not configured - using in-memory cache');
    return null;
  }

  try {
    const redisConfig = {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      reconnectOnError: (err) => {
        const targetError = 'READONLY';
        if (err.message.includes(targetError)) {
          // Only reconnect when the error contains "READONLY"
          return true;
        }
        return false;
      }
    };

    // Parse Redis URL if provided
    if (process.env.REDIS_URL) {
      redisClient = new Redis(process.env.REDIS_URL, redisConfig);
    } else {
      // Use individual config values
      redisClient = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT) || 6379,
        password: process.env.REDIS_PASSWORD || undefined,
        db: parseInt(process.env.REDIS_DB) || 0,
        ...redisConfig
      });
    }

    // Handle connection events
    redisClient.on('connect', () => {
      console.log('[Redis] Connected successfully');
      isConnected = true;
    });

    redisClient.on('ready', () => {
      console.log('[Redis] Client ready to use');
      isConnected = true;
    });

    redisClient.on('error', (err) => {
      console.error('[Redis] Connection error:', err.message);
      isConnected = false;
    });

    redisClient.on('close', () => {
      console.log('[Redis] Connection closed');
      isConnected = false;
    });

    redisClient.on('reconnecting', () => {
      console.log('[Redis] Attempting to reconnect...');
    });

    // Test connection
    await redisClient.ping();
    console.log('[Redis] Initial connection test successful');
    
    return redisClient;
  } catch (error) {
    console.error('[Redis] Failed to initialize:', error.message);
    console.log('[Redis] Falling back to in-memory cache');
    redisClient = null;
    isConnected = false;
    return null;
  }
}

/**
 * Get Redis client
 * @returns {Redis|null} Redis client or null
 */
function getRedisClient() {
  return redisClient;
}

/**
 * Check if Redis is connected
 * @returns {boolean} Connection status
 */
function isRedisConnected() {
  return isConnected && redisClient !== null;
}

/**
 * Close Redis connection
 * @returns {Promise<void>}
 */
async function closeRedis() {
  if (redisClient) {
    try {
      await redisClient.quit();
      console.log('[Redis] Connection closed gracefully');
    } catch (error) {
      console.error('[Redis] Error closing connection:', error.message);
    }
    redisClient = null;
    isConnected = false;
  }
}

module.exports = {
  initRedis,
  getRedisClient,
  isRedisConnected,
  closeRedis
};
