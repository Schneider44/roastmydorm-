const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const rateLimit = require('express-rate-limit');
const Dorm = require('../models/Dorm');
const DormInquiry = require('../models/DormInquiry');
const { Counter, getNextSequence } = require('../models/Counter');
const { auth, optionalAuth } = require('../middleware/auth');
const { asyncHandler, errors } = require('../utils/helpers');
const { verifyPreviewToken } = require('../utils/previewToken');
const { normalizeEmail, normalizePhone, normalizeSourcePage } = require('../utils/requestNormalize');
const { verifyHousingRequestStatusToken } = require('../utils/housingRequestStatusToken');
const { recordSharingConsent, sendHandoff } = require('../services/dormHandoff');
const { dispatchNotification } = require('../services/notificationOutbox');
const { acquireAuthClaim, acquireGuestClaim, attachInquiry, releaseFailedClaim, waitForWinnerInquiry } = require('../services/housingRequestDedupClaim');

/**
 * POST /api/housing-requests - the new admin-mediated flow's ONLY creation
 * entry point. Deliberately a separate route/contract from
 * POST /api/dorm-inquiries (routes/dormInquiries.js) rather than an added
 * branch inside it: that endpoint's whole contract is "create a tracked
 * inquiry, then reveal landlord contact so the frontend can open
 * wa.me/tel:/mailto:" - the new flow must NEVER do that, and layering a
 * "don't reveal contact this time" flag onto the same response shape would
 * leave a permanent foot-gun (one missed `if` and landlord PII leaks again)
 * instead of a response shape that structurally cannot contain it. The
 * legacy endpoint is untouched and keeps working exactly as before for any
 * page not yet cut over.
 *
 * Every row this creates has flowType='admin_mediated' - never anything
 * else, never taken from the request body (see the explicit `flowType`
 * immutable field on the model). mediationStatus always starts at 'new'.
 */

const PREFERRED_CONTACT_METHODS = ['whatsapp', 'email', 'phone'];
const MAX_MESSAGE_LENGTH = 500;
const CONSENT_VERSION = '2026-09-housing-request-v1';

/**
 * Keyed by IDENTITY, not IP - same root-cause fix as
 * middleware/rateLimiters.js's keyByUser (see that file's header comment):
 * an IP-only key means a shared university/residence wifi or carrier NAT
 * can make one student's traffic block every other real student behind the
 * same address.
 *
 *  - Authenticated: 'user:<userId>' ONLY - no IP component at all, so a
 *    student on campus wifi never shares a bucket with anyone else on that
 *    same network, exactly matching contactInquiryLimiter's existing
 *    precedent for the legacy endpoint.
 *  - Guest: 'guest:<ip>:<normalizedEmail>:<normalizedPhone>' - IP is still
 *    ONE of three components (not the sole key), so a guest is only
 *    grouped with genuinely-the-same submitter (same network AND same
 *    contact details), never with an unrelated guest who happens to share
 *    a network. Falls back to 'noemail'/'nophone' placeholders when a
 *    field is missing/invalid so the key is always defined even before
 *    body validation runs (this middleware executes before the validation
 *    block below).
 */
function housingRequestKey(req) {
  if (req.user) return `user:${req.user._id.toString()}`;
  const body = req.body || {};
  const email = normalizeEmail(body.email) || 'noemail';
  const phone = normalizePhone(body.phone, body.phoneCountryCode) || 'nophone';
  return `guest:${req.ip}:${email}:${phone}`;
}

// 10/hour per identity - generous for a real student's browsing session
// (a handful of listings they're genuinely interested in) while bounding a
// scripted flood from either an authenticated account or a guest identity.
const housingRequestLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: housingRequestKey,
  message: { success: false, error: 'RATE_LIMITED', message: 'Trop de demandes. Réessaie dans quelques instants.' },
  skip: () => process.env.NODE_ENV === 'test',
});

