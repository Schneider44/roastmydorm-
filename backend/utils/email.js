const nodemailer = require('nodemailer');
const crypto = require('crypto');
const https = require('https');
const { escapeHtml } = require('./htmlEscape');

// Send via Resend API (primary). `idempotencyKey`, when provided, is sent
// as Resend's own `Idempotency-Key` request header - verified against
// Resend's real API documentation (resend.com/docs/api-reference/emails/
// send-email), not assumed: the endpoint accepts one unique-per-request
// key, expiring after 24 hours, max 256 characters. This is what makes
// delivery through Resend "effectively once" rather than merely
// "attempted once" - if THIS process crashes after Resend has accepted
// the send but before the DormInquiry notification record is marked
// 'sent' (see services/notificationOutbox.js), a retry that reuses the
// SAME key is deduplicated by Resend itself, not just by our own DB
// state. See that file's header comment for the full, honest statement of
// what guarantee this does and does not provide - Resend's own docs don't
// specify what happens if the same key is replayed with different body
// content, so this is a real, meaningful improvement over "no
// idempotency," not a proven mathematical exactly-once guarantee.
async function _sendViaResend({ to, subject, html, text, idempotencyKey }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('RESEND_API_KEY not set');
  const from = process.env.RESEND_FROM || 'RoastMyDorm <onboarding@resend.dev>';
  const payload = JSON.stringify({ from, to: Array.isArray(to) ? to : [to], subject, html, ...(text ? { text } : {}) });
  return new Promise((resolve, reject) => {
    const headers = { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) };
    if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey.slice(0, 256);
    const options = { hostname: 'api.resend.com', path: '/emails', method: 'POST', headers };
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          if (res.statusCode >= 200 && res.statusCode < 300) resolve({ success: true, id: json.id });
          else reject(new Error(json.message || `Resend error ${res.statusCode}`));
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    // Bounded so an unresponsive provider can never hang the HTTP request
    // that's awaiting this - see the callers in
    // services/notificationOutbox.js and services/dormHandoff.js, both of
    // which await this synchronously before responding to the client.
    req.setTimeout(EMAIL_PROVIDER_TIMEOUT_MS, () => { req.destroy(); reject(new Error('Resend timeout')); });
    req.write(payload);
    req.end();
  });
}

// Bounded provider timeouts - see the comment on _sendViaResend's
// req.setTimeout above and createTransporter's connectionTimeout/
// socketTimeout below. Without these, a hung TCP connection to either
// provider could keep an awaited email send (and therefore the HTTP
// request awaiting it) open indefinitely - the previous SMTP transporter
// had no timeout configured at all and relied entirely on the OS's own
// TCP timeout, which can be several minutes.
const EMAIL_PROVIDER_TIMEOUT_MS = 10000;

// Create transporter based on environment. `messageId`, when provided by
// a caller of _sendEmail below, becomes this send's Message-ID header -
// useful for correlating a specific attempt in logs/support requests, but
// NOT a delivery guarantee: unlike Resend's Idempotency-Key (verified
// above against Resend's real API contract), SMTP/Message-ID has no
// standardized cross-request deduplication behavior - a receiving mail
// server is free to ignore it entirely. Never claim otherwise - see
// _sendEmail's own doc comment for the honest, complete statement.
const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    },
    connectionTimeout: EMAIL_PROVIDER_TIMEOUT_MS,
    greetingTimeout: EMAIL_PROVIDER_TIMEOUT_MS,
    socketTimeout: EMAIL_PROVIDER_TIMEOUT_MS,
  });
};

/**
 * Route: try Gmail SMTP first, fall back to Resend.
 *
 * Honest delivery guarantee (do not overstate this elsewhere):
 *  - Via Resend, with `idempotencyKey` supplied by the caller and reused
 *    identically on every retry of the SAME logical send: EFFECTIVELY ONCE
 *    - BUT ONLY WITHIN RESEND'S DOCUMENTED 24-HOUR IDEMPOTENCY-KEY
 *    RETENTION WINDOW (verified against Resend's own API docs, not
 *    assumed). Within that window, a subsequent retry reaches Resend
 *    again, but Resend itself recognizes the key and does not deliver a
 *    second copy - this closes the specific crash window where the
 *    provider accepted the message but this process died before the local
 *    "sent" state was recorded (see services/notificationOutbox.js).
 *    OUTSIDE that window (a retry more than 24h after the original
 *    attempt), Resend has forgotten the key and a genuine duplicate
 *    becomes possible again if the original send actually succeeded at
 *    the provider - this codebase has no visibility into whether it did.
 *    In practice this project has no automatic retry mechanism at all
 *    (the dorm follow-up scheduler stays disabled; the only retry path is
 *    an admin's manual click - see routes/admin/housingRequests.js's
 *    retry-notification route), so a 24h-later retry would require an
 *    admin to notice and click retry on something over a day old - rare,
 *    but not impossible, and deliberately not hidden here. If a future
 *    automatic retry scheduler is ever built to read `nextRetryAt` (see
 *    notificationOutbox.js's backoffMs - already capped at 2h, well
 *    inside the 24h window), it MUST either cap total elapsed retry time
 *    under 24h or surface an explicit admin warning before retrying past
 *    it - not implemented now, since no such scheduler exists yet.
 *  - Via SMTP (the Gmail fallback, tried first when EMAIL_USER/PASS are
 *    set): AT LEAST ONCE, with a rare duplicate possible after exactly
 *    that same crash window, with NO time-window mitigation at all - SMTP
 *    has no dedup mechanism to fall back on, ever. `messageId` gives a
 *    stable identifier for log correlation only, never a provider-side
 *    dedup guarantee.
 *  - Without an idempotencyKey at all (a caller that doesn't supply one):
 *    AT LEAST ONCE via either provider - this is the same crash-window
 *    exposure the durable-outbox work (services/notificationOutbox.js)
 *    already minimizes at the DATABASE layer (an unattempted or
 *    unresolved send is never lost, only possibly retried), but retrying
 *    an already-delivered send can still occasionally resend it.
 */
