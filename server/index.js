require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs');

// Import routes
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const profileRoutes = require('./routes/profile.routes');
const admitCardRoutes = require('./routes/admitcard.routes');
const attendanceRoutes = require('./routes/attendance.routes');
const marksRoutes = require('./routes/marks.routes');
const fileRoutes = require('./routes/file.routes');
const eventRoutes = require('./routes/event.routes');
const assignmentRoutes = require('./routes/assignment.routes');
const timetableRoutes = require('./routes/timetable.routes');
const hostelRoutes = require('./routes/hostel.routes');
const adminRoutes = require('./routes/admin.routes');
const teacherRoutes = require('./routes/teacher.routes');
const analyticsRoutes = require('./routes/analytics.routes');
const notificationRoutes = require('./routes/notification.routes');
const searchRoutes = require('./routes/search.routes');
const healthRoutes = require('./routes/health.routes');
const bulkRoutes = require('./routes/bulk.routes');
const aiRoutes = require('./routes/ai.routes');
const questionBankRoutes = require('./routes/question-bank.routes');
const rubricRoutes = require('./routes/rubric.routes');
const notesRoutes = require('./routes/notes.routes');
const forumRoutes = require('./routes/forum.routes');
const pyqRoutes = require('./routes/pyq.routes');
const webRoutes = require('./routes/web.routes');
const portalRoutes = require('./routes/portal.routes');
const redirectRoutes = require('./routes/redirect.routes');
const paymentRoutes = require('./routes/payment.routes');
const soaRoutes = require('./routes/soa.routes');
const mobileRoutes = require('./routes/mobile.routes');
const clubsRoutes = require('./routes/clubs.routes');
const agendaRoutes = require('./routes/agenda.routes');
const calendarRoutes = require('./routes/calendar.routes');
const chatRoutes = require('./routes/chat.routes');

// Import utilities
const urlRouter = require('./utils/url-router.util');

// Import middleware
const errorHandler = require('./middleware/errorHandler');
const { initializeSocket } = require('./socket/socket');

const app = express();

// On Vercel (serverless) we must not bind ports or hold WebSocket servers.
// Socket.IO is unavailable there, so routes get a no-op emitter instead.
// Every REST feature still works; real-time push degrades to polling.
const IS_SERVERLESS = Boolean(process.env.VERCEL);

function createNoopIo() {
  const noop = function () {};
  const chainable = () => {
    const obj = { emit: noop, to: chainable, in: chainable, join: noop, leave: noop };
    return obj;
  };
  return {
    emit: noop,
    to: chainable,
    in: chainable,
    use: noop,
    on: noop,
    of: () => createNoopIo(),
    close: noop
  };
}

let server = null;
if (!IS_SERVERLESS) {
  server = http.createServer(app);
}

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  'Pragma': 'no-cache',
  'Expires': '0',
  'Surrogate-Control': 'no-store'
};

function setNoStore(res) {
  Object.entries(NO_STORE_HEADERS).forEach(([header, value]) => {
    res.setHeader(header, value);
  });
}

function sendHtmlNoStore(res, filePath, callback) {
  res.sendFile(filePath, {
    cacheControl: false,
    lastModified: false,
    headers: NO_STORE_HEADERS
  }, callback);
}

function isLocalHostname(hostname = '') {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
}

function encodeVisiblePath(rawPath = '/') {
  return `/r/${Buffer.from(String(rawPath), 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}`;
}

function maybeRedirectToEncodedRoute(req, res, targetPath) {
  if (isLocalHostname(req.hostname)) {
    return false;
  }

  const queryIndex = req.originalUrl.indexOf('?');
  const query = queryIndex >= 0 ? req.originalUrl.slice(queryIndex) : '';
  res.redirect(encodeVisiblePath(`${targetPath}${query}`));
  return true;
}

// Initialize Socket.IO (skipped on Vercel - serverless functions cannot
// hold WebSocket connections; the no-op shim keeps io.emit() calls safe)
const io = IS_SERVERLESS ? createNoopIo() : socketIo(server, {
  cors: {
    origin: process.env.SOCKET_CORS_ORIGIN || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

if (!IS_SERVERLESS) {
  initializeSocket(io);
}

// Make io accessible to routes
app.set('io', io);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: false
}));

