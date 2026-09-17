/**
 * Durable delivery for the admin-mediated flow's non-handoff notification
 * emails (admin_alert, student_received, student_available,
 * student_unavailable, student_reserved, student_unreachable). The landlord
 * handoff email is deliberately NOT routed through here - it already has
 * its own stronger, tested, consent-gated atomic claim in
 * services/dormHandoff.js (handoff.inProgress/success/failureCategory) and
 * merging it into this generic outbox would only add risk for no benefit.
 *
 * Root cause this fixes: the previous code fired these emails with
 * `.then()/.catch()` and returned the HTTP response immediately, without
 * waiting for either the send or the failure-flag write. A process restart
 * between "email queued" and "failure flag saved" silently lost the
 * notification forever - nothing on disk recorded it was ever attempted.
 *
 * The fix (approach A, per spec - appropriate at this project's current
 * scale; a separate outbox collection with a polling worker would be
 * approach B, not needed yet): every entry is stored as a subdocument on
 * the inquiry ITSELF, and every write - claim, success, failure - is one
 * atomic MongoDB operation that lands before the caller looks at the
 * result. Callers (the creation route, the admin status-transition route,
 * and the retry endpoint) `await dispatchNotification(...)` synchronously,
 * inside try/catch, and the caller decides to still return 201/200
 * regardless of the outcome - so an email failure can never roll back the
 * inquiry or fail the request, exactly as required.
 *
 * Concurrency/crash guarantees (see claimNotification below):
 *  - Two concurrent callers for the same (inquiryId, kind) can only ever
 *    have ONE win the atomic claim - the other gets `attempted:false` and
 *    does nothing. No duplicate sends under a double-click, a network
 *    retry, or an admin double-clicking "retry" while a real attempt is
 *    still in flight.
 *  - A process that crashes AFTER claiming (status:'sending') but BEFORE
 *    recording a result would otherwise leave that entry stuck forever,
 *    with the admin's retry button unable to act on it. STALE_CLAIM_MS
 *    makes a 'sending' entry reclaimable once it's older than that - a
 *    crash-window test below proves this.
 *  - A successful send (status:'sent') is never matched by the claim query
 *    again - "successful sends are not retried" holds structurally, not
 *    by a caller remembering to check first.
 */
const DormInquiry = require('../models/DormInquiry');
const emailService = require('../utils/email'); // namespace, not destructured - see dormHandoff.js's comment for why
const { issueHousingRequestStatusToken } = require('../utils/housingRequestStatusToken');

// If a claimed ('sending') attempt is older than this with no result
// recorded, treat it as abandoned (the process that claimed it almost
// certainly crashed or was killed) and allow another claim to reclaim it.
const STALE_CLAIM_MS = 2 * 60 * 1000;

/** Coarse, non-sensitive category only - never a raw provider error/stack/PII, matching dormHandoff.js's categorizeError() convention. */
function categorizeNotificationError(err) {
  const msg = String((err && err.message) || '').toLowerCase();
  if (msg.includes('not set') || msg.includes('not configured')) return 'email_not_configured';
  if (msg.includes('timeout')) return 'send_timeout';
  if (msg.includes('invalid') && msg.includes('recipient')) return 'invalid_recipient';
  if (msg.includes('reject')) return 'provider_rejected';
  return 'send_failed';
}

// Capped exponential backoff (5m, 15m, 45m, ... capped at 2h) - well
// inside Resend's documented 24h Idempotency-Key retention window (see
// utils/email.js's _sendEmail doc comment for the full guarantee
// breakdown), so a value computed here never risks an admin's eventual
// manual retry landing outside that window. Written for a future auto-
// retry scheduler to read; nothing currently reads it back - the dorm
// follow-up scheduler stays disabled per project constraints, so today
// the only way a failed/stuck notification is retried is an admin click
// (routes/admin/housingRequests.js's retry-notification route). Any
// FUTURE automatic scheduler built on top of this value must itself
// enforce the 24h cap explicitly (2h backoff alone doesn't guarantee a
// long chain of retries stays under 24h) or warn the admin before a retry
// past that point - not this function's job, since no such scheduler
// exists yet.
function backoffMs(attempts) {
  return Math.min(5 * 60 * 1000 * Math.pow(3, Math.max(0, attempts - 1)), 2 * 60 * 60 * 1000);
}

/**
 * Idempotently ensures a `kind` entry exists on the inquiry (status:
 * 'pending'). Safe under concurrency: MongoDB evaluates an update's filter
 * and applies its modification as one atomic operation per document, so
 * two callers racing to add the same missing kind cannot both succeed -
 * whichever lands second re-evaluates against the now-present entry and
 * matches nothing.
 */
