'use strict';

const DEFAULT_INTERVAL_MS = 12 * 60 * 1000;
const DEFAULT_PATH = '/health';
const DEFAULT_INITIAL_DELAY_MS = 45 * 1000;
const DEFAULT_TIMEOUT_MS = 10 * 1000;

function parseBoolean(value, defaultValue = false) {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }

  const normalized = String(value).trim().toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
  if (['false', '0', 'no', 'off'].includes(normalized)) return false;
  return defaultValue;
}

function parsePositiveInt(value, defaultValue) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultValue;
}

function isRenderLikeEnvironment() {
  return Boolean(
    process.env.RENDER ||
    process.env.RENDER_SERVICE_ID ||
    process.env.RENDER_EXTERNAL_URL ||
    process.env.RENDER_EXTERNAL_HOSTNAME
  );
}

function getBasePublicUrl() {
  const explicitUrl = process.env.KEEPALIVE_URL;
  if (explicitUrl) {
    return explicitUrl;
  }

  if (process.env.RENDER_EXTERNAL_URL) {
    return process.env.RENDER_EXTERNAL_URL;
  }

  if (process.env.RENDER_EXTERNAL_HOSTNAME) {
    return `https://${process.env.RENDER_EXTERNAL_HOSTNAME}`;
  }

  return null;
}

function resolveKeepAliveConfig() {
  const enabled = parseBoolean(process.env.KEEPALIVE_ENABLED, false);
  const intervalMs = parsePositiveInt(process.env.KEEPALIVE_INTERVAL_MS, DEFAULT_INTERVAL_MS);
  const path = process.env.KEEPALIVE_PATH || DEFAULT_PATH;
  const timeoutMs = parsePositiveInt(process.env.KEEPALIVE_TIMEOUT_MS, DEFAULT_TIMEOUT_MS);
  const initialDelayMs = parsePositiveInt(process.env.KEEPALIVE_INITIAL_DELAY_MS, DEFAULT_INITIAL_DELAY_MS);
  const baseUrl = getBasePublicUrl();

  if (!baseUrl) {
    return {
      enabled,
      intervalMs,
      timeoutMs,
      initialDelayMs,
      targetUrl: null,
      reason: 'No public Render URL available'
    };
  }

  let targetUrl;
  try {
    const parsed = new URL(baseUrl);
    if (!process.env.KEEPALIVE_URL || parsed.pathname === '/' || parsed.pathname === '') {
      parsed.pathname = path.startsWith('/') ? path : `/${path}`;
    }
    targetUrl = parsed.toString();
  } catch (error) {
    return {
      enabled,
      intervalMs,
      timeoutMs,
      initialDelayMs,
      targetUrl: null,
      reason: 'Invalid keepalive URL'
    };
  }

  return {
    enabled,
    intervalMs,
    timeoutMs,
    initialDelayMs,
    targetUrl,
    reason: null
  };
}

function startRenderKeepAlive({ fetchImpl = global.fetch, logger = console } = {}) {
  const isTest = process.env.NODE_ENV === 'test' || Boolean(process.env.JEST_WORKER_ID);
  const isProduction = process.env.NODE_ENV === 'production';
  const renderLike = isRenderLikeEnvironment();
  const config = resolveKeepAliveConfig();

  if (!isProduction || isTest || !renderLike || !config.enabled || !config.targetUrl || typeof fetchImpl !== 'function') {
    const reason = !isProduction
      ? 'not production'
      : isTest
        ? 'test environment'
        : !renderLike
          ? 'not Render environment'
          : !config.enabled
            ? 'disabled'
            : !config.targetUrl
              ? config.reason
              : 'fetch unavailable';
    logger.info(`[KeepAlive] skipped (${reason})`);
    return () => {};
  }

  logger.info(`[KeepAlive] enabled target=${config.targetUrl} intervalMs=${config.intervalMs}`);

  let inFlight = false;
  let intervalId = null;
  let initialTimeoutId = null;

  const ping = async () => {
    if (inFlight) {
      return;
    }

    inFlight = true;
    let timeoutId = null;
    const controller = typeof AbortController === 'function' ? new AbortController() : null;

    try {
      if (controller) {
        timeoutId = setTimeout(() => controller.abort(), config.timeoutMs);
        if (typeof timeoutId.unref === 'function') timeoutId.unref();
      }

      const response = await fetchImpl(config.targetUrl, {
        method: 'GET',
        headers: { 'User-Agent': 'iterasn-hub-keepalive' },
        signal: controller ? controller.signal : undefined
      });

      if (!response || response.status < 200 || response.status >= 400) {
        const status = response && response.status ? response.status : 'unknown';
        logger.warn(`[KeepAlive] ping failed status=${status}`);
      }
    } catch (error) {
      logger.warn(`[KeepAlive] ping failed: ${error.message}`);
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
      inFlight = false;
    }
  };

  initialTimeoutId = setTimeout(() => {
    ping();
  }, config.initialDelayMs);
  if (typeof initialTimeoutId.unref === 'function') initialTimeoutId.unref();

  intervalId = setInterval(() => {
    ping();
  }, config.intervalMs);
  if (typeof intervalId.unref === 'function') intervalId.unref();

  return () => {
    if (initialTimeoutId) clearTimeout(initialTimeoutId);
    if (intervalId) clearInterval(intervalId);
  };
}

module.exports = {
  DEFAULT_INTERVAL_MS,
  DEFAULT_PATH,
  resolveKeepAliveConfig,
  startRenderKeepAlive
};
