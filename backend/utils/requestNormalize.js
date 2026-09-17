/**
 * Shared normalization for a housing request's guest identity - used by
 * BOTH the rate limiter's key generator and the duplicate-submission check
 * in routes/housingRequests.js, so the two can never silently disagree
 * about what counts as "the same person." Also the exact function that
 * computes requester.normalizedPhone at write time (models/DormInquiry.js).
 *
 * Deliberately no external phone-parsing library - this is a best-effort
 * normalization (digits-only, country code merged in, leading local-format
 * zero stripped), not full E.164 validation. Good enough to recognize
 * "+212 6 12 34 56 78", "0612345678" and "212612345678" as the same
 * number when a country code is present or inferable; NOT a guarantee
 * against a determined attacker using genuinely different-looking contact
 * details to evade both rate limiting and dedup - that's a data-quality
 * tool, not a security boundary standing alone (the honeypot, per-identity
 * rate cap, and short dedup window layer on top of it for that).
 */

/** Trim + lowercase. Empty/non-string input normalizes to ''. */
function normalizeEmail(email) {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

/**
 * Digits-only phone, country code merged in. A leading '0' in the local
 * number is dropped when a country code is present (the standard Moroccan
 * "0X" local-dialing prefix that's redundant once the country code is
 * added) so "+212 612345678" and "0612345678" normalize to the same value.
 */
function normalizePhone(phone, countryCode) {
  const digits = String(phone || '').replace(/\D/g, '');
  const cc = String(countryCode || '').replace(/\D/g, '');
  if (!digits) return '';
  let local = digits;
  if (cc && local.startsWith('0')) local = local.slice(1);
  return cc ? cc + local : local;
}

/**
 * Bounds and validates a client-supplied `sourcePage` instead of storing
 * arbitrary input: must be a same-site relative path (starts with '/',
 * no protocol/host, no whitespace/control characters), capped at 300
 * characters. Anything else - an absolute URL, a javascript: scheme, a
 * wildly long string, or simply not a string - normalizes to ''.
 */
function normalizeSourcePage(value) {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim().slice(0, 300);
  // A leading '//' is a protocol-relative URL (browsers resolve it to
  // "same scheme, different host") - rejected explicitly, since the
  // general pattern below would otherwise accept it as "starts with /".
  if (trimmed.startsWith('//')) return '';
  if (!/^\/[a-zA-Z0-9\-_/.?=&]*$/.test(trimmed)) return '';
  return trimmed;
}

module.exports = { normalizeEmail, normalizePhone, normalizeSourcePage };
