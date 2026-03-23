const fs = require('fs');

function resolveChromiumExecutablePath(env = process.env, pathExists = fs.existsSync) {
  const candidates = [
    env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    env.CHROMIUM_PATH,
    env.CHROME_BIN
  ]
    .filter(Boolean)
    .map((value) => String(value).trim())
    .filter(Boolean);

  for (const candidate of candidates) {
    if (pathExists(candidate)) {
      return candidate;
    }
  }

  return null;
}

function detectBrowserRuntimeIssue(message = '') {
  const normalized = String(message || '');

  if (/Executable doesn't exist|Failed to launch browser because executable doesn't exist/i.test(normalized)) {
    return {
      code: 'MISSING_EXECUTABLE',
      isRuntimeError: true,
      userMessage: 'SOA import is temporarily unavailable on this server because Chromium is not installed in the deployment runtime.'
    };
  }

  if (/Host system is missing dependencies|missing libraries|error while loading shared libraries|lib[a-z0-9._-]+\.so/i.test(normalized)) {
    return {
      code: 'MISSING_DEPENDENCIES',
      isRuntimeError: true,
      userMessage: 'SOA import is temporarily unavailable on this server because the Chromium runtime dependencies are missing.'
    };
  }

  if (/browserType\.launch|headless_shell|chromium_headless_shell|sandbox_host_linux|Target page, context or browser has been closed|Check failed: \. shutdown/i.test(normalized)) {
    return {
      code: 'BROWSER_LAUNCH_FAILED',
      isRuntimeError: true,
      userMessage: 'SOA import is temporarily unavailable on this server because the browser runtime could not start cleanly.'
    };
  }

  return {
    code: 'UNKNOWN',
    isRuntimeError: false,
    userMessage: null
  };
}

module.exports = {
  detectBrowserRuntimeIssue,
  resolveChromiumExecutablePath
};