// A repeated submission for the same (requester, listing) within this
// window returns the already-created request instead of making a second
// one - covers a double-click or a resubmit after a slow network response,
// same rationale as DUPLICATE_WINDOW_MS in routes/dormInquiries.js.
const DUPLICATE_WINDOW_MS = 2 * 60 * 1000;

function isNonEmptyString(v, maxLen = 500) {
  return typeof v === 'string' && v.trim().length > 0 && v.length <= maxLen;
}

function isValidEmail(v) {
  return typeof v === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) && v.length <= 254;
}

/**
 * Builds the server-resolved listing snapshot. The ONLY source for
 * title/image/city/neighborhood/price/reference is the Dorm document just
 * fetched by listingId - nothing from req.body ever reaches this object,
 * even if the client sent a `listingSnapshot` or individual
 * title/price/image fields (those keys are simply never read from req.body
 * anywhere in this file).
 */
function buildListingSnapshot(dorm) {
  const images = dorm.images || [];
  const cover = images.find((i) => i && i.isPrimary) || images[0];
  const addr = (dorm.location && dorm.location.address) || {};
  return {
    title: dorm.name || '',
    image: cover ? cover.url : '',
    city: addr.city || '',
    // Normalized (trimmed + lowercased) at write time, once - the
    // structured admin city filter matches this field exactly, never a
    // regex against the display-cased `city` above. Same normalize-once-
    // at-write policy already used for requester.normalizedPhone.
    cityNormalized: (addr.city || '').trim().toLowerCase(),
    neighborhood: addr.neighborhood || '',
    price: (dorm.pricing && dorm.pricing.baseRent) || null,
    reference: dorm.slug || '',
  };
}

/**
 * Builds a fake-but-plausible reference for the honeypot response - reads
 * the CURRENT sequence value without incrementing it (a plain read, not
 * getNextSequence()), then adds a small random offset in the same
 * magnitude range real references are currently in. A bot comparing
 * "RMD-1842" (real) against a fake cannot tell them apart by format or
 * magnitude the way it trivially could against, say, a millisecond
 * timestamp. Never touches the real counter document, so the next genuine
 * request's reference is completely unaffected by however many honeypot
 * hits occurred in between.
 */
async function fakeHoneypotReference() {
  const counter = await Counter.findById('dormInquiry').lean();
  const base = (counter && counter.seq) || Math.floor(Math.random() * 50);
  const fakeSeq = base + 1 + Math.floor(Math.random() * 50);
  return `RMD-${fakeSeq}`;
}

