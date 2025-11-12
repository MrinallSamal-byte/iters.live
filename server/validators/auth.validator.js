const { body, param, query, validationResult } = require('express-validator');

/**
 * Validation middleware for authentication routes
 */

// Password strength validator
const passwordStrength = (value) => {
  const minLength = 8;
  const hasUpperCase = /[A-Z]/.test(value);
  const hasLowerCase = /[a-z]/.test(value);
  const hasNumbers = /\d/.test(value);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(value);

  if (value.length < minLength) {
    throw new Error('Password must be at least 8 characters long');
  }
  if (!hasUpperCase) {
    throw new Error('Password must contain at least one uppercase letter');
  }
  if (!hasLowerCase) {
    throw new Error('Password must contain at least one lowercase letter');
  }
  if (!hasNumbers) {
    throw new Error('Password must contain at least one number');
  }
  if (!hasSpecialChar) {
    throw new Error('Password must contain at least one special character');
  }
  return true;
};

// Registration validation rules
const registerValidation = [
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
    .matches(/^[A-Z0-9-]+$/i).withMessage('Invalid registration number format')
    .escape(),
  
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Invalid email format')
    .normalizeEmail()
    .isLength({ max: 255 }).withMessage('Email must be less than 255 characters'),
  
  body('password')
    .notEmpty().withMessage('Password is required')
    .custom(passwordStrength),
  
  body('confirmPassword')
    .notEmpty().withMessage('Confirm password is required')
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error('Passwords do not match');
      }
      return true;
    }),
  
  body('phone_number')
    .trim()
    .notEmpty().withMessage('Phone number is required')
    .matches(/^[6-9]\d{9}$/).withMessage('Invalid Indian phone number format')
    .isLength({ min: 10, max: 10 }).withMessage('Phone number must be 10 digits'),
  
  body('department')
    .trim()
    .notEmpty().withMessage('Department is required')
    .isLength({ min: 2, max: 100 }).withMessage('Department must be between 2 and 100 characters')
    .escape(),
  
  body('role')
    .optional()
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

// Login validation rules
const loginValidation = [
  body('identifier')
    .trim()
    .notEmpty().withMessage('Email or registration number is required')
    .isLength({ min: 3, max: 255 }).withMessage('Invalid identifier length'),
  
  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
];

// Change password validation rules
const changePasswordValidation = [
  body('currentPassword')
    .notEmpty().withMessage('Current password is required'),
  
  body('newPassword')
    .notEmpty().withMessage('New password is required')
    .custom(passwordStrength)
    .custom((value, { req }) => {
      if (value === req.body.currentPassword) {
        throw new Error('New password must be different from current password');
      }
      return true;
    }),
  
  body('confirmNewPassword')
    .notEmpty().withMessage('Confirm new password is required')
    .custom((value, { req }) => {
      if (value !== req.body.newPassword) {
        throw new Error('Passwords do not match');
      }
      return true;
    })
];

// Reset password request validation
const resetPasswordRequestValidation = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Invalid email format')
    .normalizeEmail()
];

// Reset password validation
const resetPasswordValidation = [
  body('token')
    .notEmpty().withMessage('Reset token is required'),
  
  body('newPassword')
    .notEmpty().withMessage('New password is required')
    .custom(passwordStrength),
  
  body('confirmNewPassword')
    .notEmpty().withMessage('Confirm new password is required')
    .custom((value, { req }) => {
      if (value !== req.body.newPassword) {
        throw new Error('Passwords do not match');
      }
      return true;
    })
];

// Validation result handler middleware
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map(err => ({
        field: err.param,
        message: err.msg,
        value: err.value
      }))
    });
  }
  next();
};

module.exports = {
  registerValidation,
  loginValidation,
  changePasswordValidation,
  resetPasswordRequestValidation,
  resetPasswordValidation,
  validate,
  passwordStrength
};
