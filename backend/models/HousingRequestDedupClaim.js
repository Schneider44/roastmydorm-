const mongoose = require('mongoose');

/**
 * A short-lived, database-enforced mutual-exclusion claim - the actual
 * atomicity guarantee behind "one inquiry per (listing, identity) per
 * duplicate window." See services/housingRequestDedupClaim.js for the
 * acquire/takeover/recovery algorithm built on top of this schema.
 *
 * Two distinct claim shapes, deliberately NOT unified into one
 * `identityKey` string (that was the previous, incorrect design - see the
 * fix note below):
 *
 *  - AUTHENTICATED: `authIdentityKey` set, guest fields null. One unique
 *    partial index. Simple 1:1 identity, no OR semantics needed.
 *
 *  - GUEST: BOTH `guestEmailIdentityKey` AND `guestPhoneIdentityKey` set
 *    on the SAME document, each with its OWN unique partial index. This
 *    is what makes "same email OR same phone" a real, atomically-
 *    enforced conflict: a single `create()` call is checked against BOTH
 *    unique indexes as one atomic operation, so a new guest claim whose
 *    email matches an existing claim's email (even with a totally
 *    different phone), OR whose phone matches an existing claim's phone
 *    (even with a totally different email), fails with E11000 either
 *    way - MongoDB doesn't need the caller to know which field
 *    conflicted, only that the insert as a whole was rejected.
 *
 *    FIX NOTE: the previous design used one combined key
 *    `guest:<listing>:<email>|<phone>` - an AND, not an OR. Two guest
 *    submissions sharing only the email (different phone) or only the
 *    phone (different email) produced two different combined keys and
 *    were never caught. This schema replaces that with true OR semantics
 *    at the database level.
 *
 * `expiresAt` is checked EXPLICITLY in every query that matters - the TTL
 * index below is cleanup-only, never the correctness mechanism (MongoDB's
 * TTL sweep runs on its own ~60s cadence and can lag well past the
 * nominal expiry).
 */
const housingRequestDedupClaimSchema = new mongoose.Schema({
  kind: { type: String, enum: ['auth', 'guest'], required: true },

  // "auth:<listingId>:<studentId>" - authenticated claims only.
  authIdentityKey: { type: String, default: null },

  // Guest claims only - BOTH always set together (never just one), so a
  // conflict on either field blocks the whole insert. See
  // buildGuestIdentityKeys() in the service layer.
  guestEmailIdentityKey: { type: String, default: null },
  guestPhoneIdentityKey: { type: String, default: null },

  inquiryId: { type: mongoose.Schema.Types.ObjectId, ref: 'DormInquiry', default: null },
  // pending: claimed, inquiry not yet created/attached.
  // attached: the winner successfully created its inquiry and recorded
  //           the id here - concurrent losers adopt this inquiryId.
  // failed: the winner's own inquiry creation threw - immediately
  //         takeover-eligible, no need to wait out the rest of the window.
  status: { type: String, enum: ['pending', 'attached', 'failed'], default: 'pending' },
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true },
}, { autoIndex: false });

// Three MANDATORY correctness indexes - not optional/deferred performance
// indexes (see the final report's "Claim index report" section for the
// full breakdown of each). All three are wired into server.js's
// ensureCriticalIndexes() and tests/dormInquiryTestApp.js's test-app
// bootstrap, exactly like DormInquiry's own required indexes.
housingRequestDedupClaimSchema.index(
  { authIdentityKey: 1 },
  { unique: true, partialFilterExpression: { authIdentityKey: { $type: 'string' } } }
);
housingRequestDedupClaimSchema.index(
  { guestEmailIdentityKey: 1 },
  { unique: true, partialFilterExpression: { guestEmailIdentityKey: { $type: 'string' } } }
);
housingRequestDedupClaimSchema.index(
  { guestPhoneIdentityKey: 1 },
  { unique: true, partialFilterExpression: { guestPhoneIdentityKey: { $type: 'string' } } }
);
// Cleanup-only TTL (see the file-header note above) - not required for
// correctness, purely keeps the collection from growing unbounded.
housingRequestDedupClaimSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('HousingRequestDedupClaim', housingRequestDedupClaimSchema);