async function _sendEmail({ to, subject, html, text, idempotencyKey } = {}) {
  if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    try {
      const transport = createTransporter();
      const from = `"RoastMyDorm" <${process.env.EMAIL_USER}>`;
      const mailOptions = { from, to, subject, html };
      if (text) mailOptions.text = text;
      if (idempotencyKey) mailOptions.messageId = `<${idempotencyKey}@roastmydorm.com>`;
      const info = await transport.sendMail(mailOptions);
      return { success: true, id: info.messageId };
    } catch (e) { console.warn('⚠️  SMTP failed, trying Resend:', e.message); }
  }
  if (process.env.RESEND_API_KEY) {
    return await _sendViaResend({ to, subject, html, text, idempotencyKey });
  }
  throw new Error('Email service not configured. Set EMAIL_USER + EMAIL_PASS or RESEND_API_KEY.');
}

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
    const result = await _sendEmail({ to, subject, html });
    console.log('Verification email sent:', result.id);
    return { success: true, messageId: result.id };
  } catch (error) {
    console.error('Error sending verification email:', error);
    throw error;
  }
};

/**
 * Send password reset email
 */
const sendPasswordResetEmail = async (to, name, resetToken) => {

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
    const result = await _sendEmail({ to, subject: 'Reset Your RoastMyDorm Password', html });
    console.log('Password reset email sent:', result.id);
    return { success: true, messageId: result.id };
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

/**
 * Send enquiry confirmation email to client + notification to landlord
 */
const sendEnquiryConfirmation = async ({ clientName, clientEmail, clientPhone, message, preferredContact, listing }) => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) return { success: false, reason: 'email_not_configured' };

  const transporter = createTransporter();
  const listingUrl = listing.url || 'https://www.roastmydorm.com';

  const clientHtml = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
    <body style="margin:0;padding:0;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;background:#f4f4f4;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:20px;">
        <tr><td align="center">
          <table width="580" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;box-shadow:0 4px 20px rgba(0,0,0,0.1);overflow:hidden;">
            <!-- Header -->
            <tr>
              <td style="background:linear-gradient(135deg,#00a8a8 0%,#007a7a 100%);padding:32px;text-align:center;">
                <h1 style="color:#fff;margin:0;font-size:22px;font-weight:800;">🏠 RoastMyDorm</h1>
                <p style="color:rgba(255,255,255,0.85);margin:8px 0 0;font-size:15px;">Your enquiry is confirmed!</p>
              </td>
            </tr>
            <!-- Body -->
            <tr>
              <td style="padding:36px 32px;">
                <h2 style="color:#111827;margin:0 0 6px;font-size:20px;">Hey ${clientName}! 🎉</h2>
                <p style="color:#6b7280;margin:0 0 6px;font-size:15px;">Great news, your <strong>${listing.name}</strong> at ${listing.location}</p>

                <!-- Listing Card -->
                <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;padding:20px;margin-bottom:28px;">
                  <div style="font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#00a8a8;margin-bottom:12px;">🏠 Tenancy Details</div>

                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="padding:7px 0;border-bottom:1px solid #f3f4f6;">
                        <span style="color:#6b7280;font-size:13px;">Type of the listings</span>
                        <span style="float:right;color:#111827;font-weight:600;font-size:13px;">${listing.type}</span>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:7px 0;border-bottom:1px solid #f3f4f6;">
                        <span style="color:#6b7280;font-size:13px;">Rent</span>
                        <span style="float:right;color:#00a8a8;font-weight:700;font-size:14px;">${listing.rent}</span>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:7px 0;border-bottom:1px solid #f3f4f6;">
                        <span style="color:#6b7280;font-size:13px;">Lease Duration</span>
                        <span style="float:right;color:#111827;font-weight:600;font-size:13px;">${listing.lease}</span>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:7px 0;">
                        <span style="color:#6b7280;font-size:13px;">Move-in Date</span>
                        <span style="float:right;color:#111827;font-weight:600;font-size:13px;">${listing.moveIn}</span>
                      </td>
                    </tr>
                  </table>
                </div>

                <!-- CTA -->
                <div style="background:linear-gradient(135deg,#f0fdfd,#e6fafa);border:1px solid #99e6e6;border-radius:12px;padding:20px;margin-bottom:28px;text-align:center;">
                  <div style="font-size:13px;font-weight:700;color:#065f5f;margin-bottom:6px;">🚀 Next Step: Complete Your Booking</div>
                  <p style="color:#374151;font-size:13px;margin:0 0 16px;">Finish the <strong>Booking Form</strong> to fast-track confirmation and secure your room 👇</p>
                  <a href="${listingUrl}" style="display:inline-block;background:#00a8a8;color:#fff;padding:13px 32px;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px;">👉 View Listing &amp; Book</a>
                  <p style="color:#6b7280;font-size:11px;margin:12px 0 0;">⏳ Rooms are in high demand — completing now helps avoid availability issues.</p>
                </div>

                <!-- Help -->
                <div style="margin-bottom:8px;">
                  <div style="font-size:14px;font-weight:700;color:#111827;margin-bottom:8px;">❓ Need Help Before Paying?</div>
                  <p style="color:#6b7280;font-size:13px;margin:0 0 8px;">We can help with:</p>
                  <ul style="color:#374151;font-size:13px;margin:0;padding-left:20px;line-height:1.9;">
                    <li>Payment &amp; instalment options</li>
                    <li>Cancellation &amp; refund policy</li>
                    <li>Document requirements</li>
                  </ul>
                  <p style="color:#6b7280;font-size:13px;margin:12px 0 0;">Just <strong>reply to this email</strong> and our team will assist you 😊</p>
                </div>
              </td>
            </tr>
            <!-- Footer -->
            <tr>
              <td style="background:#f9fafb;padding:20px 32px;border-top:1px solid #f3f4f6;text-align:center;">
                <p style="color:#9ca3af;font-size:11px;margin:0;">© 2026 RoastMyDorm · Find your perfect student housing in Morocco</p>
              </td>
            </tr>
          </table>
        </td></tr>
      </table>
    </body>
    </html>
  `;

  const landlordHtml = `
    <div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;background:#f8fafc;padding:20px;border-radius:12px;">
      <h2 style="color:#007a7a;margin-bottom:4px;">📩 New Enquiry Received</h2>
      <p style="color:#6b7280;margin-top:0;">Someone is interested in: <strong>${listing.name}</strong></p>
      <table style="width:100%;border-collapse:collapse;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08);">
        <tr><td style="padding:9px 16px;color:#6b7280;width:40%;border-bottom:1px solid #f3f4f6;">Name</td><td style="padding:9px 16px;font-weight:600;color:#111827;border-bottom:1px solid #f3f4f6;">${clientName}</td></tr>
        <tr><td style="padding:9px 16px;color:#6b7280;border-bottom:1px solid #f3f4f6;">Email</td><td style="padding:9px 16px;color:#111827;border-bottom:1px solid #f3f4f6;">${clientEmail}</td></tr>
        <tr><td style="padding:9px 16px;color:#6b7280;border-bottom:1px solid #f3f4f6;">Phone</td><td style="padding:9px 16px;color:#111827;border-bottom:1px solid #f3f4f6;">${clientPhone || '—'}</td></tr>
        <tr><td style="padding:9px 16px;color:#6b7280;border-bottom:1px solid #f3f4f6;">Preferred Contact</td><td style="padding:9px 16px;color:#111827;border-bottom:1px solid #f3f4f6;">${preferredContact || '—'}</td></tr>
        <tr><td style="padding:9px 16px;color:#6b7280;vertical-align:top;">Message</td><td style="padding:9px 16px;color:#111827;">${message || '—'}</td></tr>
      </table>
      <div style="text-align:center;margin-top:20px;">
        <a href="${listingUrl}" style="background:#00a8a8;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700;display:inline-block;">View Listing →</a>
      </div>
    </div>
  `;

  await transporter.sendMail({
    from: `"RoastMyDorm" <${process.env.EMAIL_USER}>`,
    to: clientEmail,
    subject: `🎉 Enquiry confirmed — ${listing.name} | RoastMyDorm`,
    html: clientHtml
  });

  const adminEmail = process.env.ADMIN_EMAIL || process.env.EMAIL_USER;
  await transporter.sendMail({
    from: `"RoastMyDorm" <${process.env.EMAIL_USER}>`,
    to: adminEmail,
    subject: `📩 New enquiry from ${clientName} — ${listing.name}`,
    html: landlordHtml
  });

  return { success: true };
};

/**
 * Rental-outcome follow-up / reminder email, sent by the internal cron
 * endpoint (routes/internal/dormFollowUps.js). Unattended - nobody is
 * watching for a send failure - so this uses _sendEmail() (SMTP with a
 * Resend fallback), not a raw transporter.sendMail() that would silently
 * lose the message if Gmail SMTP has a bad moment.
 */
const sendRentalFollowUpEmail = async ({ to, studentName, listingTitle, listingCity, uniqueReference, followUpUrl, reminder = false }) => {
  const subject = reminder
    ? `⏰ Rappel — As-tu réussi à louer "${listingTitle}" ?`
    : `As-tu réussi à louer "${listingTitle}" ? — RoastMyDorm`;

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
              <tr>
                <td style="background: linear-gradient(135deg, #0056b3 0%, #003d82 100%); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
                  <h1 style="color: #ffffff; margin: 0; font-size: 28px;">🏠 RoastMyDorm</h1>
                </td>
              </tr>
              <tr>
                <td style="padding: 40px 30px;">
                  <h2 style="color: #333; margin: 0 0 20px 0;">Salut ${studentName} ! 👋</h2>
                  <p style="color: #666; font-size: 16px; line-height: 1.6; margin: 0 0 10px 0;">
                    ${reminder ? "Petit rappel : tu " : "Tu "}as contacté ce logement il y a quelques jours :
                  </p>
                  <div style="background-color: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0;">
                    <p style="color: #333; font-size: 18px; font-weight: bold; margin: 0 0 4px 0;">${listingTitle}</p>
                    <p style="color: #999; font-size: 14px; margin: 0;">${listingCity || ''} · Référence ${uniqueReference}</p>
                  </div>
                  <p style="color: #666; font-size: 16px; line-height: 1.6; margin: 0 0 25px 0;">
                    As-tu réussi à louer ce logement ?
                  </p>
                  <div style="text-align: center; margin: 30px 0;">
                    <a href="${followUpUrl}" style="background: linear-gradient(135deg, #0056b3 0%, #003d82 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: bold; display: inline-block;">Répondre en un clic</a>
                  </div>
                  <p style="color: #999; font-size: 13px; margin: 20px 0 0 0;">
                    Ce lien est personnel et expire dans 10 jours.
                  </p>
                </td>
              </tr>
              <tr>
                <td style="background-color: #f8f9fa; padding: 20px 30px; border-radius: 0 0 12px 12px; text-align: center;">
                  <p style="color: #999; font-size: 12px; margin: 0;">
                    © 2024 RoastMyDorm. Tous droits réservés.<br>
                    Trouve ton logement étudiant idéal au Maroc.
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

  const result = await _sendEmail({ to, subject, html });
  return { success: true, messageId: result.id };
};

/**
 * Asks the landlord/listing contact to confirm what the student already
 * reported. Only ever sent once, and only after a student has reported
 * 'rented' or 'listing_unavailable' - see
 * services/landlordOutcomeResolver.js for the trigger and
 * services/dormFollowUpProcessor.js for the batch that calls this.
 */
const sendLandlordOutcomeRequestEmail = async ({ to, landlordName, listingTitle, listingCity, uniqueReference, studentReportedOutcome, responseUrl }) => {
  const subject = studentReportedOutcome === 'rented'
    ? `Un étudiant indique avoir loué "${listingTitle}" — peux-tu confirmer ?`
    : `Un étudiant indique que "${listingTitle}" n'est plus disponible — peux-tu confirmer ?`;

  const claimText = studentReportedOutcome === 'rented'
    ? 'a indiqué avoir loué ce logement'
    : "a indiqué que ce logement n'est plus disponible";

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
              <tr>
                <td style="background: linear-gradient(135deg, #0056b3 0%, #003d82 100%); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
                  <h1 style="color: #ffffff; margin: 0; font-size: 28px;">🏠 RoastMyDorm</h1>
                </td>
              </tr>
              <tr>
                <td style="padding: 40px 30px;">
                  <h2 style="color: #333; margin: 0 0 20px 0;">Bonjour ${landlordName} 👋</h2>
                  <p style="color: #666; font-size: 16px; line-height: 1.6; margin: 0 0 10px 0;">
                    Un étudiant qui t'a contacté ${claimText} :
                  </p>
                  <div style="background-color: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0;">
                    <p style="color: #333; font-size: 18px; font-weight: bold; margin: 0 0 4px 0;">${listingTitle}</p>
                    <p style="color: #999; font-size: 14px; margin: 0;">${listingCity || ''} · Référence ${uniqueReference}</p>
                  </div>
                  <p style="color: #666; font-size: 16px; line-height: 1.6; margin: 0 0 25px 0;">
                    Peux-tu confirmer ?
                  </p>
                  <div style="text-align: center; margin: 30px 0;">
                    <a href="${responseUrl}" style="background: linear-gradient(135deg, #0056b3 0%, #003d82 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: bold; display: inline-block;">Répondre en un clic</a>
                  </div>
                  <p style="color: #999; font-size: 13px; margin: 20px 0 0 0;">
                    Ce lien est personnel et expire dans 10 jours.
                  </p>
                </td>
              </tr>
              <tr>
                <td style="background-color: #f8f9fa; padding: 20px 30px; border-radius: 0 0 12px 12px; text-align: center;">
                  <p style="color: #999; font-size: 12px; margin: 0;">
                    © 2024 RoastMyDorm. Tous droits réservés.<br>
                    Trouve ton logement étudiant idéal au Maroc.
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

  const result = await _sendEmail({ to, subject, html });
  return { success: true, messageId: result.id };
};