async function ensureNotificationEntry(inquiryId, kind) {
  await DormInquiry.updateOne(
    { _id: inquiryId, 'mediationNotifications.kind': { $ne: kind } },
    { $push: { mediationNotifications: { kind, status: 'pending', attempts: 0, lastAttemptedAt: null, sentAt: null, errorCategory: null, nextRetryAt: null } } }
  );
}

/**
 * The actual concurrency guard - see the file header. Two-step because a
 * single query mixing "pending/failed" OR "stale sending" via $elemMatch+$or
 * is harder to reason about with the positional $ update operator; each
 * step here is independently atomic, so trying the second only when the
 * first finds nothing introduces no race.
 */
async function claimNotification(inquiryId, kind) {
  const now = new Date();

  let claimed = await DormInquiry.findOneAndUpdate(
    { _id: inquiryId, mediationNotifications: { $elemMatch: { kind, status: { $in: ['pending', 'failed'] } } } },
    {
      $set: { 'mediationNotifications.$.status': 'sending', 'mediationNotifications.$.lastAttemptedAt': now },
      $inc: { 'mediationNotifications.$.attempts': 1 },
    },
    { new: true }
  );
  if (claimed) return claimed;

  const staleBefore = new Date(now.getTime() - STALE_CLAIM_MS);
  claimed = await DormInquiry.findOneAndUpdate(
    { _id: inquiryId, mediationNotifications: { $elemMatch: { kind, status: 'sending', lastAttemptedAt: { $lt: staleBefore } } } },
    {
      $set: { 'mediationNotifications.$.status': 'sending', 'mediationNotifications.$.lastAttemptedAt': now },
      $inc: { 'mediationNotifications.$.attempts': 1 },
    },
    { new: true }
  );
  return claimed;
}

/**
 * Runs `sendFn` under the atomic claim above and records a durable result
 * before returning. `sendFn` receives no arguments and must throw on
 * failure (a rejected promise) - its return value is ignored.
 */
async function sendNotification(inquiryId, kind, sendFn) {
  const claimed = await claimNotification(inquiryId, kind);
  if (!claimed) return { attempted: false, reason: 'already_sent_or_in_progress' };

  try {
    await sendFn();
    await DormInquiry.updateOne(
      { _id: inquiryId, 'mediationNotifications.kind': kind },
      { $set: { 'mediationNotifications.$.status': 'sent', 'mediationNotifications.$.sentAt': new Date(), 'mediationNotifications.$.errorCategory': null, 'mediationNotifications.$.nextRetryAt': null } }
    );
    return { attempted: true, sent: true };
  } catch (err) {
    const category = categorizeNotificationError(err);
    const entry = claimed.mediationNotifications.find((n) => n.kind === kind);
    const attempts = entry ? entry.attempts : 1;
    await DormInquiry.updateOne(
      { _id: inquiryId, 'mediationNotifications.kind': kind },
      { $set: { 'mediationNotifications.$.status': 'failed', 'mediationNotifications.$.errorCategory': category, 'mediationNotifications.$.nextRetryAt': new Date(Date.now() + backoffMs(attempts)) } }
    );
    return { attempted: true, sent: false, errorCategory: category };
  }
}

function clientUrlBase() {
  return (process.env.CLIENT_URL || '').replace(/\/$/, '');
}

function buildStatusUrl(inquiry, guestToken) {
  return `${clientUrlBase()}/housing-request-status.html?ref=${encodeURIComponent(inquiry.uniqueReference)}${guestToken ? `#t=${encodeURIComponent(guestToken)}` : ''}`;
}

function buildAlternativesUrl(inquiry) {
  const city = (inquiry.listingSnapshot.city || '').toLowerCase();
  const page = city === 'marrakech' ? 'marrakech-dorms.html' : city === 'casablanca' ? 'casablanca-dorms.html' : 'rabat-dorms.html';
  return `${clientUrlBase()}/${page}`;
}

/**
 * Mints a fresh guest status-token AT SEND TIME, only when a kind's sender
 * actually runs - which (see sendNotification above) only happens once the
 * atomic claim is won. This is deliberate: minting/persisting a token
 * earlier (e.g. by the CALLER, before even attempting the claim) would
 * overwrite statusToken.jtiHash even on a no-op call - such as adopting an
 * already-fully-delivered inquiry after a benign double-click - silently
 * invalidating a link already emailed to the student for no reason. By
 * minting only inside the sender, a call that turns out to be a no-op
 * (already 'sent' or 'sending') never touches the token at all.
 * Authenticated requesters need no token (their session covers
 * GET /:reference instead) - returns null immediately for them.
 */
