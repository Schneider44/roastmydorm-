/**
 * Short-lived, single-purpose tokens for admin listing previews.
 *
 * Opening /logement/:slug in a new tab does not carry the admin's normal
 * Authorization header, so draft preview can't rely on the regular JWT
 * session. Instead the admin dashboard requests one of these (scoped to a
 * single dorm, 10-minute expiry) and appends it as ?preview=<token> to the
 * preview URL. Reuses the existing JWT_SECRET rather than inventing a
 * separate signing key/store.
 */
const jwt = require('jsonwebtoken');

const PREVIEW_TOKEN_TTL = '10m';

function issuePreviewToken(dormId) {
  return jwt.sign(
    { dormId: String(dormId), purpose: 'dorm_preview' },
    process.env.JWT_SECRET,
    { expiresIn: PREVIEW_TOKEN_TTL }
  );
}

/** Returns the dormId the token is valid for, or null if invalid/expired/wrong-purpose. */
function verifyPreviewToken(token, expectedDormId) {
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (payload.purpose !== 'dorm_preview') return null;
    if (String(payload.dormId) !== String(expectedDormId)) return null;
    return payload.dormId;
  } catch {
    return null;
  }
}

module.exports = { issuePreviewToken, verifyPreviewToken };
