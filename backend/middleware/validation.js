const { body, param, query, validationResult } = require('express-validator');

/**
 * Middleware to handle validation errors
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map(err => ({
        field: err.path,
        message: err.msg
      }))
    });
  }
  next();
};

/**
 * Sanitize and escape HTML to prevent XSS
 */
const sanitizeHtml = (value) => {
  if (typeof value !== 'string') return value;
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .trim();
};

/**
 * Auth validation rules
 */
const authValidation = {
  register: [
    body('name')
      .trim()
      .notEmpty().withMessage('Name is required')
      .isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters')
      .customSanitizer(sanitizeHtml),
    body('email')
      .trim()
      .notEmpty().withMessage('Email is required')
      .isEmail().withMessage('Please provide a valid email')
      .normalizeEmail()
      .isLength({ max: 255 }).withMessage('Email too long'),
    body('password')
      .notEmpty().withMessage('Password is required')
      .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).withMessage('Password must contain uppercase, lowercase and number'),
    body('phone')
      .optional()
      .isMobilePhone().withMessage('Please provide a valid phone number'),
    body('role')
      .optional()
      .isIn(['student', 'landlord']).withMessage('Role must be student or landlord'),
    handleValidationErrors
  ],

  login: [
    body('email')
      .trim()
      .notEmpty().withMessage('Email is required')
      .isEmail().withMessage('Please provide a valid email')
      .normalizeEmail(),
    body('password')
      .notEmpty().withMessage('Password is required'),
    handleValidationErrors
  ]
};

/**
 * Dorm validation rules
 */
const dormValidation = {
  create: [
    body('title')
      .trim()
      .notEmpty().withMessage('Title is required')
      .isLength({ min: 5, max: 200 }).withMessage('Title must be between 5 and 200 characters')
      .customSanitizer(sanitizeHtml),
    body('description')
      .trim()
      .notEmpty().withMessage('Description is required')
      .isLength({ min: 20, max: 5000 }).withMessage('Description must be between 20 and 5000 characters')
      .customSanitizer(sanitizeHtml),
    body('price')
      .notEmpty().withMessage('Price is required')
      .isInt({ min: 0, max: 100000 }).withMessage('Price must be a valid number between 0 and 100000'),
    body('location')
      .trim()
      .notEmpty().withMessage('Location is required')
      .isLength({ max: 500 }).withMessage('Location too long')
      .customSanitizer(sanitizeHtml),
    body('roomType')
      .optional()
      .isIn(['single', 'double', 'shared', 'studio', 'apartment']).withMessage('Invalid room type'),
    body('amenities')
      .optional()
      .isArray().withMessage('Amenities must be an array'),
    body('amenities.*')
      .optional()
      .isString().withMessage('Each amenity must be a string')
      .customSanitizer(sanitizeHtml),
    handleValidationErrors
  ],

  update: [
    param('id')
      .isMongoId().withMessage('Invalid dorm ID'),
    body('title')
      .optional()
      .trim()
      .isLength({ min: 5, max: 200 }).withMessage('Title must be between 5 and 200 characters')
      .customSanitizer(sanitizeHtml),
    body('description')
      .optional()
      .trim()
      .isLength({ min: 20, max: 5000 }).withMessage('Description must be between 20 and 5000 characters')
      .customSanitizer(sanitizeHtml),
    body('price')
      .optional()
      .isInt({ min: 0, max: 100000 }).withMessage('Price must be a valid number'),
    handleValidationErrors
  ],

  getById: [
    param('id')
      .isMongoId().withMessage('Invalid dorm ID'),
    handleValidationErrors
  ],

  list: [
    query('page')
      .optional()
      .isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('minPrice')
      .optional()
      .isInt({ min: 0 }).withMessage('Min price must be a positive number'),
    query('maxPrice')
      .optional()
      .isInt({ min: 0 }).withMessage('Max price must be a positive number'),
    query('search')
      .optional()
      .trim()
      .isLength({ max: 200 }).withMessage('Search query too long')
      .customSanitizer(sanitizeHtml),
    handleValidationErrors
  ]
};

/**
 * Review validation rules
 */
const reviewValidation = {
  create: [
    body('dormId')
      .notEmpty().withMessage('Dorm ID is required')
      .isMongoId().withMessage('Invalid dorm ID'),
    body('rating')
      .notEmpty().withMessage('Rating is required')
      .isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
    body('text')
      .trim()
      .notEmpty().withMessage('Review text is required')
      .isLength({ min: 10, max: 2000 }).withMessage('Review must be between 10 and 2000 characters')
      .customSanitizer(sanitizeHtml),
    handleValidationErrors
  ]
};

/**
 * Message validation rules
 */
const messageValidation = {
  send: [
    body('recipientId')
      .notEmpty().withMessage('Recipient ID is required')
      .isMongoId().withMessage('Invalid recipient ID'),
    body('content')
      .trim()
      .notEmpty().withMessage('Message content is required')
      .isLength({ min: 1, max: 5000 }).withMessage('Message must be between 1 and 5000 characters')
      .customSanitizer(sanitizeHtml),
    handleValidationErrors
  ]
};

/**
 * Common param validation
 */
const mongoIdParam = [
  param('id')
    .isMongoId().withMessage('Invalid ID format'),
  handleValidationErrors
];

module.exports = {
  handleValidationErrors,
  sanitizeHtml,
  authValidation,
  dormValidation,
  reviewValidation,
  messageValidation,
  mongoIdParam
};
