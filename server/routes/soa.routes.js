const express = require('express');
const rateLimit = require('express-rate-limit');
const { authMiddleware, optionalAuth } = require('../middleware/auth');
const { isPortalEnabled, PORTAL_DISABLED_MESSAGE } = require('../config/featureFlags');
const cacheService = require('../services/cache.service');
const soaScraperService = require('../services/soa-scraper.service');
const {
  normalizeSoaPortalData,
  getPortalSnapshotForUser,
  persistPortalDataForUser,
  disconnectPortalForUser,
  serializeDate
} = require('../services/soa-data.service');

const router = express.Router();
const OFFICIAL_PORTAL_URL = 'https://soaportals.com/StudentPortalSOA/';

const captchaLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 12,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    status: 'RATE_LIMITED',
    message: 'Too many CAPTCHA requests. Please wait a few minutes before trying again.'
  }
});

const importLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    status: 'RATE_LIMITED',
    message: 'Too many SOA import attempts. Please wait before trying again.'
  }
});

function requireStudent(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      status: 'AUTH_REQUIRED',
      message: 'Please log in to connect your SOA portal.'
    });
  }

  if (req.user.role !== 'student') {
    return res.status(403).json({
      success: false,
      status: 'ACCESS_DENIED',
      message: 'Only student accounts can connect an SOA portal.'
    });
  }

  return next();
}

function buildUnavailableResponse(snapshot = null, extra = {}) {
  return {
    success: false,
    status: 'PORTAL_DISABLED',
    message: PORTAL_DISABLED_MESSAGE,
    portalEnabled: false,
    demoAvailable: true,
    officialPortalUrl: OFFICIAL_PORTAL_URL,
    connection: snapshot?.status || {
      connected: false,
      isVerified: false,
      portalProvider: null,
      lastSynced: null,
      hasImportedData: false,
      needsReconnect: false,
      dataSource: null,
      profileSummary: null
    },
    ...extra
  };
}

function buildRuntimeUnavailableResponse(snapshot = null, runtime = null, extra = {}) {
  return {
    success: false,
    status: soaScraperService.STATUS_RUNTIME_UNAVAILABLE,
    message: runtime?.message || 'SOA import is temporarily unavailable on this server.',
    portalEnabled: false,
    demoAvailable: true,
    officialPortalUrl: OFFICIAL_PORTAL_URL,
    runtime,
    connection: snapshot?.status || {
      connected: false,
      isVerified: false,
      portalProvider: null,
      lastSynced: null,
      hasImportedData: false,
      needsReconnect: false,
      dataSource: null,
      profileSummary: null
    },
    ...extra
  };
}

async function invalidateStudentPortalCaches(userId) {
  if (!userId) return;
  await Promise.allSettled([
    cacheService.invalidateAttendance(userId),
    cacheService.invalidateMarks(userId),
    cacheService.invalidateUserData(userId)
  ]);
}

async function loadSnapshot(req) {
  return getPortalSnapshotForUser({
    userId: req.user?.id,
    registrationNumber: req.user?.registration_number
  });
}

router.get('/status', optionalAuth, async (req, res) => {
  try {
    const featureEnabled = isPortalEnabled();
    const snapshot = req.user ? await loadSnapshot(req) : null;
    const runtime = featureEnabled ? await soaScraperService.getRuntimeDiagnostics().catch(() => null) : null;
    const portalEnabled = featureEnabled && runtime?.ready !== false && runtime?.hasCapacity !== false;
    const message = !featureEnabled
      ? PORTAL_DISABLED_MESSAGE
      : runtime?.ready === false
        ? runtime.message
        : runtime?.hasCapacity === false
          ? runtime.message
        : 'SOA portal import is available.';

    return res.json({
      success: true,
      portalEnabled,
      demoAvailable: true,
      officialPortalUrl: OFFICIAL_PORTAL_URL,
      message,
      runtime,
      connection: snapshot?.status || {
        connected: false,
        isVerified: false,
        portalProvider: null,
        lastSynced: null,
        hasImportedData: false,
        needsReconnect: false,
        dataSource: null,
        profileSummary: null
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      status: 'SCRAPE_ERROR',
      message: 'Failed to load SOA portal status.'
    });
  }
});

router.get('/me', authMiddleware, requireStudent, async (req, res) => {
  try {
    const snapshot = await loadSnapshot(req);

    return res.json({
      success: true,
      portalEnabled: isPortalEnabled(),
      demoAvailable: true,
      officialPortalUrl: OFFICIAL_PORTAL_URL,
      connection: snapshot.status,
      data: snapshot.normalizedData
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      status: 'SCRAPE_ERROR',
      message: 'Failed to load imported SOA data.'
    });
  }
});

router.get('/captcha', authMiddleware, requireStudent, captchaLimiter, async (req, res) => {
  if (!isPortalEnabled()) {
    const snapshot = await loadSnapshot(req);
    return res.status(503).json(buildUnavailableResponse(snapshot));
  }

  try {
    const snapshot = await loadSnapshot(req);
    const runtime = await soaScraperService.getRuntimeDiagnostics();
    if (!runtime.ready || runtime.hasCapacity === false) {
      return res.status(503).json({
        success: false,
        status: runtime.ready ? soaScraperService.STATUS_SCRAPER_BUSY : soaScraperService.STATUS_RUNTIME_UNAVAILABLE,
        message: runtime.message,
        portalEnabled: false,
        demoAvailable: true,
        officialPortalUrl: OFFICIAL_PORTAL_URL,
        runtime,
        connection: snapshot?.status || {
          connected: false,
          isVerified: false,
          portalProvider: null,
          lastSynced: null,
          hasImportedData: false,
          needsReconnect: false,
          dataSource: null,
          profileSummary: null
        }
      });
    }

    const result = await soaScraperService.createSessionAndGetCaptcha();

    if (!result.success) {
      return res.status(
        result.status === 'PORTAL_UNREACHABLE' || result.status === soaScraperService.STATUS_RUNTIME_UNAVAILABLE
          || result.status === soaScraperService.STATUS_SCRAPER_BUSY
          ? 503
          : 500
      ).json({
        ...result,
        portalEnabled: result.status !== soaScraperService.STATUS_RUNTIME_UNAVAILABLE
          && result.status !== soaScraperService.STATUS_SCRAPER_BUSY,
        demoAvailable: true,
        officialPortalUrl: OFFICIAL_PORTAL_URL,
        runtime: result.runtime || runtime,
        connection: snapshot?.status || {
          connected: false,
          isVerified: false,
          portalProvider: null,
          lastSynced: null,
          hasImportedData: false,
          needsReconnect: false,
          dataSource: null,
          profileSummary: null
        }
      });
    }

    return res.json({
      success: true,
      status: result.status,
      sessionId: result.sessionId,
      captchaImage: result.captchaImage,
      message: result.message,
      officialPortalUrl: OFFICIAL_PORTAL_URL
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      status: 'SCRAPE_ERROR',
      message: 'Failed to fetch SOA CAPTCHA.',
      officialPortalUrl: OFFICIAL_PORTAL_URL
    });
  }
});

router.post('/refresh-captcha', authMiddleware, requireStudent, captchaLimiter, async (req, res) => {
  if (!isPortalEnabled()) {
    const snapshot = await loadSnapshot(req);
    return res.status(503).json(buildUnavailableResponse(snapshot));
  }

  try {
    const { sessionId } = req.body || {};

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        status: 'INVALID_REQUEST',
        message: 'Session ID is required.'
      });
    }

    const result = await soaScraperService.refreshCaptcha(sessionId);

    if (!result.success) {
      return res.status(
        result.status === 'SESSION_EXPIRED'
          ? 410
          : result.status === soaScraperService.STATUS_RUNTIME_UNAVAILABLE
            ? 503
            : 500
      ).json(result);
    }

    return res.json(result);
  } catch (error) {
    return res.status(500).json({
      success: false,
      status: 'SCRAPE_ERROR',
      message: 'Failed to refresh the SOA CAPTCHA.'
    });
  }
});

