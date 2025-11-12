const express = require('express');
const router = express.Router();
const { authMiddleware: auth } = require('../middleware/auth');
const searchService = require('../services/search.service');
const { query, validationResult } = require('express-validator');

/**
 * @route   GET /api/search
 * @desc    Global search across all resources
 * @access  Private
 */
router.get(
  '/',
  auth,
  [
    query('q')
      .trim()
      .notEmpty().withMessage('Search query is required')
      .isLength({ min: 2, max: 100 }).withMessage('Query must be 2-100 characters'),
    query('types')
      .optional()
      .isString(),
    query('page')
      .optional()
      .isInt({ min: 1 }).withMessage('Page must be positive')
      .toInt(),
    query('pageSize')
      .optional()
      .isInt({ min: 1, max: 100 }).withMessage('Page size must be 1-100')
      .toInt()
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

      const { q, types, page, pageSize, sortBy } = req.query;

      const result = await searchService.globalSearch(q, {
        userId: req.user.id,
        userRole: req.user.role,
        types: types ? types.split(',') : ['all'],
        page: parseInt(page) || 1,
        pageSize: parseInt(pageSize) || 20,
        sortBy: sortBy || 'relevance'
      });

      res.json(result);
    } catch (error) {
      console.error('Global search error:', error);
      res.status(500).json({
        success: false,
        message: 'Search failed',
        error: error.message
      });
    }
  }
);

/**
 * @route   GET /api/search/users
 * @desc    Search users with filters
 * @access  Private (Admin/Teacher)
 */
router.get(
  '/users',
  auth,
  [
    query('q').optional().trim().isLength({ max: 100 }),
    query('role').optional().isIn(['student', 'teacher', 'admin']),
    query('department').optional().trim(),
    query('year').optional().isInt({ min: 1, max: 5 }).toInt(),
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('pageSize').optional().isInt({ min: 1, max: 100 }).toInt()
  ],
  async (req, res) => {
    try {
      // Only admin and teachers can search all users
      if (!['admin', 'teacher'].includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }

      const { q, role, department, year, section, page, pageSize } = req.query;

      const result = await searchService.searchUsers(q, {
        role,
        department,
        year: year ? parseInt(year) : null,
        section,
        page: parseInt(page) || 1,
        pageSize: parseInt(pageSize) || 20
      });

      res.json(result);
    } catch (error) {
      console.error('Search users error:', error);
      res.status(500).json({
        success: false,
        message: 'User search failed',
        error: error.message
      });
    }
  }
);

/**
 * @route   GET /api/search/files
 * @desc    Search files with filters
 * @access  Private
 */
router.get(
  '/files',
  auth,
  [
    query('q').optional().trim().isLength({ max: 100 }),
    query('category').optional().isIn(['note', 'pyq', 'assignment', 'admit_card', 'announcement', 'personal', 'other']),
    query('subject').optional().trim(),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('pageSize').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('sortBy').optional().isIn(['created_at', 'file_size', 'download_count', 'original_name']),
    query('sortOrder').optional().isIn(['ASC', 'DESC'])
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

      const {
        q,
        category,
        subject,
        startDate,
        endDate,
        page,
        pageSize,
        sortBy,
        sortOrder
      } = req.query;

      const result = await searchService.searchFiles(q, {
        category,
        subject,
        startDate,
        endDate,
        page: parseInt(page) || 1,
        pageSize: parseInt(pageSize) || 20,
        sortBy: sortBy || 'created_at',
        sortOrder: sortOrder || 'DESC'
      });

      res.json(result);
    } catch (error) {
      console.error('Search files error:', error);
      res.status(500).json({
        success: false,
        message: 'File search failed',
        error: error.message
      });
    }
  }
);

/**
 * @route   GET /api/search/suggestions
 * @desc    Get search suggestions (autocomplete)
 * @access  Private
 */
router.get(
  '/suggestions',
  auth,
  [
    query('q')
      .trim()
      .notEmpty().withMessage('Query is required')
      .isLength({ min: 2, max: 50 }),
    query('type')
      .optional()
      .isIn(['all', 'users', 'subjects', 'files'])
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

      const { q, type } = req.query;

      const result = await searchService.getSuggestions(q, type || 'all');

      res.json(result);
    } catch (error) {
      console.error('Get suggestions error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get suggestions',
        error: error.message
      });
    }
  }
);

/**
 * @route   GET /api/search/trending
 * @desc    Get trending searches
 * @access  Private
 */
router.get('/trending', auth, async (req, res) => {
  try {
    const { limit } = req.query;

    const result = await searchService.getTrendingSearches(
      parseInt(limit) || 10
    );

    res.json(result);
  } catch (error) {
    console.error('Get trending searches error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get trending searches',
      error: error.message
    });
  }
});

module.exports = router;