// ── Admin-mediated housing-request email templates ─────────────────────────
//
// Shared wrapper (emerald brand, matching the new flow's frontend - see
// frontend/universities.html and the housing-near-*.html pages' palette)
// so all 8 templates below stay visually consistent without repeating the
// same ~20 lines of table markup 8 times. Every template still builds its
// OWN subject/body and calls _sendEmail itself, exactly like every
// template above - this only removes boilerplate, not behavior.
function _wrapMediationEmailHtml(bodyHtml) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #fdfaf6;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #fdfaf6; padding: 20px;">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); max-width: 600px; width: 100%;">
              <tr>
                <td style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
                  <h1 style="color: #ffffff; margin: 0; font-size: 26px;">🏠 RoastMyDorm</h1>
                </td>
              </tr>
              <tr>
                <td style="padding: 36px 30px;">
                  ${bodyHtml}
                </td>
              </tr>
              <tr>
                <td style="background-color: #f8f9fa; padding: 20px 30px; border-radius: 0 0 12px 12px; text-align: center;">
                  <p style="color: #999; font-size: 12px; margin: 0;">
                    © ${new Date().getFullYear()} RoastMyDorm. Tous droits réservés.<br>
                    Trouve ton logement étudiant idéal au Maroc.
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

// title/city ultimately trace back to a Dorm listing's name/city - an
// admin-authored field, but still untrusted text as far as this template
// is concerned (the same reasoning utils/htmlEscape.js's own header
// comment gives for SEO metadata) - escaped here so every one of the 8
// templates below that calls this gets it for free.
function _propertyCard(title, city) {
  return `<div style="background-color: #f0fdf4; border: 1px solid #d1fae5; border-radius: 8px; padding: 18px 20px; margin: 20px 0;">
    <p style="color: #111827; font-size: 17px; font-weight: bold; margin: 0 0 4px 0;">${escapeHtml(title)}</p>
    <p style="color: #6b7280; font-size: 14px; margin: 0;">${escapeHtml(city || '')}</p>
  </div>`;
}