router.post('/', optionalAuth, housingRequestLimiter, asyncHandler(async (req, res) => {
  const body = req.body || {};

  // ── Honeypot ─────────────────────────────────────────────────────────
  // A hidden field real students never see or fill; a bot filling every
  // field in a scraped form will fill this too. Returns the exact same
  // response shape as a real success (never a 4xx, never any hint that
  // detection occurred) and never writes to the database or consumes the
  // real reference counter.
  if (isNonEmptyString(body.website)) {
    return res.status(201).json({ success: true, data: { reference: await fakeHoneypotReference(), mediationStatus: 'new', deduped: false, createdAt: new Date() } });
  }

  // ── Listing resolution - server-side ONLY, never trust client fields ──
  const { listingId, preview } = body;
  if (!listingId || !mongoose.isValidObjectId(listingId)) {
    throw errors.badRequest('Identifiant de logement invalide.');
  }
  const dorm = await Dorm.findById(listingId);
  if (!dorm) {
    throw errors.notFound('Logement');
  }
  if (dorm.status !== 'published') {
    const previewedId = preview ? verifyPreviewToken(preview, dorm._id) : null;
    if (!previewedId) {
      throw errors.notFound('Logement');
    }
  }

  // ── Requester identity ──────────────────────────────────────────────
  // Authenticated: userId comes ONLY from req.user (set by optionalAuth
  // from a verified JWT) - never from any body field. The student may
  // still correct/verify the name/email/phone shown, so those are read
  // from the body either way, just prefilled by the frontend from the
  // account.
  const isGuest = !req.user;

  const name = isNonEmptyString(body.name, 200) ? body.name.trim() : null;
  const email = isValidEmail(body.email) ? normalizeEmail(body.email) : null;
  const phoneCountryCode = isNonEmptyString(body.phoneCountryCode, 6) ? body.phoneCountryCode.trim() : '';
  const phoneDigits = typeof body.phone === 'string' ? body.phone.replace(/[^\d]/g, '') : '';
  const normalizedPhone = normalizePhone(body.phone, phoneCountryCode);
  const university = isNonEmptyString(body.university, 200) ? body.university.trim() : null;
  const preferredContactMethod = PREFERRED_CONTACT_METHODS.includes(body.preferredContactMethod)
    ? body.preferredContactMethod
    : null;
  const message = typeof body.message === 'string' ? body.message.slice(0, MAX_MESSAGE_LENGTH).trim() : '';
  const consentGiven = body.consent === true;

  if (!name) throw errors.badRequest('Le nom complet est requis.');
  if (!email) throw errors.badRequest('Une adresse e-mail valide est requise.');
  if (!phoneDigits || phoneDigits.length < 6 || phoneDigits.length > 15) {
    throw errors.badRequest('Un numéro de téléphone valide est requis.');
  }
  if (!university) throw errors.badRequest("L'université ou l'école est requise.");
  if (!preferredContactMethod) throw errors.badRequest('Le moyen de contact préféré est invalide.');
  if (!consentGiven) throw errors.badRequest('Le consentement au traitement de la demande est requis.');
  if (typeof body.message === 'string' && body.message.length > MAX_MESSAGE_LENGTH) {
    throw errors.badRequest(`Le message ne peut pas dépasser ${MAX_MESSAGE_LENGTH} caractères.`);
  }

  // ── Duplicate-click protection ──────────────────────────────────────
  // Two layers, deliberately different in nature:
  //
  //  1. A client-supplied Idempotency-Key (optional, additional defense
  //     only - see below): the widget mints one random key when the form
  //     is opened and resends the SAME key on any retry of that same
  //     submission (a double-click, a network-retry after a slow
  //     response). A repeat with a previously-succeeded key returns that
  //     exact prior result immediately, without touching the claim
  //     mechanism at all. This is a plain (non-unique-indexed) lookup -
  //     it is a fast, best-effort optimization, never the thing this
  //     endpoint relies on for correctness (a missing/reused/forged key
  //     changes nothing about the guarantee below).
  //  2. services/housingRequestDedupClaim.js - the actual database-
  //     enforced guarantee, for the identity that matters:
  //       - Authenticated: listing + student id (unambiguous, no
  //         normalization needed).
  //       - Guest: listing + normalized email OR normalized phone - a
  //         REAL atomically-enforced OR (see that model's own comment for
  //         why this needs two separately unique-indexed fields on one
  //         claim document, not one combined key). The dedupeMatch read
  //         below is a separate, non-atomic fast path covering the exact
  //         same "email OR phone" shape as a quick pre-check before ever
  //         touching the claim collection - the claim is what actually
  //         enforces it under real concurrency.
  const idempotencyKey = isNonEmptyString(body.idempotencyKey, 100) ? body.idempotencyKey.trim() : null;
  if (idempotencyKey) {
    const priorByKey = await DormInquiry.findOne({ flowType: 'admin_mediated', idempotencyKey });
    if (priorByKey) {
      return res.status(200).json({
        success: true,
        data: { reference: priorByKey.uniqueReference, mediationStatus: priorByKey.mediationStatus, deduped: true, createdAt: priorByKey.createdAt },
      });
    }
  }

  const dedupeMatch = {
    flowType: 'admin_mediated',
    listing: dorm._id,
    createdAt: { $gte: new Date(Date.now() - DUPLICATE_WINDOW_MS) },
  };
  if (req.user) {
    dedupeMatch.student = req.user._id;
  } else {
    const identityOr = [];
    if (email) identityOr.push({ 'requester.email': email });
    if (normalizedPhone) identityOr.push({ 'requester.normalizedPhone': normalizedPhone });
    if (identityOr.length) dedupeMatch.$or = identityOr;
  }
  const recentMatch = (req.user || dedupeMatch.$or)
    ? await DormInquiry.findOne(dedupeMatch).sort({ createdAt: -1 })
    : null;

  let inquiry = recentMatch;
  let created = false;

  if (!inquiry) {
    const claimResult = req.user
      ? await acquireAuthClaim(dorm._id.toString(), req.user._id.toString(), DUPLICATE_WINDOW_MS)
      : await acquireGuestClaim(dorm._id.toString(), email, normalizedPhone, DUPLICATE_WINDOW_MS);
    const claimKeys = req.user
      ? { authIdentityKey: claimResult.authIdentityKey }
      : { emailKey: claimResult.emailKey, phoneKey: claimResult.phoneKey };

    if (claimResult.won) {
      try {
        const seq = await getNextSequence('dormInquiry');
        inquiry = await DormInquiry.create({
          flowType: 'admin_mediated',
          mediationStatus: 'new',
          student: req.user ? req.user._id : undefined,
          listing: dorm._id,
          uniqueReference: `RMD-${seq}`,
          sourcePage: normalizeSourcePage(body.sourcePage),
          idempotencyKey,
          requester: {
            name,
            email,
            phoneCountryCode,
            phone: phoneDigits,
            normalizedPhone,
            university,
            preferredContactMethod,
            message,
            isGuest,
          },
          consent: {
            processingConsentVersion: CONSENT_VERSION,
            processingConsentAt: new Date(),
          },
          listingSnapshot: buildListingSnapshot(dorm),
          mediationHistory: [{
            event: 'request_created',
            actor: 'student',
            actorId: req.user ? req.user._id : null,
            meta: { isGuest },
            createdAt: new Date(),
          }],
        });
        // CRASH WINDOW: if this process dies between the create() above
        // succeeding and this attachInquiry() completing, the claim is
        // left 'pending' with no inquiryId, but the DormInquiry document
        // itself is real and fully saved (an "orphan" - not a partial
        // write, just an unrecorded link). See the recovery fallback
        // below the `else` branch, which is what actually resolves this
        // safely across processes - not a transaction, since this
        // project's MongoDB deployment (a single in-memory/standalone
        // instance in dev, matching the target Hostinger deployment) does
        // not run as a replica set and therefore has no multi-document
        // transaction support to rely on.
        await attachInquiry(claimResult.claim._id, inquiry._id);
        created = true;
      } catch (err) {
        await releaseFailedClaim(claimResult.claim._id);
        throw err;
      }
    } else {
      // Lost the race - wait for the winner to attach its inquiry.
      const winnerInquiryId = await waitForWinnerInquiry(claimKeys);
      if (winnerInquiryId) {
        inquiry = await DormInquiry.findById(winnerInquiryId);
        created = false;
      } else {
        // waitForWinnerInquiry returned null/undefined - the winner never
        // attached within our wait budget. Before giving up, check
        // whether the winner actually finished creating the inquiry and
        // merely crashed before recording the link (the exact crash
        // window described above) - if so, adopt that inquiry directly
        // rather than telling a real, already-served student to retry.
        // Uses the SAME best-effort dedupeMatch query as the fast-path
        // pre-check above, which is deliberately still valid here: an
        // orphaned inquiry is a real DormInquiry document that matches
        // this exact identity within the window, indistinguishable from
        // any other recent match.
        const orphan = await DormInquiry.findOne(dedupeMatch).sort({ createdAt: -1 });
        if (orphan) {
          inquiry = orphan;
          created = false;
        } else {
          // Genuinely nothing exists yet (the winner hasn't reached
          // create() at all, or this really was a vanishing-claim race) -
          // the honest response is "try again," never a fabricated
          // duplicate.
          return res.status(503).json({ success: false, error: 'RETRY', message: 'Réessaie dans quelques instants.' });
        }
      }
    }
  }

  // ── Notifications - durable, awaited BEFORE the response, for EVERY
  // returned inquiry (freshly created OR adopted - via the fast-path
  // recentMatch read, the normal winner lookup, or orphan recovery after
  // a crash). This is NOT gated on `created` - that was the actual gap:
  // an adopted inquiry can have notification entries still 'pending' (the
  // crashed process never got this far) or stuck 'sending' (it claimed
  // but died before recording a result), and nothing else will ever
  // process them if no further request happens to arrive. Re-running
  // dispatchNotification here is always safe to do unconditionally - its
  // atomic claim (services/notificationOutbox.js) makes an already-'sent'
  // or currently-'sending'-and-fresh entry a fast, cheap no-op, and a
  // genuinely 'pending' or stale-stuck entry gets correctly claimed and
  // sent exactly once even if the original crashed process and this
  // adopting request both reach this line. A guest status-token is minted
  // internally by the relevant senders only when they actually send (see
  // notificationOutbox.js's mintGuestTokenIfNeeded) - never wastefully on
  // a no-op adoption, which would otherwise invalidate an already-emailed
  // link for no reason.
  if (process.env.ADMIN_INQUIRY_EMAIL) {
    try {
      await dispatchNotification(inquiry._id, 'admin_alert', { adminEmail: process.env.ADMIN_INQUIRY_EMAIL });
    } catch { /* dispatchNotification itself never throws for a send failure - this guards only the unexpected */ }
  }
  try {
    await dispatchNotification(inquiry._id, 'student_received');
  } catch { /* see above */ }

  // ── Strict response allowlist ───────────────────────────────────────
  // Only ever these four fields - no landlord phone/whatsapp/email, no
  // internal Mongo _id, no listing/landlord identifiers. Deliberately
  // built as a fresh literal object here (never `inquiry.toObject()` or
  // any spread of the document) so a future field added to the schema can
  // never silently widen this response. createdAt is included because the
  // widget's own Step 2 render (housing-request-widget.js's renderStep2)
  // shows "Demande reçue" with this exact timestamp right after submit,
  // before any GET /:reference re-fetch - omitting it here produced a
  // real "Invalid Date" bug on the screen students see immediately after
  // submitting. It's already exposed identically via
  // toStudentMediationView() on every later view, so this adds no new
  // exposure, only consistency between the immediate and re-fetched view.
  res.status(created ? 201 : 200).json({
    success: true,
    data: {
      reference: inquiry.uniqueReference,
      mediationStatus: inquiry.mediationStatus,
      deduped: !created,
      createdAt: inquiry.createdAt,
    },
  });
}));

