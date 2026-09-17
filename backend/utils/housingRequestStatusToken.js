/**
 * Short-lived, single-purpose tokens for a GUEST's housing-request status
 * page (frontend/housing-request-status.html) - the admin-mediated flow's
 * equivalent of utils/followUpToken.js. An authenticated student instead
 * uses their normal session (see routes/housingRequests.js's dual-auth
 * resolver) - this token exists only because a guest has no account to
 * hold a session for.
 *
 * Same jti-hash-storage pattern as utils/landlordOutcomeToken.js: a random
 * jti is generated at issue time, only its HASH is persisted
 * (DormInquiry.statusToken.jtiHash), and verification requires the
 * presented token's jti to hash-match what's currently stored - so
 * revoking access (statusToken.revokedAt, or simply re-issuing a fresh
 * token which overwrites jtiHash) invalidates every previously-issued
 * token immediately. Deliberately NOT single-use on successful read (a
 * guest must be able to reload their status page repeatedly) - only
 * `revokedAt` and `expiresAt` end its validity, never a "consumed" flag.
 */
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const STATUS_TOKEN_TTL_DAYS = 30;
const STATUS_TOKEN_TTL = `${STATUS_TOKEN_TTL_DAYS}d`;

function hashJti(jti) {
  return crypto.createHash('sha256').update(String(jti || '')).digest('hex');
}

function generateJti() {
  return crypto.randomBytes(16).toString('hex');
}

/** Returns { token, jti, jtiHash, expiresAt } - caller persists jtiHash+expiresAt, embeds token in the email, discards jti. */
function issueHousingRequestStatusToken(inquiryId, reference) {
  const jti = generateJti();
  const token = jwt.sign(
    { inquiryId: String(inquiryId), reference, jti, purpose: 'housing_request_status' },
    process.env.JWT_SECRET,
    { expiresIn: STATUS_TOKEN_TTL }
  );
  const expiresAt = new Date(Date.now() + STATUS_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
  return { token, jti, jtiHash: hashJti(jti), expiresAt };
}

/**
 * Returns the verified payload if `token` is valid, unexpired, matches
 * `expectedInquiryId`, and its jti hashes to `currentJtiHash` - otherwise
 * null. Never throws. Callers must additionally check
 * statusToken.revokedAt/expiresAt themselves (this only verifies the JWT's
 * own signature/expiry and the jti binding, not the DB-side revocation
 * state, since that requires a document the caller already has).
 */
function verifyHousingRequestStatusToken(token, expectedInquiryId, currentJtiHash) {
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (payload.purpose !== 'housing_request_status') return null;
    if (String(payload.inquiryId) !== String(expectedInquiryId)) return null;
    if (!payload.jti || !currentJtiHash || hashJti(payload.jti) !== currentJtiHash) return null;
    return payload;
  } catch {
    return null;
  }
}

module.exports = { issueHousingRequestStatusToken, verifyHousingRequestStatusToken, hashJti };