function _ctaButton(url, label) {
  return `<div style="text-align: center; margin: 28px 0;">
    <a href="${url}" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: bold; display: inline-block;">${label}</a>
  </div>`;
}

// A stable, non-PII idempotency key - "kind:reference" (both already
// non-sensitive: a fixed notification-kind string and the public-facing
// RMD-#### reference). Passed to _sendEmail -> _sendViaResend's
// Idempotency-Key header (verified against Resend's real API contract -
// see _sendEmail's doc comment above) and, for the SMTP path, into the
// Message-ID header for log correlation only. Every retry of the SAME
// logical send (e.g. services/notificationOutbox.js reclaiming a stale
// 'sending' entry) recomputes the identical key from the same
// kind+reference, which is exactly what makes Resend's own dedup apply.
function buildEmailIdempotencyKey(kind, reference) {
  return `housing-request:${kind}:${reference}`;
}

// Plain-text alternatives for the 8 templates below - added as an
// OPTIONAL `text` field passed to _sendEmail alongside the existing
// `html`, so every current caller of _sendEmail elsewhere in this file
// (verification/reset/property/enquiry/follow-up emails, none of which
// pass `text`) is completely unaffected - `text` is simply undefined for
// them, exactly as before this change.
//
// Deliberately NOT run through escapeHtml() - these are plain text, never
// parsed as markup by a mail client, so HTML-escaping them would show a
// reader literal "&amp;"/"&lt;" instead of the real character. The
// injection risk these templates actually have (a listing title or
// student message containing HTML) simply doesn't exist in a text/plain
// body - there is nothing here for it to inject INTO.
function _textFooter() {
  return `\n\n—\nRoastMyDorm\nTrouve ton logement étudiant idéal au Maroc.`;
}