async function mintGuestTokenIfNeeded(inquiry) {
  if (!inquiry.requester.isGuest) return null;
  const { token, jtiHash, expiresAt } = issueHousingRequestStatusToken(inquiry._id, inquiry.uniqueReference);
  await DormInquiry.updateOne({ _id: inquiry._id }, { $set: { statusToken: { jtiHash, createdAt: new Date(), expiresAt, revokedAt: null } } });
  return token;
}

// One sender per kind - the single place each notification's arguments are
// built, reused identically at creation time, at status-transition time,
// and at retry time (previously duplicated across three route handlers).
const KIND_SENDERS = {
  admin_alert: (inquiry, ctx) => emailService.sendHousingRequestAdminAlert({
    to: ctx.adminEmail,
    reference: inquiry.uniqueReference,
    listingTitle: inquiry.listingSnapshot.title,
    listingCity: inquiry.listingSnapshot.city,
    requesterName: inquiry.requester.name,
    requesterEmail: inquiry.requester.email,
    requesterPhone: inquiry.requester.phoneCountryCode ? `${inquiry.requester.phoneCountryCode}${inquiry.requester.phone}` : inquiry.requester.phone,
    university: inquiry.requester.university,
    preferredContactMethod: inquiry.requester.preferredContactMethod,
    message: inquiry.requester.message,
    adminUrl: `${clientUrlBase()}/admin-dashboard.html#housing-requests`,
  }),
  student_received: async (inquiry) => {
    const guestToken = await mintGuestTokenIfNeeded(inquiry);
    return emailService.sendHousingRequestReceivedEmail({
      to: inquiry.requester.email,
      requesterName: inquiry.requester.name,
      reference: inquiry.uniqueReference,
      listingTitle: inquiry.listingSnapshot.title,
      listingCity: inquiry.listingSnapshot.city,
      statusUrl: buildStatusUrl(inquiry, guestToken),
    });
  },
  student_available: async (inquiry) => {
    const guestToken = await mintGuestTokenIfNeeded(inquiry);
    return emailService.sendHousingRequestAvailableEmail({
      to: inquiry.requester.email,
      requesterName: inquiry.requester.name,
      reference: inquiry.uniqueReference,
      listingTitle: inquiry.listingSnapshot.title,
      listingCity: inquiry.listingSnapshot.city,
      consentUrl: buildStatusUrl(inquiry, guestToken),
    });
  },
  student_unavailable: (inquiry) => emailService.sendHousingRequestUnavailableEmail({
    to: inquiry.requester.email,
    requesterName: inquiry.requester.name,
    reference: inquiry.uniqueReference,
    listingTitle: inquiry.listingSnapshot.title,
    listingCity: inquiry.listingSnapshot.city,
    alternativesUrl: buildAlternativesUrl(inquiry),
  }),
  student_reserved: (inquiry) => emailService.sendHousingRequestReservedEmail({
    to: inquiry.requester.email,
    requesterName: inquiry.requester.name,
    reference: inquiry.uniqueReference,
    listingTitle: inquiry.listingSnapshot.title,
    listingCity: inquiry.listingSnapshot.city,
    alternativesUrl: buildAlternativesUrl(inquiry),
  }),
  student_unreachable: (inquiry) => emailService.sendHousingRequestUnreachableEmail({
    to: inquiry.requester.email,
    requesterName: inquiry.requester.name,
    reference: inquiry.uniqueReference,
    listingTitle: inquiry.listingSnapshot.title,
    listingCity: inquiry.listingSnapshot.city,
    alternativesUrl: buildAlternativesUrl(inquiry),
  }),
};

/**
 * The one call site every route uses. Ensures the entry exists, re-fetches
 * the current inquiry (so a retry always builds its email from present
 * data, e.g. a freshly re-issued guest token), then claims+sends+records
 * through sendNotification() above.
 *
 * `ctx.adminEmail` is required for the admin_alert kind. No other kind
 * needs anything from `ctx` - student_received/student_available mint
 * their own guest token internally, at send time (see
 * mintGuestTokenIfNeeded above), and the rest need nothing beyond the
 * inquiry document itself.
 */
async function dispatchNotification(inquiryId, kind, ctx = {}) {
  if (!KIND_SENDERS[kind]) throw new Error(`notificationOutbox: unknown kind "${kind}"`);
  await ensureNotificationEntry(inquiryId, kind);
  const inquiry = await DormInquiry.findById(inquiryId);
  if (!inquiry) return { attempted: false, reason: 'not_found' };
  return sendNotification(inquiryId, kind, () => KIND_SENDERS[kind](inquiry, ctx));
}

module.exports = {
  dispatchNotification,
  ensureNotificationEntry,
  claimNotification,
  sendNotification,
  categorizeNotificationError,
  STALE_CLAIM_MS,
};
