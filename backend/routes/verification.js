const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { sendVerificationEmail, generateVerificationCode } = require('../utils/email');

// In-memory store for verification codes (use Redis in production)
const verificationCodes = new Map();

// Rate limiter for verification requests
const verificationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per 15 minutes per IP
  message: { success: false, message: 'Too many verification requests. Please try again later.' }
});

/**
 * @route   POST /api/verification/send
 * @desc    Send verification code to email
 * @access  Public
 */
router.post('/send', verificationLimiter, async (req, res) => {
  try {
    const { email, name } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }


    // Validate email format and university domain
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format'
      });
    }
    // Only allow .ac.ma or specific university domains
    const allowedDomains = [
      'ensias.ma', 'emi.ac.ma', 'uhp.ac.ma', 'um5.ac.ma', 'uca.ma', 'uca.ac.ma', 'usmba.ac.ma', 'uae.ac.ma', 'uca.ac.ma', 'uit.ac.ma', 'univh2c.ma', 'univh2c.ac.ma', 'univhassan2.ma', 'univhassan2.ac.ma', 'univhassan1.ma', 'univhassan1.ac.ma', 'univ-ibntofail.ac.ma', 'univ-oujda.ac.ma', 'univ-chouaib.ma', 'univ-chouaib.ac.ma', 'univ-ibntofail.ma', 'univ-oujda.ma', 'univ-chouaib.ma', 'univ-chouaib.ac.ma', 'univ-ibntofail.ma', 'univ-oujda.ma', 'univ-chouaib.ma', 'univ-chouaib.ac.ma', 'univ-ibntofail.ma', 'univ-oujda.ma', 'univ-chouaib.ma', 'univ-chouaib.ac.ma', 'univ-ibntofail.ma', 'univ-oujda.ma', 'univ-chouaib.ma', 'univ-chouaib.ac.ma', 'univ-ibntofail.ma', 'univ-oujda.ma', 'univ-chouaib.ma', 'univ-chouaib.ac.ma', 'univ-ibntofail.ma', 'univ-oujda.ma', 'univ-chouaib.ma', 'univ-chouaib.ac.ma', 'univ-ibntofail.ma', 'univ-oujda.ma', 'univ-chouaib.ma', 'univ-chouaib.ac.ma', 'ac.ma', 'edu.ma', 'uca.ma', 'uca.ac.ma', 'uae.ac.ma', 'usmba.ac.ma', 'umi.ac.ma', 'ump.ac.ma', 'univh2c.ac.ma', 'univhassan2.ac.ma', 'univhassan1.ac.ma', 'univ-ibntofail.ac.ma', 'univ-oujda.ac.ma', 'univ-chouaib.ac.ma', 'univ-ibntofail.ac.ma', 'univ-oujda.ac.ma', 'univ-chouaib.ac.ma', 'univ-ibntofail.ac.ma', 'univ-oujda.ac.ma', 'univ-chouaib.ac.ma', 'univ-ibntofail.ac.ma', 'univ-oujda.ac.ma', 'univ-chouaib.ac.ma', 'univ-ibntofail.ac.ma', 'univ-oujda.ac.ma', 'univ-chouaib.ac.ma', 'univ-ibntofail.ac.ma', 'univ-oujda.ac.ma', 'univ-chouaib.ac.ma', 'univ-ibntofail.ac.ma', 'univ-oujda.ac.ma', 'univ-chouaib.ac.ma', 'univ-ibntofail.ac.ma', 'univ-oujda.ac.ma', 'univ-chouaib.ac.ma', 'univ-ibntofail.ac.ma', 'univ-oujda.ac.ma', 'univ-chouaib.ac.ma', 'univ-ibntofail.ac.ma', 'univ-oujda.ac.ma', 'univ-chouaib.ac.ma', 'univ-ibntofail.ac.ma', 'univ-oujda.ac.ma', 'univ-chouaib.ac.ma', 'univ-ibntofail.ac.ma', 'univ-oujda.ac.ma', 'univ-chouaib.ac.ma', 'univ-ibntofail.ac.ma', 'univ-oujda.ac.ma', 'univ-chouaib.ac.ma', 'univ-ibntofail.ac.ma', 'univ-oujda.ac.ma', 'univ-chouaib.ac.ma', 'univ-ibntofail.ac.ma', 'univ-oujda.ac.ma', 'univ-chouaib.ac.ma', 'univ-ibntofail.ac.ma', 'univ-oujda.ac.ma', 'univ-chouaib.ac.ma', 'univ-ibntofail.ac.ma', 'univ-oujda.ac.ma', 'univ-chouaib.ac.ma', 'univ-ibntofail.ac.ma', 'univ-oujda.ac.ma', 'univ-chouaib.ac.ma', 'univ-ibntofail.ac.ma', 'univ-oujda.ac.ma', 'univ-chouaib.ac.ma', 'univ-ibntofail.ac.ma', 'univ-oujda.ac.ma', 'univ-chouaib.ac.ma', 'univ-ibntofail.ac.ma', 'univ-oujda.ac.ma', 'univ-chouaib.ac.ma', 'univ-ibntofail.ac.ma', 'univ-oujda.ac.ma', 'univ-chouaib.ac.ma', 'univ-ibntofail.ac.ma', 'univ-oujda.ac.ma', 'univ-chouaib.ac.ma', 'univ-ibntofail.ac.ma', 'univ-oujda.ac.ma', 'univ-chouaib.ac.ma', 'univ-ibntofail.ac.ma', 'univ-oujda.ac.ma', 'univ-chouaib.ac.ma', 'univ-ibntofail.ac.ma', 'univ-oujda.ac.ma', 'univ-chouaib.ac.ma', 'ac.ma', 'edu.ma']
    const emailDomain = email.split('@')[1].toLowerCase();
    if (!allowedDomains.some(domain => emailDomain.endsWith(domain))) {
      return res.status(400).json({
        success: false,
        message: 'Only university emails are allowed.'
      });
    }

    // Generate 6-digit code
    const code = generateVerificationCode();
    const expiresAt = Date.now() + 15 * 60 * 1000; // 15 minutes

    // Store code with email
    verificationCodes.set(email.toLowerCase(), {
      code,
      expiresAt,
      attempts: 0,
      name: name || email.split('@')[0]
    });

    // Check if email service is configured
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      // Development mode - return code in response for testing
      console.log(`[DEV MODE] Verification code for ${email}: ${code}`);
      return res.json({
        success: true,
        message: 'Verification code generated (dev mode - check console or use code below)',
        code, // Include code in dev mode for testing
        expiresIn: 900 // 15 minutes in seconds
      });
    }

    // Send verification email
    await sendVerificationEmail(email, name || email.split('@')[0], code, 'code');

    res.json({
      success: true,
      message: 'Verification code sent to your email',
      expiresIn: 900 // 15 minutes in seconds
    });

  } catch (error) {
    console.error('Send verification error:', error);
    
    // If email sending fails, still return code for dev testing
    if (error.message.includes('not configured') || error.code === 'EAUTH') {
      const email = req.body.email?.toLowerCase();
      const stored = verificationCodes.get(email);
      if (stored) {
        return res.json({
          success: true,
          message: 'Email service unavailable - verification code (dev mode)',
          code: stored.code,
          expiresIn: 900
        });
      }
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to send verification code'
    });
  }
});

