/**
 * The ONLY code path in the codebase authorized to send a landlord the
 * student's contact details for the admin-mediated flow. Everything here
 * exists to make two guarantees hold even under concurrent/duplicate
 * requests:
 *
 *  1. The landlord email is sent AT MOST ONCE per inquiry, no matter how
 *     many times a student double-clicks "I agree," how many browser tabs
 *     are open, or how many times a network retry resends the same
 *     request - see claimHandoffAttempt() below, the actual concurrency
 *     guard (an atomic MongoDB write, not an in-memory lock, so it holds
 *     across multiple Node processes too).
 *  2. Consent is never lost, and the landlord is never emailed without it.
 *     recordSharingConsent() and sendHandoff() are deliberately separate
 *     atomic operations - a crash between them leaves consent recorded but
 *     the handoff retryable, never the other way around.
 */
const Dorm = require('../models/Dorm');
const DormInquiry = require('../models/DormInquiry');
const { HANDOFF_AUTHORIZATION_TOKEN } = require('../models/DormInquiry');
// Referenced via the module namespace, not destructured, so
// jest.spyOn(emailService, 'sendHousingRequestLandlordHandoffEmail') in
// tests actually intercepts calls made from here - same convention as
// services/dormFollowUpProcessor.js.
const emailService = require('../utils/email');

/**
 * Records the student's SHARING consent - deliberately separate from the
 * PROCESSING consent already given at submission time (consent.
 * processingConsentAt, set in routes/housingRequests.js). Atomic: only
 * succeeds if the inquiry is currently 'awaiting_student_consent' and
 * sharing consent has not already been given, so a double-submit of the
 * consent form is a harmless no-op on the second call (returns null), not
 * a second consent event.
 */
async function recordSharingConsent(inquiryId) {
  return DormInquiry.findOneAndUpdate(
    {
      _id: inquiryId,
      flowType: 'admin_mediated',
      mediationStatus: 'awaiting_student_consent',
      'consent.sharingConsentAt': null,
    },
    {
      $set: { 'consent.sharingConsentAt': new Date() },
      $push: { mediationHistory: { event: 'sharing_consent_given', actor: 'student', createdAt: new Date() } },
    },
    { new: true }
  );
}

/** Coarse, non-sensitive category only - never a raw provider error/stack. */
function categorizeError(err) {
  const msg = String((err && err.message) || '').toLowerCase();
  if (msg.includes('not set') || msg.includes('not configured')) return 'email_not_configured';
  if (msg.includes('timeout')) return 'send_timeout';
  return 'send_failed';
}

/**
 * The actual send. Call this only after recordSharingConsent() has
 * succeeded (or on a retry, where consent is already recorded). Safe to
 * call concurrently/repeatedly - see claimHandoffAttempt()'s comment.
 * Returns { sent: true } on a genuine successful send, { sent: false,
 * reason } otherwise (including 'already_in_progress' and
 * 'already_sent', both of which are NOT errors - they're the guard
 * working as intended).
 */
