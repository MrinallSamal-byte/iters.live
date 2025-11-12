/**
 * Bulk Operations Routes
 * Handles bulk import/export operations
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { body, query, validationResult } = require('express-validator');
const { authMiddleware: authenticate, roleMiddleware: authorize } = require('../middleware/auth');
const bulkOperationsService = require('../services/bulk-operations.service');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../uploads/bulk'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'bulk-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.csv', '.xlsx', '.xls'];
    const ext = path.extname(file.originalname).toLowerCase();
    
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only CSV and Excel files are allowed.'));
    }
  }
});

/**
 * POST /api/bulk/users/import
 * Bulk create users from CSV/Excel file
 */
router.post('/users/import',
  authenticate,
  authorize(['admin']),
  upload.single('file'),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'No file uploaded'
        });
      }

      const fileType = path.extname(req.file.originalname).toLowerCase() === '.csv' ? 'csv' : 'xlsx';
      const results = await bulkOperationsService.bulkCreateUsers(req.file.path, fileType);

      res.json({
        success: true,
        message: 'Bulk user creation completed',
        data: results
      });
    } catch (error) {
      console.error('Bulk user import error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to import users',
        error: error.message
      });
    }
  }
);

/**
 * POST /api/bulk/attendance/import
 * Bulk mark attendance from CSV
 */
router.post('/attendance/import',
  authenticate,
  authorize(['teacher', 'admin']),
  upload.single('file'),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'No file uploaded'
        });
      }

      const results = await bulkOperationsService.bulkMarkAttendance(req.file.path, req.user.id);

      // Emit socket event for bulk attendance update
      const io = req.app.get('io');
      if (io) {
        io.emit('attendance:bulk-update', {
          teacherId: req.user.id,
          teacherName: req.user.full_name,
          count: results.success
        });
      }

      res.json({
        success: true,
        message: 'Bulk attendance marking completed',
        data: results
      });
    } catch (error) {
      console.error('Bulk attendance import error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to import attendance',
        error: error.message
      });
    }
  }
);

/**
 * POST /api/bulk/marks/import
 * Bulk upload marks from Excel
 */
router.post('/marks/import',
  authenticate,
  authorize(['teacher', 'admin']),
  upload.single('file'),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'No file uploaded'
        });
      }

      const results = await bulkOperationsService.bulkUploadMarks(req.file.path, req.user.id);

      // Emit socket event for bulk marks update
      const io = req.app.get('io');
      if (io) {
        io.emit('marks:bulk-update', {
          teacherId: req.user.id,
          teacherName: req.user.full_name,
          count: results.success
        });
      }

      res.json({
        success: true,
        message: 'Bulk marks upload completed',
        data: results
      });
    } catch (error) {
      console.error('Bulk marks import error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to import marks',
        error: error.message
      });
    }
  }
);

/**
 * GET /api/bulk/export
 * Export data to CSV or Excel
 */
router.get('/export',
  authenticate,
  authorize(['teacher', 'admin']),
  [
    query('type').isIn(['users', 'attendance', 'marks']).withMessage('Invalid export type'),
    query('format').isIn(['csv', 'xlsx']).withMessage('Invalid format'),
    query('department').optional().trim(),
    query('year').optional().isInt(),
    query('section').optional().trim(),
    query('startDate').optional().isDate(),
    query('endDate').optional().isDate()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }

      const { type, format, department, year, section, startDate, endDate } = req.query;
      const filters = { department, year, section, startDate, endDate };

      let data, contentType, filename;

      if (format === 'csv') {
        data = await bulkOperationsService.exportToCSV(type, filters);
        contentType = 'text/csv';
        filename = `${type}_export_${Date.now()}.csv`;
      } else {
        data = await bulkOperationsService.exportToExcel(type, filters);
        contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        filename = `${type}_export_${Date.now()}.xlsx`;
      }

      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(data);
    } catch (error) {
      console.error('Export error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to export data',
        error: error.message
      });
    }
  }
);

/**
 * GET /api/bulk/templates/:type
 * Download template file for bulk import
 */
router.get('/templates/:type',
  authenticate,
  authorize(['teacher', 'admin']),
  async (req, res) => {
    try {
      const { type } = req.params;
      const format = req.query.format || 'csv';

      let headers = [];

      switch (type) {
        case 'users':
          headers = ['username', 'email', 'password', 'full_name', 'role', 'department', 'year', 'section', 'phone', 'address'];
          break;
        case 'attendance':
          headers = ['student_id', 'subject', 'date', 'status', 'remarks'];
          break;
        case 'marks':
          headers = ['student_id', 'subject', 'exam_type', 'marks_obtained', 'total_marks', 'remarks'];
          break;
        default:
          return res.status(400).json({
            success: false,
            message: 'Invalid template type'
          });
      }

      if (format === 'csv') {
        const csv = headers.join(',') + '\n';
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${type}_template.csv"`);
        res.send(csv);
      } else {
        const ExcelJS = require('exceljs');
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Template');
        
        worksheet.columns = headers.map(h => ({
          header: h.replace(/_/g, ' ').toUpperCase(),
          key: h,
          width: 20
        }));

        // Style header
        worksheet.getRow(1).font = { bold: true };
        worksheet.getRow(1).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF4CAF50' }
        };

        const buffer = await workbook.xlsx.writeBuffer();
        
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${type}_template.xlsx"`);
        res.send(buffer);
      }
    } catch (error) {
      console.error('Template download error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to generate template',
        error: error.message
      });
    }
  }
);

module.exports = router;