async function handleImport(req, res) {
  if (!isPortalEnabled()) {
    const snapshot = await loadSnapshot(req);
    return res.status(503).json(buildUnavailableResponse(snapshot));
  }

  const { sessionId, regNo, password, captcha } = req.body || {};

  if (!sessionId || !regNo || !password || !captcha) {
    return res.status(400).json({
      success: false,
      status: 'INVALID_REQUEST',
      message: 'Session ID, registration number, password, and CAPTCHA are required.'
    });
  }

  try {
    const result = await soaScraperService.loginAndScrape(sessionId, regNo, password, captcha);
    req.body.password = null;

    if (!result.success) {
      const snapshot = await loadSnapshot(req);
      const statusCode = result.status === 'AUTH_FAILED'
        ? 401
        : result.status === 'SESSION_EXPIRED'
          ? 410
          : result.status === 'PORTAL_UNREACHABLE'
            ? 503
            : result.status === soaScraperService.STATUS_RUNTIME_UNAVAILABLE
              ? 503
            : 500;

      return res.status(statusCode).json({
        ...result,
        officialPortalUrl: OFFICIAL_PORTAL_URL,
        connection: snapshot.status
      });
    }

    const normalizedData = result.data?.provider === 'soa'
      ? result.data
      : normalizeSoaPortalData(result.data);

    await persistPortalDataForUser({
      userId: req.user.id,
      registrationNumber: regNo,
      normalizedData,
      isVerified: true,
      portalConnected: true
    });

    await invalidateStudentPortalCaches(req.user.id);

    const snapshot = await loadSnapshot(req);

    return res.json({
      success: true,
      status: 'SUCCESS',
      message: 'SOA data imported successfully.',
      officialPortalUrl: OFFICIAL_PORTAL_URL,
      redirectTo: '/dashboard/student-personal-info',
      connection: snapshot.status,
      data: snapshot.normalizedData
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      status: 'SCRAPE_ERROR',
      message: 'SOA import failed. Please try again with a fresh CAPTCHA.'
    });
  }
}

router.post('/login', authMiddleware, requireStudent, importLimiter, handleImport);
router.post('/resync', authMiddleware, requireStudent, importLimiter, handleImport);

router.post('/disconnect', authMiddleware, requireStudent, async (req, res) => {
  try {
    const snapshot = await disconnectPortalForUser({
      userId: req.user.id,
      registrationNumber: req.user.registration_number
    });

    await invalidateStudentPortalCaches(req.user.id);

    return res.json({
      success: true,
      message: 'SOA portal disconnected. Cached imported data is still available in this app.',
      connection: snapshot.status,
      data: snapshot.normalizedData
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to disconnect SOA portal.'
    });
  }
});

router.delete('/session/:sessionId', optionalAuth, async (req, res) => {
  try {
    const { sessionId } = req.params;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        status: 'INVALID_REQUEST',
        message: 'Session ID is required.'
      });
    }

    await soaScraperService.closeSession(sessionId);

    return res.json({
      success: true,
      message: 'SOA portal session closed successfully.',
      closedAt: serializeDate(new Date())
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to close SOA portal session.'
    });
  }
});

module.exports = router;
