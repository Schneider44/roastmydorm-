const nodemailer = require('nodemailer');
const crypto = require('crypto');

// Create transporter based on environment
const createTransporter = () => {
  // Use Gmail SMTP (most common for Morocco-based apps)
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT) || 587,
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS // Use App Password for Gmail
    }
  });
};

/**
 * Generate a random verification token
 */
const generateVerificationToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

/**
 * Generate a 6-digit verification code
 */
const generateVerificationCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Send verification email to user
 * @param {string} to - Recipient email
 * @param {string} name - User's name
 * @param {string} verificationToken - Token or code for verification
 * @param {string} type - 'token' (link) or 'code' (6-digit)
 */
const sendVerificationEmail = async (to, name, verificationToken, type = 'code') => {
  // Require email credentials
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    throw new Error('Email service not configured. Please set EMAIL_USER and EMAIL_PASS environment variables.');
  }
  
  const transporter = createTransporter();

  const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
  
  let subject, html;
  
  if (type === 'code') {
    subject = `Your RoastMyDorm Verification Code: ${verificationToken}`;
    html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f4;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 20px;">
          <tr>
            <td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                <!-- Header -->
                <tr>
                  <td style="background: linear-gradient(135deg, #0056b3 0%, #003d82 100%); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
                    <h1 style="color: #ffffff; margin: 0; font-size: 28px;">🏠 RoastMyDorm</h1>
                  </td>
                </tr>
                
                <!-- Content -->
                <tr>
                  <td style="padding: 40px 30px;">
                    <h2 style="color: #333; margin: 0 0 20px 0;">Hello ${name}! 👋</h2>
                    <p style="color: #666; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                      Welcome to RoastMyDorm! Use the verification code below to complete your registration:
                    </p>
                    
                    <!-- Verification Code Box -->
                    <div style="background-color: #f8f9fa; border: 2px dashed #0056b3; border-radius: 8px; padding: 25px; text-align: center; margin: 30px 0;">
                      <p style="color: #666; font-size: 14px; margin: 0 0 10px 0;">Your verification code:</p>
                      <h1 style="color: #0056b3; font-size: 42px; letter-spacing: 8px; margin: 0; font-family: 'Courier New', monospace;">${verificationToken}</h1>
                    </div>
                    
                    <p style="color: #666; font-size: 14px; line-height: 1.6; margin: 20px 0 0 0;">
                      ⏰ This code expires in <strong>15 minutes</strong>.
                    </p>
                    <p style="color: #999; font-size: 13px; margin: 20px 0 0 0;">
                      If you didn't request this code, you can safely ignore this email.
                    </p>
                  </td>
                </tr>
                
                <!-- Footer -->
                <tr>
                  <td style="background-color: #f8f9fa; padding: 20px 30px; border-radius: 0 0 12px 12px; text-align: center;">
                    <p style="color: #999; font-size: 12px; margin: 0;">
                      © 2024 RoastMyDorm. All rights reserved.<br>
                      Find your perfect student housing in Morocco.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;
  } else {
    // Token-based verification with link
    const verificationUrl = `${clientUrl}/verify-email.html?token=${verificationToken}`;
    subject = 'Verify Your RoastMyDorm Account';
    html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f4;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 20px;">
          <tr>
            <td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                <!-- Header -->
                <tr>
                  <td style="background: linear-gradient(135deg, #0056b3 0%, #003d82 100%); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
                    <h1 style="color: #ffffff; margin: 0; font-size: 28px;">🏠 RoastMyDorm</h1>
                  </td>
                </tr>
                
                <!-- Content -->
                <tr>
                  <td style="padding: 40px 30px;">
                    <h2 style="color: #333; margin: 0 0 20px 0;">Hello ${name}! 👋</h2>
                    <p style="color: #666; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
                      Welcome to RoastMyDorm! Click the button below to verify your email address:
                    </p>
                    
                    <!-- CTA Button -->
                    <div style="text-align: center; margin: 30px 0;">
                      <a href="${verificationUrl}" style="background-color: #0056b3; color: #ffffff; padding: 15px 40px; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: 600; display: inline-block;">
                        Verify My Email
                      </a>
                    </div>
                    
                    <p style="color: #999; font-size: 13px; line-height: 1.6; margin: 30px 0 0 0;">
                      Or copy and paste this link into your browser:<br>
                      <a href="${verificationUrl}" style="color: #0056b3; word-break: break-all;">${verificationUrl}</a>
                    </p>
                    
                    <p style="color: #666; font-size: 14px; line-height: 1.6; margin: 20px 0 0 0;">
                      ⏰ This link expires in <strong>24 hours</strong>.
                    </p>
                  </td>
                </tr>
                
                <!-- Footer -->
                <tr>
                  <td style="background-color: #f8f9fa; padding: 20px 30px; border-radius: 0 0 12px 12px; text-align: center;">
                    <p style="color: #999; font-size: 12px; margin: 0;">
                      © 2024 RoastMyDorm. All rights reserved.<br>
                      Find your perfect student housing in Morocco.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;
  }

  try {
    const info = await transporter.sendMail({
      from: `"RoastMyDorm" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html
    });
    
    console.log('Verification email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending verification email:', error);
    throw error;
  }
};

/**
 * Send password reset email
 */
const sendPasswordResetEmail = async (to, name, resetToken) => {
  // Require email credentials
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    throw new Error('Email service not configured. Please set EMAIL_USER and EMAIL_PASS environment variables.');
  }
  
  const transporter = createTransporter();

  const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
  const resetUrl = `${clientUrl}/reset-password.html?token=${resetToken}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f4;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 20px;">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
              <!-- Header -->
              <tr>
                <td style="background: linear-gradient(135deg, #dc3545 0%, #b02a37 100%); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
                  <h1 style="color: #ffffff; margin: 0; font-size: 28px;">🔐 Password Reset</h1>
                </td>
              </tr>
              
              <!-- Content -->
              <tr>
                <td style="padding: 40px 30px;">
                  <h2 style="color: #333; margin: 0 0 20px 0;">Hello ${name},</h2>
                  <p style="color: #666; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                    We received a request to reset your RoastMyDorm password. Click the button below to set a new password:
                  </p>
                  
                  <!-- CTA Button -->
                  <div style="text-align: center; margin: 30px 0;">
                    <a href="${resetUrl}" style="background-color: #dc3545; color: #ffffff; padding: 15px 40px; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: 600; display: inline-block;">
                      Reset Password
                    </a>
                  </div>
                  
                  <p style="color: #666; font-size: 14px; line-height: 1.6; margin: 20px 0 0 0;">
                    ⏰ This link expires in <strong>1 hour</strong>.
                  </p>
                  <p style="color: #999; font-size: 13px; margin: 20px 0 0 0;">
                    If you didn't request a password reset, please ignore this email or contact support if you're concerned.
                  </p>
                </td>
              </tr>
              
              <!-- Footer -->
              <tr>
                <td style="background-color: #f8f9fa; padding: 20px 30px; border-radius: 0 0 12px 12px; text-align: center;">
                  <p style="color: #999; font-size: 12px; margin: 0;">
                    © 2024 RoastMyDorm. All rights reserved.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  try {
    const info = await transporter.sendMail({
      from: `"RoastMyDorm" <${process.env.EMAIL_USER}>`,
      to,
      subject: 'Reset Your RoastMyDorm Password',
      html
    });
    
    console.log('Password reset email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending password reset email:', error);
    throw error;
  }
};

module.exports = {
  generateVerificationToken,
  generateVerificationCode,
  sendVerificationEmail,
  sendPasswordResetEmail
};
