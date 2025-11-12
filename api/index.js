// Vercel serverless function entry point
const express = require('express');
const app = express();

// Import all middleware and routes from server
require('dotenv').config();
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const morgan = require('morgan');
const path = require('path');

// Middleware
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

app.use(cors({
  origin: '*',
  credentials: true
}));

app.use(compression());
app.use(morgan('combined'));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Import routes
const authRoutes = require('../server/routes/auth.routes');
const userRoutes = require('../server/routes/user.routes');
const profileRoutes = require('../server/routes/profile.routes');
const admitCardRoutes = require('../server/routes/admitcard.routes');
const attendanceRoutes = require('../server/routes/attendance.routes');
const marksRoutes = require('../server/routes/marks.routes');
const fileRoutes = require('../server/routes/file.routes');
const eventRoutes = require('../server/routes/event.routes');
const assignmentRoutes = require('../server/routes/assignment.routes');
const timetableRoutes = require('../server/routes/timetable.routes');
const hostelRoutes = require('../server/routes/hostel.routes');
const adminRoutes = require('../server/routes/admin.routes');
const teacherRoutes = require('../server/routes/teacher.routes');
const analyticsRoutes = require('../server/routes/analytics.routes');
const notificationRoutes = require('../server/routes/notification.routes');
const searchRoutes = require('../server/routes/search.routes');
const healthRoutes = require('../server/routes/health.routes');
const bulkRoutes = require('../server/routes/bulk.routes');
const notesRoutes = require('../server/routes/notes.routes');

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/admit-cards', admitCardRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/marks', marksRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/assignments', assignmentRoutes);
app.use('/api/timetables', timetableRoutes);
app.use('/api/hostel', hostelRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/teacher', teacherRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/health', healthRoutes);
app.use('/api/bulk', bulkRoutes);
app.use('/api/notes', notesRoutes);

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error'
  });
});

module.exports = app;