// CORS configuration
const corsWhitelist = (process.env.CORS_WHITELIST || '')
  .split(',')
  .map((entry) => entry.trim())
  .filter(Boolean);
app.use(cors({
  origin: function (origin, callback) {
    // Requests without an Origin header (curl, health checks, mobile apps,
    // same-origin) must always pass.
    if (!origin) {
      return callback(null, true);
    }

    const wildcard = corsWhitelist.includes('*');
    const whitelisted = corsWhitelist.includes(origin);

    if (whitelisted || wildcard) {
      return callback(null, true);
    }

    // In production, reject origins that are not explicitly whitelisted.
    // In development, keep the permissive allow-all behavior.
    if (process.env.NODE_ENV === 'production') {
      return callback(null, false);
    }

    return callback(null, true);
  },
  credentials: true
}));

// Trust the first proxy hop (Render/nginx) so rate limiting keys on the
// real client IP instead of the proxy IP.
app.set('trust proxy', 1);

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: 'Too many requests from this IP, please try again later.'
});

app.use('/api/', limiter);

// Body parsing middleware
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// Ensure all API responses are JSON
app.use('/api', (req, res, next) => {
  res.setHeader('Content-Type', 'application/json');
  next();
});

// Compression middleware
app.use(compression());

// Logging middleware
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// URL Obfuscation Middleware - Must come BEFORE static file serving
// Redirects direct HTML page access to obfuscated URLs
app.use((req, res, next) => {
  const reqPath = req.path;
  
  // Skip if not an HTML page request or if it's an API/static/web route
  if (!urlRouter.shouldObfuscatePath(reqPath)) {
    return next();
  }
  
  // Check if it's a direct HTML file access that should be obfuscated
  const pageKey = urlRouter.getPageKeyFromPath(reqPath);
  if (pageKey) {
    const obfuscatedUrl = urlRouter.getObfuscatedUrl(pageKey);
    return res.redirect(obfuscatedUrl);
  }
  
  // Check for common page paths (without .html extension)
  const commonPaths = {
    '/login': 'login',
    '/register': 'register',
    '/creator': 'creator'
  };
  
  if (commonPaths[reqPath]) {
    const obfuscatedUrl = urlRouter.getObfuscatedUrl(commonPaths[reqPath]);
    return res.redirect(obfuscatedUrl);
  }
  
  next();
});

// Serve static files (uploads)
// On Vercel, runtime uploads land in /tmp; fall through to the bundled
// repo uploads directory (demo/seed files) for anything not found there.
const { getUploadsBaseDir } = require('./utils/uploads-dir.util');
app.use('/static/uploads', express.static(getUploadsBaseDir()));
if (IS_SERVERLESS) {
  app.use('/static/uploads', express.static(path.join(__dirname, '../uploads')));
}
// Alias used by controllers when building public file URLs
app.use('/uploads', express.static(getUploadsBaseDir()));
if (IS_SERVERLESS) {
  app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
}

// Serve client static assets (CSS, JS, images) - needed for pages served from /web/:sessionId
const assetsLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 600,
  message: 'Too many requests, please try again later.'
});

function setStaticAssetCacheHeaders(res) {
  res.setHeader('Cache-Control', 'public, max-age=3600');
}

app.use('/css', assetsLimiter, express.static(path.join(__dirname, '../client/css'), {
  setHeaders: setStaticAssetCacheHeaders
}));
app.use('/js', assetsLimiter, express.static(path.join(__dirname, '../client/js'), {
  setHeaders: setStaticAssetCacheHeaders
}));
app.use('/assets', assetsLimiter, express.static(path.join(__dirname, '../client/assets'), {
  setHeaders: setStaticAssetCacheHeaders
}));

// Rate limiter for static file routes
const staticFileLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 200, // 200 requests per minute per IP
  message: 'Too many requests, please try again later.'
});

// Serve manifest and service worker with rate limiting
app.get('/manifest.json', staticFileLimiter, (req, res) => {
  res.sendFile(path.join(__dirname, '../client/manifest.json'));
});
app.get('/service-worker.js', staticFileLimiter, (req, res) => {
  res.sendFile(path.join(__dirname, '../client/service-worker.js'));
});

// Serve releases (APK)
app.use('/releases', express.static(path.join(__dirname, '../releases')));