/**
 * GET /api/housing-requests/mine - an authenticated student's own
 * admin-mediated requests, newest first. Registered BEFORE
 * GET /:reference so Express never matches "mine" as a :reference value.
 * Guest requests are not returned here - a guest has no account to list
 * against; their only access path is the emailed status-link (see
 * GET /:reference's dual-auth below). Ownership is enforced in the query
 * itself (student: req.user._id), never filtered client-side afterward.
 * Uses toStudentMediationView() exclusively - the exact same serializer
 * the single-request view uses, so this list can never leak a field the
 * single view wouldn't already allow.
 */
router.get('/mine', auth, asyncHandler(async (req, res) => {
  res.set('Cache-Control', 'no-store');
  const inquiries = await DormInquiry.find({ flowType: 'admin_mediated', student: req.user._id })
    .sort({ createdAt: -1 })
    .limit(200);
  res.json({ success: true, data: inquiries.map((i) => i.toStudentMediationView()) });
}));

/**
 * GET /api/housing-requests/:reference - the student's own status view.
 * Dual-auth: an authenticated student session (must own the inquiry) OR a
 * guest status token (X-Housing-Request-Token header - never a query
 * string, so it never lands in server logs/Referer, mirroring the
 * landlord-token transport policy in routes/dormInquiries.js).
 */
