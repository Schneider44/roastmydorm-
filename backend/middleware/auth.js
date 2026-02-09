const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Verify JWT secret is configured
 */
const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32 || secret.includes('CHANGE_ME')) {
    throw new Error('JWT_SECRET is not properly configured. Please set a strong secret in environment variables.');
  }
  return secret;
};

const getRefreshSecret = () => {
  const secret = process.env.JWT_REFRESH_SECRET;
  if (!secret || secret.length < 32 || secret.includes('CHANGE_ME')) {
    throw new Error('JWT_REFRESH_SECRET is not properly configured.');
  }
  return secret;
};

/**
 * Generate access token (short-lived)
 */
const generateAccessToken = (userId) => {
  return jwt.sign(
    { userId, type: 'access' },
    getJwtSecret(),
    { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
  );
};

/**
 * Generate refresh token (long-lived)
 */
const generateRefreshToken = (userId) => {
  return jwt.sign(
    { userId, type: 'refresh' },
    getRefreshSecret(),
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
  );
};

/**
 * Main authentication middleware
 */
const auth = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'No token provided, authorization denied'
      });
    }

    const token = authHeader.replace('Bearer ', '');

    // Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, getJwtSecret());
    } catch (jwtError) {
      if (jwtError.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'Token expired',
          code: 'TOKEN_EXPIRED'
        });
      }
      throw jwtError;
    }

    // Ensure it's an access token
    if (decoded.type !== 'access') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token type'
      });
    }

    // Fetch user
    const user = await User.findById(decoded.userId).select('-password -resetPasswordToken -verificationToken');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Account is deactivated'
      });
    }

    req.user = user;
    req.token = token;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error.message);
    res.status(401).json({
      success: false,
      message: 'Token is not valid'
    });
  }
};

/**
 * Optional auth - doesn't fail if no token
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.replace('Bearer ', '');
    const decoded = jwt.verify(token, getJwtSecret());
    
    if (decoded.type === 'access') {
      const user = await User.findById(decoded.userId).select('-password');
      if (user && user.isActive) {
        req.user = user;
      }
    }
    next();
  } catch (error) {
    // Token invalid but optional, continue without user
    next();
  }
};

/**
 * Require specific role(s)
 */
const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const userRole = req.user.role || req.user.userType;
    if (!roles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required role: ${roles.join(' or ')}`
      });
    }
    next();
  };
};

/**
 * Verify refresh token and issue new tokens
 */
const verifyRefreshToken = async (refreshToken) => {
  try {
    const decoded = jwt.verify(refreshToken, getRefreshSecret());
    
    if (decoded.type !== 'refresh') {
      throw new Error('Invalid token type');
    }

    const user = await User.findById(decoded.userId);
    if (!user || !user.isActive) {
      throw new Error('User not found or inactive');
    }

    return {
      accessToken: generateAccessToken(user._id),
      refreshToken: generateRefreshToken(user._id),
      user: {
        id: user._id,
        name: user.firstName + ' ' + user.lastName,
        email: user.email,
        role: user.userType
      }
    };
  } catch (error) {
    throw new Error('Invalid refresh token');
  }
};

module.exports = {
  auth,
  optionalAuth,
  requireRole,
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  getJwtSecret
};