/**
 * 1/8 — to ADMIN_INQUIRY_EMAIL only, never forwarded/cc'd to the landlord.
 * Fired once per new admin-mediated request, right after it's saved.
 */
const sendHousingRequestAdminAlert = async ({ to, reference, listingTitle, listingCity, requesterName, requesterEmail, requesterPhone, university, preferredContactMethod, message, adminUrl }) => {
  const subject = `Nouvelle demande de logement — ${reference} — ${listingTitle}`;
  const html = _wrapMediationEmailHtml(`
    <h2 style="color: #111827; margin: 0 0 18px 0;">Nouvelle demande — ${escapeHtml(reference)}</h2>
    ${_propertyCard(listingTitle, listingCity)}
    <table width="100%" cellpadding="0" cellspacing="0" style="font-size: 14px; color: #374151; margin: 16px 0;">
      <tr><td style="padding: 4px 0; color: #6b7280;">Étudiant(e)</td><td style="padding: 4px 0; font-weight: 600;">${escapeHtml(requesterName)}</td></tr>
      <tr><td style="padding: 4px 0; color: #6b7280;">E-mail</td><td style="padding: 4px 0;">${escapeHtml(requesterEmail)}</td></tr>
      <tr><td style="padding: 4px 0; color: #6b7280;">Téléphone</td><td style="padding: 4px 0;">${escapeHtml(requesterPhone)}</td></tr>
      <tr><td style="padding: 4px 0; color: #6b7280;">Université</td><td style="padding: 4px 0;">${escapeHtml(university)}</td></tr>
      <tr><td style="padding: 4px 0; color: #6b7280;">Contact préféré</td><td style="padding: 4px 0;">${escapeHtml(preferredContactMethod)}</td></tr>
    </table>
    ${message ? `<p style="color: #374151; font-size: 14px; background: #f9fafb; border-radius: 8px; padding: 14px 16px; margin: 12px 0;"><em>« ${escapeHtml(message)} »</em></p>` : ''}
    ${_ctaButton(adminUrl, 'Traiter la demande')}
  `);
  const text = `Nouvelle demande — ${reference}\n\n${listingTitle}${listingCity ? ' — ' + listingCity : ''}\n\n`
    + `Étudiant(e) : ${requesterName}\nE-mail : ${requesterEmail}\nTéléphone : ${requesterPhone}\nUniversité : ${university}\nContact préféré : ${preferredContactMethod}\n`
    + (message ? `\nMessage : « ${message} »\n` : '')
    + `\nTraiter la demande : ${adminUrl}` + _textFooter();
  const result = await _sendEmail({ to, subject, html, text, idempotencyKey: buildEmailIdempotencyKey('admin_alert', reference) });
  return { success: true, messageId: result.id };
};

