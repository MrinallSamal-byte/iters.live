/**
 * System Health & Monitoring Routes
 * Provides database stats, pool info, and system health checks
 */

const express = require('express');
const router = express.Router();
const {
  db,
  realtimeDb,
  isFirebaseAdminReady,
  isRealtimeDbReady
} = require('../database/firebase');
const { countRecords, syncRealtimeMirror } = require('../services/firebase-data.service');
const { authMiddleware: auth } = require('../middleware/auth');
const os = require('os');
const fs = require('fs').promises;
const path = require('path');

const CORE_COLLECTIONS = [
  'users',
  'attendance',
  'marks',
  'assignments',
  'events',
  'notifications'
];

async function getDatabaseHealth() {
  if (!isFirebaseAdminReady) {
    return {
      status: 'unavailable',
      provider: 'firebase',
      firestore: {
        ready: false
      },
      realtime: {
        ready: isRealtimeDbReady
      }
    };
  }

  let firestoreReady = false;
  let firestoreError = null;
  let realtimeReady = isRealtimeDbReady;
  let realtimeError = null;

  try {
    await db.collection('_health').limit(1).get();
    firestoreReady = true;
  } catch (error) {
    firestoreError = error.message;
  }

  if (isRealtimeDbReady) {
    try {
      await realtimeDb.ref('healthcheck').once('value');
      realtimeReady = true;
    } catch (error) {
      realtimeReady = false;
      realtimeError = error.message;
    }
  }

  return {
    status: firestoreReady ? 'healthy' : 'degraded',
    provider: 'firebase',
    firestore: {
      ready: firestoreReady,
      error: firestoreError
    },
    realtime: {
      ready: realtimeReady,
      enabled: isRealtimeDbReady,
      error: realtimeError
    }
  };
}

/**
 * @route   GET /api/health
 * @desc    System health check (public)
 * @access  Public
 */
router.get('/', async (req, res) => {
  try {
    const healthCheck = await getDatabaseHealth();

    // ponytail: raw Firestore/Realtime error messages are internal detail —
    // only expose them outside production; the public root stays leak-free in prod
    const includeErrorDetails = process.env.NODE_ENV !== 'production';
    const database = includeErrorDetails ? healthCheck : {
      status: healthCheck.status,
      provider: healthCheck.provider,
      firestore: { ready: healthCheck.firestore.ready },
      realtime: {
        ready: healthCheck.realtime.ready,
        enabled: healthCheck.realtime.enabled
      }
    };

    res.json({
      status: healthCheck.status,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy'
    });
  }
});

/**
 * @route   GET /api/health/ready
 * @desc    Readiness probe for load balancers / orchestrators: 200 only when the
 *          datastore answers, 503 otherwise. Exposes no internal detail.
 * @access  Public
 */
router.get('/ready', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const health = await getDatabaseHealth();
    const ready = health.status === 'healthy';
    res.status(ready ? 200 : 503).json({ ready });
  } catch (error) {
    res.status(503).json({ ready: false });
  }
});

/**
 * @route   GET /api/health/detailed
 * @desc    Detailed system health and performance metrics
 * @access  Admin only
 */
