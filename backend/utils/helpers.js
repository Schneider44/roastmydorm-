/**
 * Async handler wrapper to avoid try-catch boilerplate
 * Automatically catches errors and passes to error middleware
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Custom error class with status code
 */
class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Common error types
 */
const errors = {
  notFound: (resource = 'Resource') => new AppError(`${resource} not found`, 404),
  unauthorized: (message = 'Unauthorized') => new AppError(message, 401),
  forbidden: (message = 'Forbidden') => new AppError(message, 403),
  badRequest: (message = 'Bad request') => new AppError(message, 400),
  conflict: (message = 'Resource already exists') => new AppError(message, 409),
  validation: (message = 'Validation failed') => new AppError(message, 422),
  internal: (message = 'Internal server error') => new AppError(message, 500)
};

/**
 * Pagination helper
 */
const paginate = (query, { page = 1, limit = 10, maxLimit = 100 }) => {
  const parsedPage = Math.max(1, parseInt(page));
  const parsedLimit = Math.min(maxLimit, Math.max(1, parseInt(limit)));
  const skip = (parsedPage - 1) * parsedLimit;

  return {
    query: query.skip(skip).limit(parsedLimit),
    page: parsedPage,
    limit: parsedLimit,
    skip
  };
};

/**
 * Build pagination response
 */
const paginationResponse = (data, total, { page, limit }) => {
  return {
    data,
    pagination: {
      current: page,
      pages: Math.ceil(total / limit),
      total,
      limit,
      hasNext: page < Math.ceil(total / limit),
      hasPrev: page > 1
    }
  };
};

/**
 * Sleep utility for delays
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Retry utility for flaky operations
 */
const retry = async (fn, options = {}) => {
  const { 
    retries = 3, 
    delay = 1000, 
    backoff = 2,
    onRetry = () => {} 
  } = options;

  let lastError;
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (attempt < retries) {
        onRetry(error, attempt);
        await sleep(delay * Math.pow(backoff, attempt - 1));
      }
    }
  }

  throw lastError;
};

/**
 * Pick specific fields from object
 */
const pick = (obj, keys) => {
  return keys.reduce((acc, key) => {
    if (obj && Object.prototype.hasOwnProperty.call(obj, key)) {
      acc[key] = obj[key];
    }
    return acc;
  }, {});
};

/**
 * Omit specific fields from object
 */
const omit = (obj, keys) => {
  return Object.keys(obj)
    .filter(key => !keys.includes(key))
    .reduce((acc, key) => {
      acc[key] = obj[key];
      return acc;
    }, {});
};

/**
 * Generate random string
 */
const randomString = (length = 32) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

module.exports = {
  asyncHandler,
  AppError,
  errors,
  paginate,
  paginationResponse,
  sleep,
  retry,
  pick,
  omit,
  randomString
};