/**
 * 2/8 — to the student, immediately after submission. Confirms receipt
 * only - never claims a channel (WhatsApp/etc.) that isn't actually
 * implemented; this flow only ever sends email.
 */
const sendHousingRequestReceivedEmail = async ({ to, requesterName, reference, listingTitle, listingCity, statusUrl }) => {
  const subject = `Demande reçue — ${listingTitle} — ${reference}`;
  const html = _wrapMediationEmailHtml(`
    <h2 style="color: #111827; margin: 0 0 18px 0;">Salut ${escapeHtml(requesterName)} !</h2>
    <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 10px 0;">
      Votre demande a bien été reçue. Notre équipe va vérifier la disponibilité auprès du propriétaire.
    </p>
    ${_propertyCard(listingTitle, listingCity)}
    <p style="color: #6b7280; font-size: 14px; margin: 16px 0;">Référence : <strong>${escapeHtml(reference)}</strong></p>
    <p style="color: #374151; font-size: 15px; line-height: 1.6; margin: 20px 0;">
      Nous vous informerons par e-mail dès que la disponibilité sera confirmée. Vous n'avez rien d'autre à faire pour le moment.
    </p>
    ${_ctaButton(statusUrl, 'Voir ma demande')}
  `);
  const text = `Salut ${requesterName} !\n\nVotre demande a bien été reçue. Notre équipe va vérifier la disponibilité auprès du propriétaire.\n\n`
    + `${listingTitle}${listingCity ? ' — ' + listingCity : ''}\nRéférence : ${reference}\n\n`
    + `Nous vous informerons par e-mail dès que la disponibilité sera confirmée. Vous n'avez rien d'autre à faire pour le moment.\n\n`
    + `Voir ma demande : ${statusUrl}` + _textFooter();
  const result = await _sendEmail({ to, subject, html, text, idempotencyKey: buildEmailIdempotencyKey('student_received', reference) });
  return { success: true, messageId: result.id };
};

/**
 * 3/8 — sent when an admin marks the listing available. Asks for SHARING
 * consent - a separate action from the processing consent already given at
 * submission time. Never includes any landlord contact detail.
 */
const sendHousingRequestAvailableEmail = async ({ to, requesterName, reference, listingTitle, listingCity, consentUrl }) => {
  const subject = `Bonne nouvelle — ${listingTitle} est disponible ! — ${reference}`;
  const html = _wrapMediationEmailHtml(`
    <h2 style="color: #111827; margin: 0 0 18px 0;">Bonne nouvelle, ${escapeHtml(requesterName)} !</h2>
    ${_propertyCard(listingTitle, listingCity)}
    <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 10px 0;">
      Le propriétaire a confirmé la disponibilité de ce logement.
    </p>
    <p style="color: #374151; font-size: 15px; line-height: 1.6; margin: 16px 0;">
      Pour que nous puissions vous mettre en relation, nous avons besoin de votre accord explicite pour transmettre vos coordonnées au propriétaire.
    </p>
    ${_ctaButton(consentUrl, 'Voir ma demande et donner mon accord')}
    <p style="color: #9ca3af; font-size: 13px; margin: 20px 0 0 0;">Ce lien est personnel et expire dans 30 jours.</p>
  `);
  const text = `Bonne nouvelle, ${requesterName} !\n\n${listingTitle}${listingCity ? ' — ' + listingCity : ''}\nRéférence : ${reference}\n\n`
    + `Le propriétaire a confirmé la disponibilité de ce logement.\n\n`
    + `Pour que nous puissions vous mettre en relation, nous avons besoin de votre accord explicite pour transmettre vos coordonnées au propriétaire.\n\n`
    + `Voir ma demande et donner mon accord : ${consentUrl}\n\nCe lien est personnel et expire dans 30 jours.` + _textFooter();
  const result = await _sendEmail({ to, subject, html, text, idempotencyKey: buildEmailIdempotencyKey('student_available', reference) });
  return { success: true, messageId: result.id };
};

