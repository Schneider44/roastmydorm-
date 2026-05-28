const express = require('express');
const https = require('https');
const router = express.Router();
const User = require('../models/User');
const { generateAccessToken, generateRefreshToken, storeRefreshToken } = require('../middleware/auth');
const { asyncHandler, errors } = require('../utils/helpers');

// Verify Google ID token by calling Google's tokeninfo endpoint
async function verifyGoogleToken(idToken) {
  return new Promise((resolve, reject) => {
    const url = `https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`;
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const payload = JSON.parse(data);
          if (payload.error) return reject(new Error(payload.error_description || 'Invalid token'));
          resolve(payload);
        } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

// POST /api/auth/google
// Accepts a Google ID token from the frontend, verifies it, and returns JWT tokens
router.post('/google', asyncHandler(async (req, res) => {
  const { credential } = req.body;

  if (!credential) {
    throw errors.badRequest('Google credential token is required');
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    throw errors.internal('Google authentication is not configured on this server');
  }

  // Verify the token with Google
  let payload;
  try {
    payload = await verifyGoogleToken(credential);
  } catch (err) {
    console.error('[google-auth] Token verification failed:', err.message);
    throw errors.unauthorized('Invalid Google token. Please try again.');
  }

  // Verify the token was issued for our app
  if (payload.aud !== clientId) {
    throw errors.unauthorized('Token audience mismatch');
  }

  // Verify token is not expired
  if (Date.now() / 1000 > parseInt(payload.exp)) {
    throw errors.unauthorized('Google token has expired. Please sign in again.');
  }

  // Verify email is confirmed by Google
  if (payload.email_verified !== 'true' && payload.email_verified !== true) {
    throw errors.badRequest('Google account email is not verified');
  }

  const { sub: googleId, email, name, picture, given_name, family_name } = payload;

  // Find existing user by googleId or email
  let user = await User.findOne({ $or: [{ googleId }, { email: email.toLowerCase() }] });

  if (user) {
    // Update Google info if signing in with Google for the first time on existing account
    if (!user.googleId) {
      user.googleId = googleId;
      user.isVerified = true;
      if (picture && !user.profilePicture) user.profilePicture = picture;
      await user.save();
    }
  } else {
    // Create new user from Google profile
    const nameParts = (name || '').trim().split(' ');
    user = new User({
      firstName: given_name || nameParts[0] || 'User',
      lastName: family_name || nameParts.slice(1).join(' ') || '',
      email: email.toLowerCase(),
      googleId,
      profilePicture: picture || '',
      isVerified: true,
      role: 'user'
    });
    await user.save();
  }

  // Issue JWT tokens
  const accessToken = generateAccessToken(user._id);
  const refreshToken = generateRefreshToken(user._id);
  await storeRefreshToken(user._id, refreshToken);

  res.json({
    success: true,
    message: user.createdAt?.getTime() === user.updatedAt?.getTime() ? 'Account created successfully' : 'Signed in successfully',
    data: {
      user: {
        id: user._id,
        name: `${user.firstName} ${user.lastName}`.trim(),
        email: user.email,
        avatar: user.profilePicture,
        role: user.role,
        verified: user.isVerified
      },
      accessToken,
      refreshToken
    }
  });
}));

module.exports = router;