/**
 * @route   POST /api/verification/verify
 * @desc    Verify the code sent to email
 * @access  Public
 */
router.post('/verify', async (req, res) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({
        success: false,
        message: 'Email and code are required'
      });
    }

    const stored = verificationCodes.get(email.toLowerCase());

    if (!stored) {
      return res.status(400).json({
        success: false,
        message: 'No verification code found. Please request a new code.'
      });
    }

    // Check if code expired
    if (Date.now() > stored.expiresAt) {
      verificationCodes.delete(email.toLowerCase());
      return res.status(400).json({
        success: false,
        message: 'Verification code expired. Please request a new code.'
      });
    }

    // Check attempts
    if (stored.attempts >= 3) {
      verificationCodes.delete(email.toLowerCase());
      return res.status(400).json({
        success: false,
        message: 'Too many failed attempts. Please request a new code.'
      });
    }

    // Verify code
    if (stored.code !== code.toString()) {
      stored.attempts += 1;
      return res.status(400).json({
        success: false,
        message: `Invalid code. ${3 - stored.attempts} attempts remaining.`
      });
    }

    // Code is valid - clean up
    verificationCodes.delete(email.toLowerCase());

    res.json({
      success: true,
      message: 'Email verified successfully',
      verified: true,
      email: email.toLowerCase(),
      name: stored.name
    });

  } catch (error) {
    console.error('Verify code error:', error);
    res.status(500).json({
      success: false,
      message: 'Verification failed'
    });
  }
});

/**
 * @route   GET /api/verification/status/:email
 * @desc    Check if a verification is pending for an email
 * @access  Public
 */
router.get('/status/:email', (req, res) => {
  const email = req.params.email?.toLowerCase();
  const stored = verificationCodes.get(email);

  if (!stored) {
    return res.json({
      success: true,
      pending: false
    });
  }

  // Check if expired
  if (Date.now() > stored.expiresAt) {
    verificationCodes.delete(email);
    return res.json({
      success: true,
      pending: false
    });
  }

  res.json({
    success: true,
    pending: true,
    expiresIn: Math.floor((stored.expiresAt - Date.now()) / 1000)
  });
});

module.exports = router;