// Health check endpoint
app.get('/health', (req, res) => {
  setNoStore(res);
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV
  });
});

// API Routes
// Note: SOA routes are mounted first to avoid being caught by profile routes auth middleware
app.use('/api/soa', soaRoutes);
app.use('/api/auth', authRoutes);
app.use('/api', profileRoutes); // Profile routes (includes /api/users/me and /api/profile/*)
app.use('/api/admitcard', admitCardRoutes);
app.use('/api/users', userRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/marks', marksRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/assignments', assignmentRoutes);
app.use('/api/timetable', timetableRoutes);
app.use('/api/hostel', hostelRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/teacher', teacherRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/health', healthRoutes);
app.use('/api/bulk', bulkRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/question-bank', questionBankRoutes);
app.use('/api/rubrics', rubricRoutes);
app.use('/api/notes', notesRoutes);
app.use('/api/forum', forumRoutes);
app.use('/api/pyq', pyqRoutes);
app.use('/api/portal', portalRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/mobile', mobileRoutes);
app.use('/api/clubs', clubsRoutes);
app.use('/api/agenda', agendaRoutes);
app.use('/api/calendar.ics', calendarRoutes);
// REST chat endpoints (used as polling fallback where Socket.IO is unavailable, e.g. Vercel)
app.use('/api/chat', chatRoutes);

// Web routes for obfuscated URLs (/web/:sessionId)
app.use('/web', webRoutes);

// Link encoding redirect handler (/r/:encoded)
app.use('/r', redirectRoutes);

// Public pages now use direct routes for reliable navigation.
app.get('/', staticFileLimiter, (req, res) => {
  sendHtmlNoStore(res, path.join(__dirname, '../client/index.html'));
});

app.get('/index.html', staticFileLimiter, (req, res) => {
  const target = req.originalUrl.includes('?')
    ? `/${req.originalUrl.slice(req.originalUrl.indexOf('?'))}`
    : '/';
  res.redirect(target);
});

app.get('/home', (req, res) => {
  res.redirect('/');
});

app.get('/login', staticFileLimiter, (req, res) => {
  if (maybeRedirectToEncodedRoute(req, res, '/login')) return;
  sendHtmlNoStore(res, path.join(__dirname, '../client/login.html'));
});

app.get('/register', staticFileLimiter, (req, res) => {
  if (maybeRedirectToEncodedRoute(req, res, '/register')) return;
  sendHtmlNoStore(res, path.join(__dirname, '../client/register.html'));
});

app.get('/creator', staticFileLimiter, (req, res) => {
  if (maybeRedirectToEncodedRoute(req, res, '/creator')) return;
  sendHtmlNoStore(res, path.join(__dirname, '../client/creator.html'));
});

app.get('/login.html', staticFileLimiter, (req, res) => {
  if (maybeRedirectToEncodedRoute(req, res, '/login')) return;
  res.redirect('/login');
});

app.get('/register.html', staticFileLimiter, (req, res) => {
  if (maybeRedirectToEncodedRoute(req, res, '/register')) return;
  res.redirect('/register');
});

app.get('/creator.html', staticFileLimiter, (req, res) => {
  if (maybeRedirectToEncodedRoute(req, res, '/creator')) return;
  res.redirect('/creator');
});

// Serve connect-portal page directly (no obfuscation for OAuth redirect)
app.get('/connect-portal', staticFileLimiter, (req, res) => {
  if (maybeRedirectToEncodedRoute(req, res, '/connect-portal')) return;
  sendHtmlNoStore(res, path.join(__dirname, '../client/connect-portal.html'));
});

app.get('/connect-portal.html', staticFileLimiter, (req, res) => {
  if (maybeRedirectToEncodedRoute(req, res, '/connect-portal')) return;
  res.redirect('/connect-portal');
});

// Serve SOA portal scraper page directly
app.get('/soa-scraper', staticFileLimiter, (req, res) => {
  if (maybeRedirectToEncodedRoute(req, res, '/soa-scraper')) return;
  sendHtmlNoStore(res, path.join(__dirname, '../client/soa-scraper.html'));
});

app.get('/soa-scraper.html', staticFileLimiter, (req, res) => {
  if (maybeRedirectToEncodedRoute(req, res, '/soa-scraper')) return;
  res.redirect('/soa-scraper');
});

// Public anchor convenience routes
app.get('/about', (req, res) => {
  res.redirect('/index.html#about');
});

app.get('/features', (req, res) => {
  res.redirect('/index.html#features');
});

app.get('/academics', (req, res) => {
  res.redirect('/index.html#academics');
});

app.get('/contact', (req, res) => {
  res.redirect('/index.html#contact');
});

// Serve dashboard pages directly (needed for login redirects)
const dashboardPageExistsCache = new Map();

app.get('/dashboard/:page', staticFileLimiter, (req, res) => {
  const page = req.params.page;
  const canonicalPage = page.endsWith('.html') ? page.slice(0, -5) : page;
  const requestedPage = `${canonicalPage}.html`;
  
  // Validate page parameter to prevent path traversal attacks
  // Only allow alphanumeric characters, hyphens, and an optional .html extension
  if (!/^[a-zA-Z0-9-]+(?:\.html)?$/.test(page) || !/^[a-zA-Z0-9-]+$/.test(canonicalPage)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid page name'
    });
  }
  
  const dashboardDir = path.resolve(__dirname, '../client/dashboard');
  const filePath = path.join(dashboardDir, requestedPage);
  
  // Ensure the resolved path is within the dashboard directory
  const resolvedPath = path.resolve(filePath);
  if (!resolvedPath.startsWith(dashboardDir)) {
    return res.status(403).json({
      success: false,
      message: 'Access denied'
    });
  }

  let pageExists = dashboardPageExistsCache.get(resolvedPath);
  if (pageExists === undefined) {
    pageExists = fs.existsSync(resolvedPath);
    dashboardPageExistsCache.set(resolvedPath, pageExists);
  }

  if (!pageExists) {
    return res.status(404).json({
      success: false,
      message: 'Dashboard page not found'
    });
  }

  if (maybeRedirectToEncodedRoute(req, res, `/dashboard/${canonicalPage}`)) {
    return;
  }

  if (page.endsWith('.html')) {
    const queryIndex = req.originalUrl.indexOf('?');
    const query = queryIndex >= 0 ? req.originalUrl.slice(queryIndex) : '';
    return res.redirect(`/dashboard/${canonicalPage}${query}`);
  }
  
  sendHtmlNoStore(res, resolvedPath, (err) => {
    if (err && !res.headersSent) {
      res.status(404).json({
        success: false,
        message: 'Dashboard page not found'
      });
    }
  });
});

