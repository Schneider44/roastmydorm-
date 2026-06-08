const express = require('express');
const router = express.Router();
const User = require('../models/User');
const crypto = require('crypto');
const { auth, generateAccessToken, generateRefreshToken, storeRefreshToken, verifyRefreshToken } = require('../middleware/auth');
const { authValidation } = require('../middleware/validation');
const { asyncHandler, errors } = require('../utils/helpers');
const { generateVerificationCode, sendVerificationEmail } = require('../utils/email');

// POST /api/auth/register - Register new user
router.post('/register', authValidation.register, asyncHandler(async (req, res) => {
  const { name, email, password, phone, role = 'student' } = req.body;

  // Check if user already exists
  const existingUser = await User.findOne({ email: email.toLowerCase() });
  if (existingUser) {
    throw errors.conflict('User already exists with this email');
  }

  // Split name into firstName and lastName
  const nameParts = name.trim().split(' ');
  const firstName = nameParts[0];
  const lastName = nameParts.slice(1).join(' ') || '';

  // Create new user
  const user = new User({
    firstName,
    lastName,
    email: email.toLowerCase(),
    password,
    phone,
    userType: role
  });

  await user.save();

  // Generate tokens and store refresh token in DB
  const accessToken = generateAccessToken(user._id);
  const refreshToken = generateRefreshToken(user._id);
  await storeRefreshToken(user._id, refreshToken);

  res.status(201).json({
    success: true,
    data: {
      user: {
        id: user._id,
        name: `${user.firstName} ${user.lastName}`.trim(),
        email: user.email,
        role: user.userType,
        verified: user.isVerified
      },
      accessToken,
      refreshToken
    },
    message: 'User registered successfully'
  });
}));

// POST /api/auth/login - Login user
router.post('/login', authValidation.login, asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // Development mode: Support test admin credentials
  if (process.env.NODE_ENV !== 'production' && 
      email.toLowerCase() === 'admin@roastmydorm.com' && 
      password === 'Admin@123456') {
    
    const testAdminId = '507f1f77bcf86cd799439011'; // fixed ID for testing
    const accessToken = generateAccessToken(testAdminId);
    const refreshToken = generateRefreshToken(testAdminId);
    
    return res.json({
      success: true,
      data: {
        user: {
          id: testAdminId,
          name: 'Admin User',
          email: 'admin@roastmydorm.com',
          role: 'admin',
          verified: true
        },
        accessToken,
        refreshToken
      },
      message: 'Logged in with test credentials (development mode)'
    });
  }

  // Normal DB login
  // Find user by email (include password for comparison)
  const user = await User.findOne({ email: email.toLowerCase() });
  
  // Use consistent error message to prevent user enumeration
  if (!user) {
    throw errors.unauthorized('Invalid credentials');
  }

  // Check if account is active
  if (!user.isActive) {
    throw errors.forbidden('Account is deactivated. Please contact support.');
  }

  // Check password
  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    throw errors.unauthorized('Invalid credentials');
  }

  // Update last login (use updateOne to avoid triggering pre-save hooks)
  await User.updateOne(
    { _id: user._id },
    { $set: { lastLogin: new Date() }, $inc: { loginCount: 1 } }
  );

  // Generate tokens and store refresh token in DB
  const accessToken = generateAccessToken(user._id);
  const refreshToken = generateRefreshToken(user._id);
  await storeRefreshToken(user._id, refreshToken);

  res.json({
    success: true,
    data: {
      user: {
        id: user._id,
        name: `${user.firstName} ${user.lastName}`.trim(),
        email: user.email,
        role: user.role,
        userType: user.userType,
        verified: user.isVerified
      },
      accessToken,
      refreshToken
    },
    message: 'Login successful'
  });
}));

// POST /api/auth/refresh - Refresh access token
router.post('/refresh', asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    throw errors.badRequest('Refresh token is required');
  }

  const tokens = await verifyRefreshToken(refreshToken);

  res.json({
    success: true,
    data: tokens,
    message: 'Token refreshed successfully'
  });
}));

// POST /api/auth/logout - Logout (revoke refresh token from DB)
router.post('/logout', auth, asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  if (refreshToken) {
    await User.updateOne(
      { _id: req.user._id },
      { $pull: { refreshTokens: { token: refreshToken } } }
    );
  }
  res.json({
    success: true,
    message: 'Logged out successfully'
  });
}));

// GET /api/auth/me - Get current user
router.get('/me', auth, asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: {
      user: {
        id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        role: req.user.role,
        verified: req.user.verified,
        phone: req.user.phone
      }
    }
  });
}));

// PUT /api/auth/profile - Update user profile
router.put('/profile', auth, asyncHandler(async (req, res) => {
  const { name, phone, preferences } = req.body;
  const updateData = {};

  if (name) updateData.name = name;
  if (phone) updateData.phone = phone;
  if (preferences) updateData.preferences = { ...req.user.preferences, ...preferences };

  const user = await User.findByIdAndUpdate(
    req.user._id,
    updateData,
    { new: true, runValidators: true }
  ).select('-password');

  res.json({
    success: true,
    data: { user },
    message: 'Profile updated successfully'
  });
}));