async function sendHandoff(inquiryId, { adminEmail } = {}) {
  const claimed = await claimHandoffAttempt(inquiryId);
  if (!claimed) {
    const current = await DormInquiry.findById(inquiryId);
    if (current && current.handoff.success) return { sent: false, reason: 'already_sent' };
    return { sent: false, reason: 'already_in_progress' };
  }

  try {
    if (claimed.flowType !== 'admin_mediated') {
      throw Object.assign(new Error('sendHandoff() called on a non-admin_mediated inquiry.'), { code: 'WRONG_FLOW' });
    }
    if (!claimed.consent.sharingConsentAt) {
      throw Object.assign(new Error('sendHandoff() called before sharing consent was recorded.'), { code: 'NO_CONSENT' });
    }

    const dorm = await Dorm.findById(claimed.listing);
    const landlordEmail = dorm && dorm.contactInfo && dorm.contactInfo.email;
    if (!landlordEmail) {
      await releaseClaim(inquiryId, { failureCategory: 'missing_landlord_email' });
      if (adminEmail) {
        await emailService.sendHousingRequestAdminDeliveryFailureEmail({
          to: adminEmail,
          reference: claimed.uniqueReference,
          listingTitle: claimed.listingSnapshot.title,
          failedEmailType: 'landlord handoff',
          errorCategory: 'missing_landlord_email',
          adminUrl: '',
        }).catch(() => {});
      }
      return { sent: false, reason: 'missing_landlord_email' };
    }

    // The one and only call site for this serializer in the whole
    // codebase - see its own guard comments in models/DormInquiry.js for
    // what it independently re-verifies before returning anything.
    const handoffView = claimed.toLandlordHandoffView(HANDOFF_AUTHORIZATION_TOKEN);
    const landlordName = (dorm.contactInfo && [dorm.contactInfo.firstName, dorm.contactInfo.lastName].filter(Boolean).join(' ')) || '';

    await emailService.sendHousingRequestLandlordHandoffEmail({
      to: landlordEmail,
      landlordName,
      reference: handoffView.reference,
      listingTitle: handoffView.propertyTitle,
      studentName: handoffView.studentName,
      studentEmail: handoffView.studentEmail,
      studentPhone: handoffView.studentPhone,
      university: handoffView.university,
      preferredContactMethod: handoffView.preferredContactMethod,
      message: handoffView.message,
    });

    // Success - transition to the terminal mediationStatus AND record the
    // handoff outcome in the same atomic write. From here the post-contact
    // rental-outcome system (already built, untouched by this phase) may
    // begin - see the schema's handoff-boundary note.
    const now = new Date();
    await DormInquiry.updateOne(
      { _id: inquiryId },
      {
        $set: {
          mediationStatus: 'handoff_sent',
          'handoff.sentAt': now,
          'handoff.method': 'email',
          'handoff.success': true,
          'handoff.failureCategory': null,
          'handoff.inProgress': false,
        },
        $push: { mediationHistory: { event: 'handoff_sent', actor: 'system', createdAt: now } },
      }
    );
    return { sent: true };
  } catch (err) {
    const category = categorizeError(err);
    await releaseClaim(inquiryId, { failureCategory: category });
    if (adminEmail) {
      await emailService.sendHousingRequestAdminDeliveryFailureEmail({
        to: adminEmail,
        reference: claimed.uniqueReference,
        listingTitle: claimed.listingSnapshot.title,
        failedEmailType: 'landlord handoff',
        errorCategory: category,
        adminUrl: '',
      }).catch(() => {});
    }
    return { sent: false, reason: category };
  }
}

/**
 * The actual concurrency guard: ONE atomic findOneAndUpdate that only one
 * concurrent caller can win. Matches {handoff.success: not true,
 * handoff.inProgress: not true} and sets inProgress=true - every other
 * simultaneous caller's matching findOneAndUpdate simply matches zero
 * documents (Mongo re-evaluates the filter per-document at write time) and
 * gets null back. This is what makes it safe across multiple concurrent
 * requests AND multiple Node processes (unlike an in-memory Set/lock,
 * which only protects one process).
 */
async function claimHandoffAttempt(inquiryId) {
  return DormInquiry.findOneAndUpdate(
    {
      _id: inquiryId,
      flowType: 'admin_mediated',
      'handoff.success': { $ne: true },
      'handoff.inProgress': { $ne: true },
    },
    { $set: { 'handoff.inProgress': true } },
    { new: true }
  );
}

/** Releases the in-progress claim after a failed attempt, so a later retry can claim again. Never touches handoff.success. */
async function releaseClaim(inquiryId, { failureCategory } = {}) {
  await DormInquiry.updateOne(
    { _id: inquiryId },
    { $set: { 'handoff.inProgress': false, 'handoff.failureCategory': failureCategory || null } }
  );
}

module.exports = { recordSharingConsent, sendHandoff, claimHandoffAttempt };