// 404 handler for API routes only
app.use('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Error handling middleware (must be last)
app.use(errorHandler);

// Catch-all error handler to ensure JSON responses
app.use((err, req, res, next) => {
  if (!res.headersSent) {
    res.setHeader('Content-Type', 'application/json');
    res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || 'Internal Server Error'
    });
  }
});

// Initialize Redis cache
const { initRedis, closeRedis, isRedisConnected } = require('./config/redis.config');
const { startRenderKeepAlive } = require('./utils/render-keepalive');

// Start server (skipped on Vercel - the platform manages the HTTP listener)
const PORT = process.env.PORT || 5000;
let stopRenderKeepAlive = () => {};

if (!IS_SERVERLESS) {
  async function startServer() {
    try {
      // Initialize Redis connection (only in production)
      await initRedis();

      server.listen(PORT, () => {
        const cacheType = isRedisConnected() ? 'Redis' : 'In-Memory';
        console.log(`
╔═══════════════════════════════════════════════════════╗
║   ITERasn hub                                       ║
║   Server running on port ${PORT}                        ║
║   Environment: ${process.env.NODE_ENV || 'development'}                      ║
║   Socket.IO: Enabled                                  ║
║   Cache: ${cacheType}                                        ║
╚═══════════════════════════════════════════════════════╝
      `);

        stopRenderKeepAlive = startRenderKeepAlive();
      });
    } catch (error) {
      console.error('Failed to start server:', error);
      process.exit(1);
    }
  }

  // Start the server
  startServer();

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('SIGTERM received, closing server gracefully...');
    stopRenderKeepAlive();
    await closeRedis();
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  });

  process.on('SIGINT', async () => {
    console.log('SIGINT received, closing server gracefully...');
    stopRenderKeepAlive();
    await closeRedis();
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  });
}

module.exports = { app, server, io };
