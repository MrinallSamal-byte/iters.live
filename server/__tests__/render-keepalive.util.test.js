/**
 * @jest-environment node
 */

const {
  DEFAULT_INTERVAL_MS,
  resolveKeepAliveConfig,
  startRenderKeepAlive
} = require('../utils/render-keepalive');

describe('render-keepalive utility', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.useFakeTimers();
    process.env = { ...originalEnv };
    delete process.env.KEEPALIVE_ENABLED;
    delete process.env.KEEPALIVE_INTERVAL_MS;
    delete process.env.KEEPALIVE_URL;
    delete process.env.KEEPALIVE_PATH;
    delete process.env.RENDER_EXTERNAL_URL;
    delete process.env.RENDER_EXTERNAL_HOSTNAME;
    delete process.env.RENDER;
    delete process.env.RENDER_SERVICE_ID;
    delete process.env.JEST_WORKER_ID;
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  it('resolves default 10-minute interval and /health from Render URL', () => {
    process.env.KEEPALIVE_ENABLED = 'true';
    process.env.RENDER_EXTERNAL_URL = 'https://iter-aio.onrender.com';

    const config = resolveKeepAliveConfig();

    expect(config.enabled).toBe(true);
    expect(config.intervalMs).toBe(DEFAULT_INTERVAL_MS);
    expect(config.targetUrl).toBe('https://iter-aio.onrender.com/health');
  });

  it('uses KEEPALIVE_URL override as-is when provided', () => {
    process.env.KEEPALIVE_ENABLED = 'true';
    process.env.KEEPALIVE_URL = 'https://iter-aio.onrender.com/custom-health';

    const config = resolveKeepAliveConfig();

    expect(config.targetUrl).toBe('https://iter-aio.onrender.com/custom-health');
  });

  it('starts only in production Render-like environments and pings after initial delay', async () => {
    process.env.NODE_ENV = 'production';
    process.env.KEEPALIVE_ENABLED = 'true';
    process.env.RENDER = 'true';
    process.env.RENDER_EXTERNAL_HOSTNAME = 'iter-aio.onrender.com';

    const fetchMock = jest.fn().mockResolvedValue({ status: 200 });
    const logger = { info: jest.fn(), warn: jest.fn() };
    const stop = startRenderKeepAlive({ fetchImpl: fetchMock, logger });

    expect(fetchMock).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(30 * 1000); // matches new DEFAULT_INITIAL_DELAY_MS
    expect(fetchMock).toHaveBeenCalledWith(
      'https://iter-aio.onrender.com/health',
      expect.objectContaining({ method: 'GET' })
    );

    stop();
  });

  it('skips when disabled and does not throw', () => {
    process.env.NODE_ENV = 'production';
    process.env.KEEPALIVE_ENABLED = 'false';
    process.env.RENDER = 'true';
    process.env.RENDER_EXTERNAL_URL = 'https://iter-aio.onrender.com';

    const fetchMock = jest.fn();
    const logger = { info: jest.fn(), warn: jest.fn() };

    expect(() => startRenderKeepAlive({ fetchImpl: fetchMock, logger })).not.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('[KeepAlive] skipped'));
  });
});
