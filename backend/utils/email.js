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

/**
 * Notify admin of a new property submission
 */
const sendPropertySubmissionAlert = async (submission) => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) return;
  const transporter = createTransporter();
  const adminEmail = process.env.ADMIN_EMAIL || process.env.EMAIL_USER;
  const cityLabel = { casablanca: 'Casablanca', rabat: 'Rabat', marrakech: 'Marrakech', other: 'Other' };
  const typeLabel  = { studio: 'Studio', apartment: 'Apartment', house: 'House', room: 'Room for Rent', colocation: 'Colocation' };

  await transporter.sendMail({
    from: `"RoastMyDorm" <${process.env.EMAIL_USER}>`,
    to: adminEmail,
    subject: `🏠 New Property Submission — ${submission.title}`,
    html: `
      <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;background:#f8fafc;padding:24px;border-radius:12px;">
        <h2 style="color:#1e3a8a;margin-bottom:4px;">New Property Submission</h2>
        <p style="color:#6b7280;margin-top:0;">A landlord has submitted a property for review.</p>
        <table style="width:100%;border-collapse:collapse;margin:20px 0;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08);">
          <tr style="background:#eff6ff;"><td colspan="2" style="padding:10px 16px;font-weight:700;color:#1e3a8a;">Landlord Details</td></tr>
          <tr><td style="padding:8px 16px;color:#6b7280;width:40%;">Name</td><td style="padding:8px 16px;color:#111827;font-weight:600;">${submission.landlordName}</td></tr>
          <tr style="background:#f9fafb;"><td style="padding:8px 16px;color:#6b7280;">Email</td><td style="padding:8px 16px;color:#111827;">${submission.landlordEmail}</td></tr>
          <tr><td style="padding:8px 16px;color:#6b7280;">Phone</td><td style="padding:8px 16px;color:#111827;">${submission.landlordPhone || '—'}</td></tr>
          <tr style="background:#f9fafb;"><td style="padding:8px 16px;color:#6b7280;">Type</td><td style="padding:8px 16px;color:#111827;">${submission.landlordType}</td></tr>
          <tr style="background:#eff6ff;"><td colspan="2" style="padding:10px 16px;font-weight:700;color:#1e3a8a;">Property Details</td></tr>
          <tr><td style="padding:8px 16px;color:#6b7280;">Title</td><td style="padding:8px 16px;color:#111827;font-weight:600;">${submission.title}</td></tr>
          <tr style="background:#f9fafb;"><td style="padding:8px 16px;color:#6b7280;">Type</td><td style="padding:8px 16px;color:#111827;">${typeLabel[submission.propertyType] || submission.propertyType}</td></tr>
          <tr><td style="padding:8px 16px;color:#6b7280;">City</td><td style="padding:8px 16px;color:#111827;">${cityLabel[submission.city] || submission.city}${submission.neighborhood ? ', ' + submission.neighborhood : ''}</td></tr>
          <tr style="background:#f9fafb;"><td style="padding:8px 16px;color:#6b7280;">Price</td><td style="padding:8px 16px;color:#111827;font-weight:700;">${submission.price} MAD / month</td></tr>
          <tr><td style="padding:8px 16px;color:#6b7280;vertical-align:top;">Description</td><td style="padding:8px 16px;color:#111827;">${submission.description}</td></tr>
        </table>
        <div style="text-align:center;margin-top:24px;">
          <a href="${process.env.CLIENT_URL || 'https://www.roastmydorm.com'}/admin-dashboard.html" style="background:#1e3a8a;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700;display:inline-block;">Review in Admin Panel →</a>
        </div>
        <p style="color:#9ca3af;font-size:12px;text-align:center;margin-top:20px;">Submission ID: ${submission._id}</p>
      </div>
    `
  });
};

/**
 * Notify landlord of their submission result (approved or rejected)
 */
const sendPropertyDecisionEmail = async (submission, decision, adminNote) => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) return;
  const transporter = createTransporter();
  const approved = decision === 'approved';

  await transporter.sendMail({
    from: `"RoastMyDorm" <${process.env.EMAIL_USER}>`,
    to: submission.landlordEmail,
    subject: approved
      ? `✅ Your property "${submission.title}" has been approved!`
      : `❌ Update on your property submission — "${submission.title}"`,
    html: `
      <div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;">
        <div style="background:${approved ? '#1e3a8a' : '#dc2626'};padding:32px;border-radius:12px 12px 0 0;text-align:center;">
          <div style="font-size:2.5rem;margin-bottom:8px;">${approved ? '🎉' : '📋'}</div>
          <h1 style="color:#fff;font-size:1.4rem;margin:0;">${approved ? 'Your Property is Live!' : 'Submission Update'}</h1>
        </div>
        <div style="background:#fff;padding:28px 32px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;">
          <p style="color:#374151;">Hi ${submission.landlordName},</p>
          ${approved
            ? `<p style="color:#374151;">Great news! Your property <strong>"${submission.title}"</strong> has been reviewed and <strong style="color:#16a34a;">approved</strong>. It is now visible to thousands of students searching for housing in ${submission.city.charAt(0).toUpperCase() + submission.city.slice(1)}.</p>`
            : `<p style="color:#374151;">Thank you for submitting your property <strong>"${submission.title}"</strong>. After review, we were unable to approve it at this time.</p>`
          }
          ${adminNote ? `<div style="background:#f9fafb;border-left:4px solid ${approved ? '#2563eb' : '#dc2626'};padding:14px 18px;border-radius:0 8px 8px 0;margin:20px 0;"><p style="margin:0;color:#374151;font-style:italic;">"${adminNote}"</p><span style="font-size:12px;color:#9ca3af;">— RoastMyDorm Team</span></div>` : ''}
          ${!approved ? `<p style="color:#374151;">You are welcome to make changes and resubmit. If you have questions, reply to this email or contact us on WhatsApp.</p>` : ''}
          <div style="text-align:center;margin-top:28px;">
            <a href="${process.env.CLIENT_URL || 'https://www.roastmydorm.com'}/for-landlords.html" style="background:#1e3a8a;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700;display:inline-block;">${approved ? 'View RoastMyDorm' : 'Submit Again'}</a>
          </div>
          <p style="color:#9ca3af;font-size:12px;text-align:center;margin-top:24px;">RoastMyDorm · support@roastmydorm.com</p>
        </div>
      </div>
    `
  });
};

module.exports = {
  generateVerificationToken,
  generateVerificationCode,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendPropertySubmissionAlert,
  sendPropertyDecisionEmail
};
