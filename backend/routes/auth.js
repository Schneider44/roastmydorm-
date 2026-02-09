const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { auth, generateAccessToken, generateRefreshToken, verifyRefreshToken } = require('../middleware/auth');
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

  // Generate tokens
  const accessToken = generateAccessToken(user._id);
  const refreshToken = generateRefreshToken(user._id);

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

  // Update last login
  user.lastLogin = new Date();
  user.loginCount = (user.loginCount || 0) + 1;
  await user.save();

  // Generate tokens
  const accessToken = generateAccessToken(user._id);
  const refreshToken = generateRefreshToken(user._id);

  res.json({
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

// POST /api/auth/logout - Logout (client-side token removal)
router.post('/logout', auth, asyncHandler(async (req, res) => {
  // In a production app, you might want to blacklist the token
  // For now, just return success (client removes tokens)
  res.json({
    success: true,
    message: 'Logged out successfully'
  });
}));

// GET /api/auth/me - Get current user
router.get('/me', auth, async (req, res) => {
  try {
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
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching user data',
      error: error.message
    });
  }
});

// PUT /api/auth/profile - Update user profile
router.put('/profile', auth, async (req, res) => {
  try {
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
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(400).json({
      success: false,
      message: 'Error updating profile',
      error: error.message
    });
  }
});

// POST /api/auth/change-password - Change password
router.post('/change-password', auth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    // Verify current password
    const user = await User.findById(req.user._id);
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(400).json({
      success: false,
      message: 'Error changing password',
      error: error.message
    });
  }
});

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
  await sendVerificationEmail(normalizedEmail, name, verificationCode, 'code');

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

  // Check if code matches
  if (user.verificationToken !== code.toString().trim()) {
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

  // Generate tokens for automatic login
  const accessToken = generateAccessToken(user._id);
  const refreshToken = generateRefreshToken(user._id);

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
  await sendVerificationEmail(normalizedEmail, name, verificationCode, 'code');

  res.json({
    success: true,
    message: 'New verification code sent! Check your email.'
  });
}));

module.exports = router;
