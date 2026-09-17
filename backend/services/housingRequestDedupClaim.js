/**
 * Database-enforced atomic deduplication for housing-request creation -
 * see models/HousingRequestDedupClaim.js for the schema and why it's
 * shaped the way it is (in particular: guest claims use TWO separately
 * unique-indexed fields so an email-only or phone-only match is a real,
 * atomically-enforced conflict, not just an exact-tuple match).
 *
 * This file is the ONLY place that decides who "wins" a race between
 * concurrent submissions for the same identity; the caller (routes/
 * housingRequests.js) never re-derives that decision itself, and never
 * creates a document speculatively and deletes it later.
 */
const crypto = require('crypto');
const HousingRequestDedupClaim = require('../models/HousingRequestDedupClaim');

/**
 * Domain-separated HMAC-SHA256 digest of an identity value - listing +
 * student ids are opaque internal ObjectIds (not personal data) and stay
 * in plain text in the key; email and phone are real PII and are NEVER
 * stored in plain text anywhere in this collection, only as this digest.
 * `domain` (e.g. "guest-email" vs "guest-phone" vs "auth-student")
 * prevents an email that happens to equal some phone's digits (or an
 * email colliding across the auth/guest domains) from ever producing the
 * same digest - each domain is a cryptographically separate keyspace even
 * for an identical raw input.
 *
 * HOUSING_REQUEST_DEDUP_SECRET must be set - this throws rather than
 * silently falling back to a weaker/predictable key. Never logs the
 * secret or the raw input, in an error or anywhere else - only the
 * resulting digest (already a one-way hash) ever appears in claim
 * documents/queries/logs.
 *
 * Rotation note: changing this secret only invalidates in-flight claims
 * (which are short-lived - at most DUPLICATE_WINDOW_MS old, currently 2
 * minutes) and forces every identity's digest to change, meaning a claim
 * created under the old secret is simply never matched again - not a
 * security issue (worst case: one extra inquiry gets created for a
 * request that happened to be mid-flight during rotation, never a data
 * loss or a leak). It has NO effect on inquiry ownership, DormInquiry
 * history, or any already-persisted data - those never use this secret at
 * all (they store the requester's actual email/phone directly, by
 * design, for the admin/student views that legitimately need to display
 * them).
 */
function hmacDigest(domain, value) {
  const secret = process.env.HOUSING_REQUEST_DEDUP_SECRET;
  if (!secret) throw new Error('HOUSING_REQUEST_DEDUP_SECRET is not set - required for housing-request deduplication claims.');
  return crypto.createHmac('sha256', secret).update(`${domain}:${value}`).digest('hex');
}

// Bounded wait for a LOSER to observe the WINNER's inquiry once created -
// not a correctness mechanism (the unique indexes are what guarantee
// exactly one winner), just a UX/availability bound. See
// routes/housingRequests.js's orphan-recovery fallback for what happens
// when this budget runs out.
const POLL_INTERVAL_MS = 100;
const POLL_MAX_ATTEMPTS = 15; // ~1.5s total

function buildAuthIdentityKey(listingId, studentId) {
  return `auth:${listingId}:${hmacDigest('auth-student', studentId)}`;
}

function buildGuestIdentityKeys(listingId, normalizedEmail, normalizedPhone) {
  return {
    emailKey: `guest-email:${listingId}:${hmacDigest('guest-email', normalizedEmail || '')}`,
    phoneKey: `guest-phone:${listingId}:${hmacDigest('guest-phone', normalizedPhone || '')}`,
  };
}

function isReclaimable(claim, now) {
  return claim.status === 'failed' || claim.expiresAt < now;
}

/**
 * Authenticated path - single unique field, no OR semantics needed.
 * Same two-step shape as the guest path below: try a fresh insert first
 * (the common case), fall back to an atomic takeover of an
 * expired/failed claim for the same key.
 */
async function acquireAuthClaim(listingId, studentId, windowMs) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + windowMs);
  const authIdentityKey = buildAuthIdentityKey(listingId, studentId);

  try {
    const claim = await HousingRequestDedupClaim.create({ kind: 'auth', authIdentityKey, status: 'pending', createdAt: now, expiresAt });
    return { won: true, claim, authIdentityKey };
  } catch (err) {
    if (err.code !== 11000) throw err;
  }

  const takeover = await HousingRequestDedupClaim.findOneAndUpdate(
    { authIdentityKey, $or: [{ expiresAt: { $lt: now } }, { status: 'failed' }] },
    { $set: { status: 'pending', inquiryId: null, createdAt: now, expiresAt } },
    { new: true }
  );
  if (takeover) return { won: true, claim: takeover, authIdentityKey };
  return { won: false, authIdentityKey };
}

