/**
 * System Health & Monitoring Routes
 * Provides database stats, pool info, and system health checks
 */

const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { authMiddleware: auth } = require('../middleware/auth');
const os = require('os');
const fs = require('fs').promises;
const path = require('path');

/**
 * @route   GET /api/health
 * @desc    System health check (public)
 * @access  Public
 */
router.get('/', async (req, res) => {
  try {
    const healthCheck = await db.healthCheck();
    
    res.json({
      status: healthCheck.status,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: healthCheck.stats
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error.message
    });
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

    // Database health
    const dbHealth = await db.healthCheck();
    const poolStats = db.getPoolStats();

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

    // Check if materialized views exist
    const viewStats = await db.query(`
      SELECT TABLE_NAME, CREATE_TIME, UPDATE_TIME, TABLE_ROWS
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = $1 AND TABLE_NAME LIKE 'view_%'
    `, [process.env.DB_NAME || 'iter_college_db']);

    // Get index statistics
    const indexStats = await db.query(`
      SELECT TABLE_NAME, COUNT(*) as index_count
      FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = $1 AND INDEX_NAME != 'PRIMARY'
      GROUP BY TABLE_NAME
      ORDER BY index_count DESC
      LIMIT 10
    `, [process.env.DB_NAME || 'iter_college_db']);

    // Check slow query log size
    let slowQueryLogSize = 0;
    try {
      const logPath = path.join(__dirname, '../../logs/slow-queries.log');
      const stats = await fs.stat(logPath);
      slowQueryLogSize = stats.size;
    } catch (e) {
      // Log file doesn't exist yet
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
        cpuModel: cpus[0].model
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
        connectionPool: poolStats,
        materializedViews: viewStats.length,
        views: viewStats.map(v => ({
          name: v.TABLE_NAME,
          rows: v.TABLE_ROWS,
          lastUpdated: v.UPDATE_TIME
        })),
        indexes: indexStats.map(i => ({
          table: i.TABLE_NAME,
          count: i.index_count
        })),
        slowQueryLogSize: `${Math.round(slowQueryLogSize / 1024)}KB`
      }
    });

  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({
      status: 'error',
      error: error.message
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

    await db.query('CALL sp_refresh_all_views()');

    res.json({
      success: true,
      message: 'All materialized views refreshed successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('View refresh error:', error);
    res.status(500).json({
      error: 'Failed to refresh views',
      details: error.message
    });
  }
});

/**
 * @route   GET /api/health/slow-queries
 * @desc    Get slow query log (last 100 entries)
 * @access  Admin only
 */
router.get('/slow-queries', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const logPath = path.join(__dirname, '../../logs/slow-queries.log');
    
    try {
      const logContent = await fs.readFile(logPath, 'utf8');
      const lines = logContent.split('\n').filter(l => l.trim());
      
      // Parse JSON log lines
      const logs = lines
        .slice(-100) // Last 100 entries
        .map(line => {
          try {
            return JSON.parse(line);
          } catch (e) {
            return null;
          }
        })
        .filter(l => l !== null)
        .reverse(); // Most recent first

      res.json({
        total: logs.length,
        queries: logs
      });
    } catch (error) {
      if (error.code === 'ENOENT') {
        return res.json({
          total: 0,
          queries: [],
          message: 'No slow queries logged yet'
        });
      }
      throw error;
    }
  } catch (error) {
    console.error('Slow query fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch slow queries',
      details: error.message
    });
  }
});

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

module.exports = router;