// POST /api/auth/change-password - Change password
router.post('/change-password', auth, asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!newPassword || newPassword.length < 8) {
    throw errors.badRequest('New password must be at least 8 characters.');
  }
  if (!/[A-Z]/.test(newPassword) || !/\d/.test(newPassword)) {
    throw errors.badRequest('New password must contain at least one uppercase letter and one number.');
  }
  if (newPassword === currentPassword) {
    throw errors.badRequest('New password must be different from current password.');
  }

  const user = await User.findById(req.user._id);
  const isMatch = await user.comparePassword(currentPassword);
  if (!isMatch) {
    throw errors.badRequest('Current password is incorrect.');
  }

  user.password = newPassword;
  await user.save();

  // Revoke all refresh tokens on password change (force re-login everywhere)
  await User.updateOne({ _id: user._id }, { $set: { refreshTokens: [] } });

  res.json({
    success: true,
    message: 'Password changed successfully. Please log in again.'
  });
}));

// POST /api/auth/send-verification - Send verification code to email
router.post('/send-verification', asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email || !email.includes('@')) {
    throw errors.badRequest('Valid email address is required');
  }

  const normalizedEmail = email.toLowerCase().trim();

  // Check if user already exists and is verified
  let user = await User.findOne({ email: normalizedEmail });
  
  if (user && user.isVerified) {
    throw errors.conflict('This email is already verified');
  }

  // Generate 6-digit verification code
  const verificationCode = generateVerificationCode();
  const verificationExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

  if (user) {
    // Update existing unverified user
    user.verificationToken = verificationCode;
    user.verificationExpires = verificationExpires;
    await user.save();
  } else {
    // Create temporary user record for verification
    user = new User({
      firstName: 'Pending',
      lastName: 'Verification',
      email: normalizedEmail,
      verificationToken: verificationCode,
      verificationExpires: verificationExpires,
      isVerified: false,
      userType: 'student'
    });
    await user.save();
  }

  // Send verification email
  const name = user.firstName !== 'Pending' ? user.firstName : normalizedEmail.split('@')[0];
  try {
    await sendVerificationEmail(normalizedEmail, name, verificationCode, 'code');
  } catch (emailErr) {
    console.error('[send-verification] Email delivery failed:', emailErr.message, emailErr.stack);
    throw errors.internal('Unable to send verification email. Please try again in a few minutes or contact support.');
  }

  res.json({
    success: true,
    message: 'Verification code sent! Check your email.',
    expiresIn: '15 minutes'
  });
}));

// POST /api/auth/verify-code - Verify email with code
router.post('/verify-code', asyncHandler(async (req, res) => {
  const { email, code, name, password } = req.body;

  if (!email || !code) {
    throw errors.badRequest('Email and verification code are required');
  }

  const normalizedEmail = email.toLowerCase().trim();
  const user = await User.findOne({ email: normalizedEmail });

  if (!user) {
    throw errors.notFound('No verification pending for this email');
  }

  if (user.isVerified) {
    throw errors.conflict('Email is already verified');
  }

  // Timing-safe comparison to prevent timing attacks
  const provided = Buffer.from(code.toString().trim());
  const stored = Buffer.from(user.verificationToken || '');
  const isValidCode = provided.length === stored.length &&
    crypto.timingSafeEqual(provided, stored);
  if (!isValidCode) {
    throw errors.badRequest('Invalid verification code');
  }

  // Check if code has expired
  if (user.verificationExpires && user.verificationExpires < new Date()) {
    throw errors.badRequest('Verification code has expired. Please request a new one.');
  }

  // Update user as verified
  user.isVerified = true;
  user.verificationToken = undefined;
  user.verificationExpires = undefined;
  
  // Update name if provided
  if (name) {
    const nameParts = name.trim().split(' ');
    user.firstName = nameParts[0];
    user.lastName = nameParts.slice(1).join(' ') || '';
  }

  // Set password if provided (for new registrations)
  if (password) {
    user.password = password;
  }

  await user.save();

  // Generate tokens for automatic login and store refresh token
  const accessToken = generateAccessToken(user._id);
  const refreshToken = generateRefreshToken(user._id);
  await storeRefreshToken(user._id, refreshToken);

  res.json({
    success: true,
    message: 'Email verified successfully!',
    data: {
      user: {
        id: user._id,
        name: `${user.firstName} ${user.lastName}`.trim(),
        email: user.email,
        role: user.userType,
        verified: user.isVerified
      },
      accessToken,
      refreshToken
    }
  });
}));

// POST /api/auth/resend-verification - Resend verification code
router.post('/resend-verification', asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email) {
    throw errors.badRequest('Email is required');
  }

  const normalizedEmail = email.toLowerCase().trim();
  const user = await User.findOne({ email: normalizedEmail });

  if (!user) {
    throw errors.notFound('No account found with this email');
  }

  if (user.isVerified) {
    throw errors.conflict('Email is already verified');
  }

  // Generate new verification code
  const verificationCode = generateVerificationCode();
  user.verificationToken = verificationCode;
  user.verificationExpires = new Date(Date.now() + 15 * 60 * 1000);
  await user.save();

  // Send new verification email
  const name = user.firstName !== 'Pending' ? user.firstName : normalizedEmail.split('@')[0];
  try {
    await sendVerificationEmail(normalizedEmail, name, verificationCode, 'code');
  } catch (emailErr) {
    console.error('[resend-verification] Email delivery failed:', emailErr.message);
    throw errors.internal('Unable to send verification email. Please try again in a few minutes or contact support.');
  }

  res.json({
    success: true,
    message: 'New verification code sent! Check your email.'
  });
}));

module.exports = router;