router.get('/detailed', auth, async (req, res) => {
  try {
    // Check admin permission
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const dbHealth = await getDatabaseHealth();
    const collectionSnapshots = await Promise.all(
      CORE_COLLECTIONS.map(async (collection) => ({
        name: collection,
        // Server-side count aggregation: no documents are downloaded for a health page.
        count: await countRecords(collection)
      }))
    );

    // Memory usage
    const memUsage = process.memoryUsage();
    const systemMem = {
      total: os.totalmem(),
      free: os.freemem(),
      used: os.totalmem() - os.freemem()
    };

    // CPU usage
    const cpus = os.cpus();
    const cpuUsage = process.cpuUsage();

    let slowQueryLogSize = 0;
    try {
      const logPath = path.join(__dirname, '../../logs/slow-queries.log');
      const stats = await fs.stat(logPath);
      slowQueryLogSize = stats.size;
    } catch (e) {
      // No SQL slow query log in Firebase mode.
    }

    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      system: {
        platform: os.platform(),
        arch: os.arch(),
        nodeVersion: process.version,
        uptime: process.uptime(),
        cpus: cpus.length,
        // Some container runtimes report no CPUs at all.
        cpuModel: cpus.length > 0 ? cpus[0].model : null
      },
      memory: {
        process: {
          heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
          heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
          rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
          external: `${Math.round(memUsage.external / 1024 / 1024)}MB`
        },
        system: {
          total: `${Math.round(systemMem.total / 1024 / 1024 / 1024)}GB`,
          free: `${Math.round(systemMem.free / 1024 / 1024 / 1024)}GB`,
          used: `${Math.round(systemMem.used / 1024 / 1024 / 1024)}GB`,
          usagePercent: `${Math.round((systemMem.used / systemMem.total) * 100)}%`
        }
      },
      cpu: {
        user: cpuUsage.user,
        system: cpuUsage.system
      },
      database: {
        status: dbHealth.status,
        provider: dbHealth.provider,
        firestore: dbHealth.firestore,
        realtime: dbHealth.realtime,
        collections: collectionSnapshots,
        slowQueryLogSize: `${Math.round(slowQueryLogSize / 1024)}KB`
      }
    });

  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({
      status: 'error'
    });
  }
});

/**
 * @route   POST /api/health/refresh-views
 * @desc    Manually trigger materialized view refresh
 * @access  Admin only
 */
router.post('/refresh-views', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const results = await Promise.all(CORE_COLLECTIONS.map(async (collection) => {
      try {
        return { collection, ...(await syncRealtimeMirror(collection)) };
      } catch (syncError) {
        return { collection, enabled: true, synced: 0, error: syncError.message };
      }
    }));

    const enabled = results.some((result) => result.enabled);
    res.json({
      success: results.every((result) => !result.error),
      message: enabled
        ? 'Realtime Database mirrors rebuilt from Firestore'
        : 'Realtime Database mirroring is not enabled; nothing to refresh',
      collections: results,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('View refresh error:', error);
    res.status(500).json({
      error: 'Failed to refresh Firebase collection mirrors',
      details: error.message
    });
  }
});

// ponytail: GET /slow-queries deleted — hardcoded empty stub with zero callers

/**
 * @route   GET /api/health/cache-stats
 * @desc    Get cache statistics
 * @access  Admin only
 */
router.get('/cache-stats', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const cacheService = require('../services/cache.service');
    const stats = cacheService.getStats();

    res.json({
      timestamp: new Date().toISOString(),
      caches: stats
    });
  } catch (error) {
    console.error('Cache stats error:', error);
    res.status(500).json({
      error: 'Failed to fetch cache stats',
      details: error.message
    });
  }
});

/**
 * @route   GET /api/health/ai-service
 * @desc    Check AI service configuration and availability
 * @access  Private (authMiddleware; reveals provider configuration state)
 */
router.get('/ai-service', auth, async (req, res) => {
  try {
    // Lazy load service to avoid startup issues
    const openRouterService = require('../services/openrouter.service');
    
    // Check environment variables (without exposing actual keys)
    const openRouterConfigured = Boolean(process.env.OPENROUTER_API_KEY);
    const geminiConfigured = Boolean(process.env.GEMINI_API_KEY);
    
    // Check service availability
    const openRouterAvailable = openRouterService.isAvailable();
    
    res.json({
      status: openRouterAvailable || geminiConfigured ? 'available' : 'unavailable',
      timestamp: new Date().toISOString(),
      services: {
        openRouter: {
          configured: openRouterConfigured,
          available: openRouterAvailable
        },
        gemini: {
          configured: geminiConfigured
        }
      },
      recommendations: openRouterAvailable || geminiConfigured ? 
        [] : [
          'Set OPENROUTER_API_KEY environment variable (recommended)',
          'Or set GEMINI_API_KEY environment variable (fallback)',
          'See AI_SERVICE_RENDER_SETUP_GUIDE.md for details'
        ]
    });
  } catch (error) {
    console.error('AI service check error:', error);
    res.status(500).json({
      status: 'error'
    });
  }
});

module.exports = router;
