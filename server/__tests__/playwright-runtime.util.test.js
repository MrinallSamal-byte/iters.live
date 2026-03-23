/** @jest-environment node */

const {
  detectBrowserRuntimeIssue,
  resolveChromiumExecutablePath
} = require('../utils/playwright-runtime.util');

describe('playwright-runtime.util', () => {
  test('resolveChromiumExecutablePath prefers the first existing configured path', () => {
    const executablePath = resolveChromiumExecutablePath(
      {
        PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH: '/missing/chromium',
        CHROMIUM_PATH: '/opt/chromium/chrome',
        CHROME_BIN: '/usr/bin/google-chrome'
      },
      (candidate) => candidate === '/opt/chromium/chrome'
    );

    expect(executablePath).toBe('/opt/chromium/chrome');
  });

  test('resolveChromiumExecutablePath returns null when no configured path exists', () => {
    const executablePath = resolveChromiumExecutablePath(
      {
        PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH: '/missing/chromium'
      },
      () => false
    );

    expect(executablePath).toBeNull();
  });

  test('detectBrowserRuntimeIssue identifies missing executable failures', () => {
    const result = detectBrowserRuntimeIssue("browserType.launch: Executable doesn't exist at /ms-playwright/chromium");

    expect(result).toMatchObject({
      code: 'MISSING_EXECUTABLE',
      isRuntimeError: true
    });
  });

  test('detectBrowserRuntimeIssue identifies missing dependency failures', () => {
    const result = detectBrowserRuntimeIssue('Host system is missing dependencies. libnss3.so: cannot open shared object file');

    expect(result).toMatchObject({
      code: 'MISSING_DEPENDENCIES',
      isRuntimeError: true
    });
  });

  test('detectBrowserRuntimeIssue identifies generic browser launch failures', () => {
    const result = detectBrowserRuntimeIssue('browserType.launch: Target page, context or browser has been closed');

    expect(result).toMatchObject({
      code: 'BROWSER_LAUNCH_FAILED',
      isRuntimeError: true
    });
  });
});
