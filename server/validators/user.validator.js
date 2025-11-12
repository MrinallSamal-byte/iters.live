const { body, param, query } = require('express-validator');
const { validate } = require('./auth.validator');

/**
 * Validation middleware for user management routes
 */

// Create user validation
const createUserValidation = [
  body('name')
    .trim()
    .notEmpty().withMessage('Name is required')
    .isLength({ min: 2, max: 255 }).withMessage('Name must be between 2 and 255 characters')
    .matches(/^[a-zA-Z\s]+$/).withMessage('Name must contain only letters and spaces')
    .escape(),
  
  body('registration_number')
    .trim()
    .notEmpty().withMessage('Registration number is required')
    .isLength({ min: 5, max: 50 }).withMessage('Registration number must be between 5 and 50 characters')
    .escape(),
  
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Invalid email format')
    .normalizeEmail(),
  
  body('phone_number')
    .trim()
    .notEmpty().withMessage('Phone number is required')
    .matches(/^[6-9]\d{9}$/).withMessage('Invalid phone number format'),
  
  body('department')
    .trim()
    .notEmpty().withMessage('Department is required')
    .escape(),
  
  body('role')
    .notEmpty().withMessage('Role is required')
    .isIn(['student', 'teacher', 'admin']).withMessage('Invalid role'),
  
  body('year')
    .optional()
    .isInt({ min: 1, max: 5 }).withMessage('Year must be between 1 and 5'),
  
  body('section')
    .optional()
    .trim()
    .isLength({ max: 10 }).withMessage('Section must be less than 10 characters')
    .escape()
];

// Update user validation
const updateUserValidation = [
  param('id')
    .isInt({ min: 1 }).withMessage('Invalid user ID'),
  
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 255 }).withMessage('Name must be between 2 and 255 characters')
    .escape(),
  
  body('email')
    .optional()
    .trim()
    .isEmail().withMessage('Invalid email format')
    .normalizeEmail(),
  
  body('phone_number')
    .optional()
    .trim()
    .matches(/^[6-9]\d{9}$/).withMessage('Invalid phone number format'),
  
  body('department')
    .optional()
    .trim()
    .escape(),
  
  body('year')
    .optional()
    .isInt({ min: 1, max: 5 }).withMessage('Year must be between 1 and 5'),
  
  body('section')
    .optional()
    .trim()
    .escape(),
  
  body('is_active')
    .optional()
    .isBoolean().withMessage('is_active must be a boolean')
];

// Get user by ID validation
const getUserValidation = [
  param('id')
    .isInt({ min: 1 }).withMessage('Invalid user ID')
];

// Delete user validation
const deleteUserValidation = [
  param('id')
    .isInt({ min: 1 }).withMessage('Invalid user ID')
];

// Get users with filters validation
const getUsersValidation = [
  query('role')
    .optional()
    .isIn(['student', 'teacher', 'admin']).withMessage('Invalid role'),
  
  query('department')
    .optional()
    .trim()
    .escape(),
  
  query('year')
    .optional()
    .isInt({ min: 1, max: 5 }).withMessage('Year must be between 1 and 5'),
  
  query('section')
    .optional()
    .trim()
    .escape(),
  
  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('Page must be a positive integer')
    .toInt(),
  
  query('pageSize')
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage('Page size must be between 1 and 100')
    .toInt(),
  
  query('search')
    .optional()
    .trim()
    .isLength({ max: 255 }).withMessage('Search query too long')
    .escape()
];

// Bulk create users validation
const bulkCreateUsersValidation = [
  body('users')
    .isArray({ min: 1, max: 1000 }).withMessage('Users must be an array with 1-1000 items'),
  
  body('users.*.name')
    .trim()
    .notEmpty().withMessage('Name is required')
    .isLength({ min: 2, max: 255 }).withMessage('Name must be between 2 and 255 characters')
    .escape(),
  
  body('users.*.registration_number')
    .trim()
    .notEmpty().withMessage('Registration number is required')
    .escape(),
  
  body('users.*.email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Invalid email format')
    .normalizeEmail(),
  
  body('users.*.phone_number')
    .trim()
    .notEmpty().withMessage('Phone number is required')
    .matches(/^[6-9]\d{9}$/).withMessage('Invalid phone number format'),
  
  body('users.*.department')
    .trim()
    .notEmpty().withMessage('Department is required')
    .escape(),
  
  body('users.*.role')
    .notEmpty().withMessage('Role is required')
    .isIn(['student', 'teacher', 'admin']).withMessage('Invalid role')
];

module.exports = {
  createUserValidation,
  updateUserValidation,
  getUserValidation,
  deleteUserValidation,
  getUsersValidation,
  bulkCreateUsersValidation,
  validate
};
