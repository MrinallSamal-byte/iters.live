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

// Import utilities
const urlRouter = require('./utils/url-router.util');

// Import middleware
const errorHandler = require('./middleware/errorHandler');
const { initializeSocket } = require('./socket/socket');

const app = express();
const server = http.createServer(app);

// Initialize Socket.IO
const io = socketIo(server, {
  cors: {
    origin: process.env.SOCKET_CORS_ORIGIN || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

initializeSocket(io);

// Make io accessible to routes
app.set('io', io);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: false
}));

// CORS configuration
const corsWhitelist = (process.env.CORS_WHITELIST || '').split(',');
app.use(cors({
  origin: function (origin, callback) {
    if (!origin || corsWhitelist.includes(origin)) {
      callback(null, true);
    } else {
      callback(null, true); // Allow all in development
    }
  },
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: 'Too many requests from this IP, please try again later.'
});

app.use('/api/', limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

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
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
app.use('/static/uploads', express.static(path.join(__dirname, '../uploads')));

// Serve client static assets (CSS, JS, images) - needed for pages served from /web/:sessionId
app.use('/css', express.static(path.join(__dirname, '../client/css')));
app.use('/js', express.static(path.join(__dirname, '../client/js')));
app.use('/assets', express.static(path.join(__dirname, '../client/assets')));
app.use('/partials', express.static(path.join(__dirname, '../client/partials')));

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
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV
  });
});

// API Routes
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

// Web routes for obfuscated URLs (/web/:sessionId)
app.use('/web', webRoutes);

// Link encoding redirect handler (/r/:encoded)
app.use('/r', redirectRoutes);

// Serve landing page (index.html) for root path - redirect to obfuscated URL
app.get('/', (req, res) => {
  const obfuscatedUrl = urlRouter.getObfuscatedUrl('home');
  res.redirect(obfuscatedUrl);
});

// Redirect /home to landing page
app.get('/home', (req, res) => {
  const obfuscatedUrl = urlRouter.getObfuscatedUrl('home');
  res.redirect(obfuscatedUrl);
});

// Serve connect-portal page directly (no obfuscation for OAuth redirect)
app.get('/connect-portal', staticFileLimiter, (req, res) => {
  res.sendFile(path.join(__dirname, '../client/connect-portal.html'));
});

app.get('/connect-portal.html', staticFileLimiter, (req, res) => {
  res.sendFile(path.join(__dirname, '../client/connect-portal.html'));
});

// Serve static HTML pages - redirect to obfuscated URLs
app.get('/about', (req, res) => {
  const obfuscatedUrl = urlRouter.getObfuscatedUrl('about');
  res.redirect(obfuscatedUrl);
});

app.get('/features', (req, res) => {
  const obfuscatedUrl = urlRouter.getObfuscatedUrl('features');
  res.redirect(obfuscatedUrl);
});

app.get('/academics', (req, res) => {
  const obfuscatedUrl = urlRouter.getObfuscatedUrl('academics');
  res.redirect(obfuscatedUrl);
});

app.get('/contact', (req, res) => {
  const obfuscatedUrl = urlRouter.getObfuscatedUrl('contact');
  res.redirect(obfuscatedUrl);
});

// Serve dashboard pages directly (needed for login redirects)
app.get('/dashboard/:page', staticFileLimiter, (req, res) => {
  const page = req.params.page;
  
  // Validate page parameter to prevent path traversal attacks
  // Only allow alphanumeric characters, hyphens, and .html extension
  if (!/^[a-zA-Z0-9-]+\.html$/.test(page)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid page name'
    });
  }
  
  const dashboardDir = path.resolve(__dirname, '../client/dashboard');
  const filePath = path.join(dashboardDir, page);
  
  // Ensure the resolved path is within the dashboard directory
  const resolvedPath = path.resolve(filePath);
  if (!resolvedPath.startsWith(dashboardDir)) {
    return res.status(403).json({
      success: false,
      message: 'Access denied'
    });
  }
  
  res.sendFile(resolvedPath, (err) => {
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

// Start server
const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════╗
║   ITER College Management System                     ║
║   Server running on port ${PORT}                        ║
║   Environment: ${process.env.NODE_ENV || 'development'}                      ║
║   Socket.IO: Enabled                                  ║
╚═══════════════════════════════════════════════════════╝
  `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, closing server gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

module.exports = { app, server, io };