/** 4/8 — listing turned out to be unavailable. Never shares contact info either party. */
const sendHousingRequestUnavailableEmail = async ({ to, requesterName, reference, listingTitle, listingCity, alternativesUrl }) => {
  const subject = `${listingTitle} n'est plus disponible — ${reference}`;
  const html = _wrapMediationEmailHtml(`
    <h2 style="color: #111827; margin: 0 0 18px 0;">Bonjour ${escapeHtml(requesterName)},</h2>
    ${_propertyCard(listingTitle, listingCity)}
    <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 10px 0;">
      Ce logement n'est malheureusement plus disponible.
    </p>
    <p style="color: #374151; font-size: 15px; line-height: 1.6; margin: 16px 0;">
      Nous vous invitons à consulter d'autres logements correspondant à vos critères.
    </p>
    ${_ctaButton(alternativesUrl, 'Voir des logements similaires')}
  `);
  const text = `Bonjour ${requesterName},\n\n${listingTitle}${listingCity ? ' — ' + listingCity : ''}\nRéférence : ${reference}\n\n`
    + `Ce logement n'est malheureusement plus disponible.\n\nNous vous invitons à consulter d'autres logements correspondant à vos critères.\n\n`
    + `Voir des logements similaires : ${alternativesUrl}` + _textFooter();
  const result = await _sendEmail({ to, subject, html, text, idempotencyKey: buildEmailIdempotencyKey('student_unavailable', reference) });
  return { success: true, messageId: result.id };
};

/** 5/8 — listing is temporarily reserved. No contact info shared; admin may update the status later. */
const sendHousingRequestReservedEmail = async ({ to, requesterName, reference, listingTitle, listingCity, alternativesUrl }) => {
  const subject = `${listingTitle} est temporairement réservé — ${reference}`;
  const html = _wrapMediationEmailHtml(`
    <h2 style="color: #111827; margin: 0 0 18px 0;">Bonjour ${escapeHtml(requesterName)},</h2>
    ${_propertyCard(listingTitle, listingCity)}
    <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 10px 0;">
      Ce logement est actuellement réservé par un autre candidat. Nous vous tiendrons informé(e) si la situation évolue.
    </p>
    ${_ctaButton(alternativesUrl, 'Voir des logements similaires')}
  `);
  const text = `Bonjour ${requesterName},\n\n${listingTitle}${listingCity ? ' — ' + listingCity : ''}\nRéférence : ${reference}\n\n`
    + `Ce logement est actuellement réservé par un autre candidat. Nous vous tiendrons informé(e) si la situation évolue.\n\n`
    + `Voir des logements similaires : ${alternativesUrl}` + _textFooter();
  const result = await _sendEmail({ to, subject, html, text, idempotencyKey: buildEmailIdempotencyKey('student_reserved', reference) });
  return { success: true, messageId: result.id };
};

/** 6/8 — RoastMyDorm could not reach the landlord. Never implies availability either way; never shares either party's info. */
const sendHousingRequestUnreachableEmail = async ({ to, requesterName, reference, listingTitle, listingCity, alternativesUrl }) => {
  const subject = `Impossible de confirmer la disponibilité — ${listingTitle} — ${reference}`;
  const html = _wrapMediationEmailHtml(`
    <h2 style="color: #111827; margin: 0 0 18px 0;">Bonjour ${escapeHtml(requesterName)},</h2>
    ${_propertyCard(listingTitle, listingCity)}
    <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 10px 0;">
      Nous n'avons malheureusement pas réussi à joindre le propriétaire de ce logement pour confirmer sa disponibilité.
    </p>
    <p style="color: #374151; font-size: 15px; line-height: 1.6; margin: 16px 0;">
      Nous vous invitons à consulter d'autres logements en attendant, ou à contacter notre équipe si vous avez des questions.
    </p>
    ${_ctaButton(alternativesUrl, 'Voir des logements similaires')}
  `);
  const text = `Bonjour ${requesterName},\n\n${listingTitle}${listingCity ? ' — ' + listingCity : ''}\nRéférence : ${reference}\n\n`
    + `Nous n'avons malheureusement pas réussi à joindre le propriétaire de ce logement pour confirmer sa disponibilité.\n\n`
    + `Nous vous invitons à consulter d'autres logements en attendant, ou à contacter notre équipe si vous avez des questions.\n\n`
    + `Voir des logements similaires : ${alternativesUrl}` + _textFooter();
  const result = await _sendEmail({ to, subject, html, text, idempotencyKey: buildEmailIdempotencyKey('student_unreachable', reference) });
  return { success: true, messageId: result.id };
};

/**
 * 7/8 — the ONLY email that ever carries the student's contact details, and
 * only ever sent by services/dormHandoff.js after real, verified sharing
 * consent (see that file's idempotency guard). Explains to the landlord
 * that the student explicitly consented to sharing these details.
 */