/**
 * Guest path - the OR-semantics fix. A single atomic `create()` sets
 * BOTH guestEmailIdentityKey and guestPhoneIdentityKey; MongoDB checks
 * both unique partial indexes as part of that one insert, so a conflict
 * on EITHER field rejects the whole document - exactly the "same email
 * OR same phone" rule this replaces the old AND-only key for.
 *
 * Takeover-on-expiry: only attempted when the conflict resolves to
 * EXACTLY ONE existing claim document (found via an $or lookup on both
 * keys) that is itself expired/failed. A findOneAndUpdate scoped to that
 * document's own _id plus the same expired/failed condition makes the
 * takeover itself a compare-and-swap - two callers racing to take over
 * the same stale claim can still only have one succeed. If the conflict
 * instead resolves to TWO DIFFERENT documents (a rare cross-match: this
 * submission's email matches one older claim while its phone
 * independently matches a different older claim), takeover is
 * deliberately NOT attempted - overwriting either would silently drop
 * protection for whichever identity component it didn't come from. That
 * shape safely loses the race (the caller gets a retry response) rather
 * than guessing which of two unrelated claims to override.
 */
async function acquireGuestClaim(listingId, normalizedEmail, normalizedPhone, windowMs) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + windowMs);
  const { emailKey, phoneKey } = buildGuestIdentityKeys(listingId, normalizedEmail, normalizedPhone);

  try {
    const claim = await HousingRequestDedupClaim.create({
      kind: 'guest', guestEmailIdentityKey: emailKey, guestPhoneIdentityKey: phoneKey,
      status: 'pending', createdAt: now, expiresAt,
    });
    return { won: true, claim, emailKey, phoneKey };
  } catch (err) {
    if (err.code !== 11000) throw err;
  }

  const conflicts = await HousingRequestDedupClaim.find({ $or: [{ guestEmailIdentityKey: emailKey }, { guestPhoneIdentityKey: phoneKey }] });
  if (conflicts.length === 1 && isReclaimable(conflicts[0], now)) {
    const existing = conflicts[0];
    const takeover = await HousingRequestDedupClaim.findOneAndUpdate(
      { _id: existing._id, $or: [{ expiresAt: { $lt: now } }, { status: 'failed' }] },
      { $set: { guestEmailIdentityKey: emailKey, guestPhoneIdentityKey: phoneKey, status: 'pending', inquiryId: null, createdAt: now, expiresAt } },
      { new: true }
    );
    if (takeover) return { won: true, claim: takeover, emailKey, phoneKey };
  }
  return { won: false, emailKey, phoneKey };
}

/** The winner calls this exactly once, after its DormInquiry.create() succeeds. */
async function attachInquiry(claimId, inquiryId) {
  await HousingRequestDedupClaim.updateOne({ _id: claimId }, { $set: { inquiryId, status: 'attached' } });
}

/** The winner calls this if its own inquiry creation throws - makes the claim immediately takeover-eligible instead of making everyone wait out the rest of the window. */
async function releaseFailedClaim(claimId) {
  await HousingRequestDedupClaim.updateOne({ _id: claimId }, { $set: { status: 'failed' } });
}

/**
 * A LOSER's path: poll for the winner to attach its inquiryId. Works for
 * both auth (single key) and guest (either key) claims - pass whichever
 * key(s) apply.
 *
 * Returns:
 *  - an ObjectId once the winner attaches one (the normal case)
 *  - null if every matching claim disappears entirely before that
 *    (expired/taken over by someone else mid-wait)
 *  - undefined if the wait budget runs out with a claim still 'pending'
 *    and no inquiryId (the winner is slow OR CRASHED between creating
 *    its inquiry and attaching it - see routes/housingRequests.js's
 *    orphan-recovery fallback, which is what actually resolves this case
 *    safely rather than this function guessing).
 */
async function waitForWinnerInquiry({ authIdentityKey, emailKey, phoneKey }) {
  const filter = authIdentityKey
    ? { authIdentityKey }
    : { $or: [{ guestEmailIdentityKey: emailKey }, { guestPhoneIdentityKey: phoneKey }] };

  for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt += 1) {
    // eslint-disable-next-line no-await-in-loop
    const claims = await HousingRequestDedupClaim.find(filter);
    if (!claims.length) return null;
    const attached = claims.find((c) => c.inquiryId);
    if (attached) return attached.inquiryId;
    if (claims.every((c) => c.status === 'failed')) return null; // takeover-eligible immediately - let the caller retry acquisition
    // eslint-disable-next-line no-await-in-loop
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
  return undefined;
}

module.exports = {
  buildAuthIdentityKey,
  buildGuestIdentityKeys,
  acquireAuthClaim,
  acquireGuestClaim,
  attachInquiry,
  releaseFailedClaim,
  waitForWinnerInquiry,
  hmacDigest, // exported for direct unit testing only (see tests/housingRequests.test.js's HMAC describe block) - never used elsewhere to reconstruct/reverse a stored key
  POLL_INTERVAL_MS,
  POLL_MAX_ATTEMPTS,
};