router.get('/:reference', optionalAuth, asyncHandler(async (req, res) => {
  res.set('Cache-Control', 'no-store');
  const inquiry = await DormInquiry.findOne({ uniqueReference: req.params.reference, flowType: 'admin_mediated' });
  if (!inquiry) throw errors.notFound('Demande');

  const ownedBySession = req.user && inquiry.student && String(inquiry.student) === String(req.user._id);
  let ownedByToken = false;
  if (!ownedBySession) {
    const token = req.headers['x-housing-request-token'];
    if (token && inquiry.statusToken.jtiHash && !inquiry.statusToken.revokedAt
      && (!inquiry.statusToken.expiresAt || inquiry.statusToken.expiresAt > new Date())) {
      const payload = verifyHousingRequestStatusToken(token, inquiry._id, inquiry.statusToken.jtiHash);
      ownedByToken = !!payload;
    }
  }
  if (!ownedBySession && !ownedByToken) throw errors.notFound('Demande');

  res.json({ success: true, data: inquiry.toStudentMediationView() });
}));

/**
 * POST /api/housing-requests/:reference/consent - the SEPARATE sharing-
 * consent action (never the same click as processing consent, which
 * already happened at submission). Only legal when mediationStatus is
 * 'awaiting_student_consent'. Triggers the handoff attempt synchronously
 * (through services/dormHandoff.js's atomic guard) so the response can
 * honestly report whether the landlord was actually reached.
 */