const sendHousingRequestLandlordHandoffEmail = async ({ to, landlordName, reference, listingTitle, studentName, studentEmail, studentPhone, university, preferredContactMethod, message }) => {
  const subject = `Étudiant(e) intéressé(e) par "${listingTitle}" — ${reference}`;
  const html = _wrapMediationEmailHtml(`
    <h2 style="color: #111827; margin: 0 0 18px 0;">Bonjour${landlordName ? ' ' + escapeHtml(landlordName) : ''},</h2>
    <p style="color: #374151; font-size: 15px; line-height: 1.6; margin: 0 0 16px 0;">
      Un(e) étudiant(e) intéressé(e) par votre logement <strong>« ${escapeHtml(listingTitle)} »</strong> a explicitement autorisé RoastMyDorm à vous transmettre ses coordonnées.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="font-size: 14px; color: #374151; margin: 16px 0; background: #f9fafb; border-radius: 8px; padding: 4px 16px;">
      <tr><td style="padding: 8px 0; color: #6b7280;">Nom</td><td style="padding: 8px 0; font-weight: 600;">${escapeHtml(studentName)}</td></tr>
      <tr><td style="padding: 8px 0; color: #6b7280;">E-mail</td><td style="padding: 8px 0;">${escapeHtml(studentEmail)}</td></tr>
      <tr><td style="padding: 8px 0; color: #6b7280;">Téléphone</td><td style="padding: 8px 0;">${escapeHtml(studentPhone)}</td></tr>
      <tr><td style="padding: 8px 0; color: #6b7280;">Université</td><td style="padding: 8px 0;">${escapeHtml(university)}</td></tr>
      <tr><td style="padding: 8px 0; color: #6b7280;">Contact préféré</td><td style="padding: 8px 0;">${escapeHtml(preferredContactMethod)}</td></tr>
    </table>
    ${message ? `<p style="color: #374151; font-size: 14px; background: #f0fdf4; border-radius: 8px; padding: 14px 16px; margin: 12px 0;"><em>« ${escapeHtml(message)} »</em></p>` : ''}
    <p style="color: #6b7280; font-size: 13px; margin: 20px 0 0 0;">Référence RoastMyDorm : ${escapeHtml(reference)}</p>
  `);
  const text = `Bonjour${landlordName ? ' ' + landlordName : ''},\n\n`
    + `Un(e) étudiant(e) intéressé(e) par votre logement « ${listingTitle} » a explicitement autorisé RoastMyDorm à vous transmettre ses coordonnées.\n\n`
    + `Nom : ${studentName}\nE-mail : ${studentEmail}\nTéléphone : ${studentPhone}\nUniversité : ${university}\nContact préféré : ${preferredContactMethod}\n`
    + (message ? `\nMessage : « ${message} »\n` : '')
    + `\nRéférence RoastMyDorm : ${reference}` + _textFooter();
  const result = await _sendEmail({ to, subject, html, text, idempotencyKey: buildEmailIdempotencyKey('landlord_handoff', reference) });
  return { success: true, messageId: result.id };
};

/** 8/8 — internal, to ADMIN_INQUIRY_EMAIL only. Never includes a raw provider error/stack - a coarse category only, matching the model's existing failureCategory policy. */
const sendHousingRequestAdminDeliveryFailureEmail = async ({ to, reference, listingTitle, failedEmailType, errorCategory, adminUrl }) => {
  const subject = `⚠️ Échec d'envoi — ${failedEmailType} — ${reference}`;
  const html = _wrapMediationEmailHtml(`
    <h2 style="color: #b91c1c; margin: 0 0 18px 0;">Échec d'envoi d'e-mail</h2>
    <p style="color: #374151; font-size: 15px; line-height: 1.6; margin: 0 0 16px 0;">
      L'envoi de l'e-mail <strong>${escapeHtml(failedEmailType)}</strong> pour la demande <strong>${escapeHtml(reference)}</strong> (${escapeHtml(listingTitle)}) a échoué.
    </p>
    <p style="color: #6b7280; font-size: 14px; margin: 0 0 16px 0;">Catégorie d'erreur : ${escapeHtml(errorCategory)}</p>
    ${_ctaButton(adminUrl, 'Voir la demande et réessayer')}
  `);
  const text = `Échec d'envoi d'e-mail\n\nL'envoi de l'e-mail ${failedEmailType} pour la demande ${reference} (${listingTitle}) a échoué.\n\n`
    + `Catégorie d'erreur : ${errorCategory}\n\nVoir la demande et réessayer : ${adminUrl}` + _textFooter();
  // No reference-scoped idempotency key here on purpose: a fresh delivery-
  // failure alert should go out for EACH distinct failed attempt, not be
  // deduplicated against a previous failure's alert for the same
  // reference+kind - callers already prevent flooding via their own retry
  // cadence, not via provider-side idempotency.
  const result = await _sendEmail({ to, subject, html, text });
  return { success: true, messageId: result.id };
};

module.exports = {
  generateVerificationToken,
  generateVerificationCode,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendPropertySubmissionAlert,
  sendPropertyDecisionEmail,
  sendEnquiryConfirmation,
  sendRentalFollowUpEmail,
  sendLandlordOutcomeRequestEmail,
  sendHousingRequestAdminAlert,
  sendHousingRequestReceivedEmail,
  sendHousingRequestAvailableEmail,
  sendHousingRequestUnavailableEmail,
  sendHousingRequestReservedEmail,
  sendHousingRequestUnreachableEmail,
  sendHousingRequestLandlordHandoffEmail,
  sendHousingRequestAdminDeliveryFailureEmail
};