router.post('/:reference/consent', optionalAuth, asyncHandler(async (req, res) => {
  res.set('Cache-Control', 'no-store');
  const inquiry = await DormInquiry.findOne({ uniqueReference: req.params.reference, flowType: 'admin_mediated' });
  if (!inquiry) throw errors.notFound('Demande');

  const ownedBySession = req.user && inquiry.student && String(inquiry.student) === String(req.user._id);
  let ownedByToken = false;
  if (!ownedBySession) {
    const token = req.headers['x-housing-request-token'];
    if (token && inquiry.statusToken.jtiHash && !inquiry.statusToken.revokedAt) {
      const payload = verifyHousingRequestStatusToken(token, inquiry._id, inquiry.statusToken.jtiHash);
      ownedByToken = !!payload;
    }
  }
  if (!ownedBySession && !ownedByToken) throw errors.notFound('Demande');

  if (req.body.consent !== true) throw errors.badRequest('Le consentement au partage est requis.');

  const consented = await recordSharingConsent(inquiry._id);
  if (!consented) {
    // Either already consented (idempotent no-op - return current state,
    // not an error) or not in the right mediationStatus to consent at all.
    const fresh = await DormInquiry.findById(inquiry._id);
    if (fresh.consent.sharingConsentAt) {
      return res.json({ success: true, data: fresh.toStudentMediationView() });
    }
    throw errors.conflict("Cette demande n'est pas en attente de votre accord.");
  }

  const result = await sendHandoff(inquiry._id, { adminEmail: process.env.ADMIN_INQUIRY_EMAIL });
  const fresh = await DormInquiry.findById(inquiry._id);
  res.json({ success: true, data: { ...fresh.toStudentMediationView(), handoffResult: result.sent ? 'sent' : result.reason } });
}));

module.exports = router;
// Exported for direct unit testing (housingRequestKey's IP/user/guest
// branching, and the honeypot reference generator's non-detectability) -
// see tests/housingRequests.test.js. Not used by any other route.
module.exports.housingRequestKey = housingRequestKey;
module.exports.fakeHoneypotReference = fakeHoneypotReference;
