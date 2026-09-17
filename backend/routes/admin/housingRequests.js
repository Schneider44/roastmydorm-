const express = require('express');
const router = express.Router();
const DormInquiry = require('../../models/DormInquiry');
const { logAdminAction } = require('../../middleware/admin');
const { dispatchNotification } = require('../../services/notificationOutbox');

// All routes here are already protected by auth + isAdmin (applied in
// admin/index.js), matching every other admin sub-router.
//
// "Demandes de logement" - the admin-mediated flow's admin workflow.
// Deliberately a SEPARATE router from admin/dormInquiries.js (the legacy
// direct-contact admin page) - different data shape, different state
// machine, different actions. Every route here operates ONLY on
// flowType:'admin_mediated' documents.

/**
 * @route GET /api/admin/housing-requests
 * @desc  List + filter + paginate - admin view (toAdminMediationView()'s
 *        explicit allowlist, never a raw document).
 */
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 25, mediationStatus, city, university, search, from, to } = req.query;
    const query = { flowType: 'admin_mediated' };
    if (mediationStatus && mediationStatus !== 'all') query.mediationStatus = mediationStatus;
    // The city filter is a closed-set dropdown (Rabat/Casablanca/
    // Marrakech - frontend/admin-dashboard.html's #hr-city-filter), never
    // free text - an exact match against the normalized field is both
    // correct and (unlike the unanchored regex this replaces) indexable.
    // Fuzzy matching stays exclusively in `search` below, which is
    // deliberately free text and deliberately still a regex.
    if (city) query['listingSnapshot.cityNormalized'] = String(city).trim().toLowerCase();
    if (university) query['requester.university'] = { $regex: university, $options: 'i' };
    if (from || to) {
      query.createdAt = {};
      if (from) query.createdAt.$gte = new Date(from);
      if (to) query.createdAt.$lte = new Date(to);
    }
    if (search) {
      query.$or = [
        { uniqueReference: { $regex: search, $options: 'i' } },
        { 'listingSnapshot.title': { $regex: search, $options: 'i' } },
        { 'requester.name': { $regex: search, $options: 'i' } },
        { 'requester.email': { $regex: search, $options: 'i' } },
      ];
    }

    const [items, total] = await Promise.all([
      DormInquiry.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(parseInt(limit, 10)),
      DormInquiry.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: {
        items: items.map((i) => i.toAdminMediationView()),
        pagination: { total, page: parseInt(page, 10), pages: Math.ceil(total / limit), limit: parseInt(limit, 10) },
      },
    });
  } catch (error) {
    console.error('Get housing requests error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch housing requests' });
  }
});

/** @route GET /api/admin/housing-requests/stats */
router.get('/stats', async (req, res) => {
  try {
    const base = { flowType: 'admin_mediated' };
    // "Needs attention" = failed, OR still 'pending' (never even attempted
    // yet - the item 2 gap this closes), OR stuck 'sending' past the
    // outbox's own staleness threshold. Deliberately broader than just
    // 'failed' so a saved request whose notification never got a chance
    // to run (no second touch ever arrived) is still surfaced here, not
    // silently invisible - the admin's retry button (see
    // POST /:id/retry-notification) acts on exactly this same set.
    const { STALE_CLAIM_MS } = require('../../services/notificationOutbox');
    const staleBefore = new Date(Date.now() - STALE_CLAIM_MS);
    const [total, byStatus, notifyNeedsAttention] = await Promise.all([
      DormInquiry.countDocuments(base),
      DormInquiry.aggregate([{ $match: base }, { $group: { _id: '$mediationStatus', count: { $sum: 1 } } }]),
      DormInquiry.countDocuments({
        ...base,
        $or: [
          { mediationNotifications: { $elemMatch: { status: 'failed' } } },
          { mediationNotifications: { $elemMatch: { status: 'pending' } } },
          { mediationNotifications: { $elemMatch: { status: 'sending', lastAttemptedAt: { $lt: staleBefore } } } },
        ],
      }),
    ]);
    const counts = {};
    byStatus.forEach((row) => { counts[row._id] = row.count; });
    res.json({ success: true, data: { total, byStatus: counts, notificationsFailed: notifyNeedsAttention } });
  } catch (error) {
    console.error('Get housing request stats error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch stats' });
  }
});

/** @route GET /api/admin/housing-requests/:id */
router.get('/:id', async (req, res) => {
  try {
    const inquiry = await DormInquiry.findOne({ _id: req.params.id, flowType: 'admin_mediated' });
    if (!inquiry) return res.status(404).json({ success: false, message: 'Demande introuvable.' });
    res.json({ success: true, data: inquiry.toAdminMediationView() });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch housing request' });
  }
});

/**
 * @route PATCH /api/admin/housing-requests/:id/mediation-status
 * @desc  The admin's day-to-day pipeline actions:
 *        reviewing | checking_availability | available | unavailable |
 *        reserved | landlord_unreachable.
 *        'available' is a CHAINED action per the spec: marking a listing
 *        available immediately also moves the request into
 *        'awaiting_student_consent' and emails the student asking for
 *        consent - both transitions are individually validated/logged (not
 *        merged into one fake transition), so the audit trail still shows
 *        two real steps.
 *        'closed'/'handoff_sent' are NOT reachable through this route -
 *        closed requires a closureReason (see the dedicated close action
 *        below); handoff_sent is only ever reached through the student's
 *        own consent action (routes/housingRequests.js), never by admin
 *        fiat.
 */
router.patch('/:id/mediation-status', logAdminAction('housing_request_mediation_status_update', 'dorm_inquiry'), async (req, res) => {
  try {
    const { mediationStatus } = req.body || {};
    const ADMIN_ALLOWED = ['reviewing', 'checking_availability', 'available', 'unavailable', 'reserved', 'landlord_unreachable'];
    if (!ADMIN_ALLOWED.includes(mediationStatus)) {
      return res.status(400).json({ success: false, message: 'Statut invalide pour cette action.' });
    }

    const inquiry = await DormInquiry.findOne({ _id: req.params.id, flowType: 'admin_mediated' });
    if (!inquiry) return res.status(404).json({ success: false, message: 'Demande introuvable.' });

    req.previousState = { mediationStatus: inquiry.mediationStatus };

    try {
      inquiry.applyMediationTransition(mediationStatus, { actor: 'admin', actorId: req.user._id, event: `admin_set_${mediationStatus}` });
    } catch (err) {
      if (err.code) return res.status(409).json({ success: false, message: err.message, code: err.code });
      throw err;
    }

    // The notification kind that corresponds to each admin-facing status -
    // 'reviewing'/'checking_availability' send nothing (matches prior
    // behavior).
    const KIND_BY_STATUS = {
      available: 'student_available',
      unavailable: 'student_unavailable',
      reserved: 'student_reserved',
      landlord_unreachable: 'student_unreachable',
    };

    if (mediationStatus === 'available') {
      // Chained second transition - see the route comment above.
      inquiry.applyMediationTransition('awaiting_student_consent', { actor: 'admin', actorId: req.user._id, event: 'admin_requested_consent' });
    }
    await inquiry.save();

    // Durable, awaited BEFORE the response - see routes/housingRequests.js's
    // creation-route comment and services/notificationOutbox.js for the
    // full rationale. A delivery failure is recorded but never turns this
    // PATCH into an error response - the status transition itself already
    // succeeded and must not be rolled back by an unrelated email failure.
    const kind = KIND_BY_STATUS[mediationStatus];
    if (kind) {
      try {
        // No ctx needed - none of these 4 kinds read anything from it;
        // student_available mints its own guest token internally, only
        // when it actually sends (see notificationOutbox.js's
        // mintGuestTokenIfNeeded).
        await dispatchNotification(inquiry._id, kind);
      } catch { /* dispatchNotification itself never throws for a send failure - this guards only the unexpected */ }
    }

    const fresh = await DormInquiry.findById(inquiry._id);
    res.json({ success: true, data: fresh.toAdminMediationView() });
  } catch (error) {
    console.error('Update mediation status error:', error);
    res.status(500).json({ success: false, message: 'Failed to update mediation status' });
  }
});

/** @route PATCH /api/admin/housing-requests/:id/close - requires a valid closureReason. */
router.patch('/:id/close', logAdminAction('housing_request_close', 'dorm_inquiry'), async (req, res) => {
  try {
    const { closureReason } = req.body || {};
    const inquiry = await DormInquiry.findOne({ _id: req.params.id, flowType: 'admin_mediated' });
    if (!inquiry) return res.status(404).json({ success: false, message: 'Demande introuvable.' });

    req.previousState = { mediationStatus: inquiry.mediationStatus };
    try {
      inquiry.applyMediationTransition('closed', { actor: 'admin', actorId: req.user._id, event: 'admin_closed', closureReason });
    } catch (err) {
      if (err.code) return res.status(409).json({ success: false, message: err.message, code: err.code });
      throw err;
    }
    await inquiry.save();
    res.json({ success: true, data: inquiry.toAdminMediationView() });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to close request' });
  }
});

/** @route PATCH /api/admin/housing-requests/:id/correct - restricted correction targets, requires a reason. */
router.patch('/:id/correct', logAdminAction('housing_request_status_correct', 'dorm_inquiry'), async (req, res) => {
  try {
    const { mediationStatus, reason, closureReason } = req.body || {};
    const inquiry = await DormInquiry.findOne({ _id: req.params.id, flowType: 'admin_mediated' });
    if (!inquiry) return res.status(404).json({ success: false, message: 'Demande introuvable.' });

    req.previousState = { mediationStatus: inquiry.mediationStatus };
    try {
      inquiry.correctMediationStatus(mediationStatus, req.user._id, reason, { closureReason });
    } catch (err) {
      if (err.code) return res.status(400).json({ success: false, message: err.message, code: err.code });
      throw err;
    }
    await inquiry.save();
    res.json({ success: true, data: inquiry.toAdminMediationView() });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to correct status' });
  }
});

/** @route POST /api/admin/housing-requests/:id/notes */
router.post('/:id/notes', logAdminAction('housing_request_note_added', 'dorm_inquiry'), async (req, res) => {
  try {
    const { text } = req.body || {};
    if (!text || !String(text).trim()) return res.status(400).json({ success: false, message: 'Note vide.' });
    const inquiry = await DormInquiry.findOne({ _id: req.params.id, flowType: 'admin_mediated' });
    if (!inquiry) return res.status(404).json({ success: false, message: 'Demande introuvable.' });
    inquiry.adminNotes.push({ text: String(text).trim().slice(0, 2000), actorId: req.user._id, createdAt: new Date() });
    await inquiry.save();
    res.json({ success: true, data: inquiry.toAdminMediationView() });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to add note' });
  }
});

/**
 * @route POST /api/admin/housing-requests/:id/retry-notification
 * @desc  Re-attempts every notification currently in 'failed' state on this
 *        inquiry, through the same durable claim/dispatch path as every
 *        other send (see services/notificationOutbox.js) - never a
 *        duplicate of an already-'sent' notification, and safe if clicked
 *        twice concurrently (the second click's claim simply matches
 *        nothing once the first is 'sending').
 */
router.post('/:id/retry-notification', logAdminAction('housing_request_retry_notification', 'dorm_inquiry'), async (req, res) => {
  try {
    const inquiry = await DormInquiry.findOne({ _id: req.params.id, flowType: 'admin_mediated' });
    if (!inquiry) return res.status(404).json({ success: false, message: 'Demande introuvable.' });

    // Retries every entry that ISN'T already 'sent' or genuinely still
    // in-flight - not just 'failed'. This is the manual-recovery path for
    // a notification that never got a chance to be attempted at all: an
    // inquiry adopted after a crash normally gets its pending
    // notifications processed automatically the next time ANY request
    // touches it (see routes/housingRequests.js's unconditional dispatch
    // on every create/adopt), but if no such request ever arrives, this
    // button is the deliberate, explicit fallback an admin can always
    // reach for - never a new automatic/background scheduler, per project
    // policy. 'sending' is only included when stale (older than the
    // outbox's own STALE_CLAIM_MS) - a genuinely in-flight attempt from
    // moments ago is left alone.
    const { STALE_CLAIM_MS } = require('../../services/notificationOutbox');
    const staleBefore = new Date(Date.now() - STALE_CLAIM_MS);
    const retryableKinds = (inquiry.mediationNotifications || [])
      .filter((n) => n.status === 'failed' || n.status === 'pending' || (n.status === 'sending' && n.lastAttemptedAt && n.lastAttemptedAt < staleBefore))
      .map((n) => n.kind);

    for (const kind of retryableKinds) {
      try {
        // No guestToken passed - the relevant senders mint their own,
        // internally, only when they actually send (see
        // notificationOutbox.js's mintGuestTokenIfNeeded).
        await dispatchNotification(inquiry._id, kind, { adminEmail: process.env.ADMIN_INQUIRY_EMAIL });
      } catch { /* dispatchNotification itself never throws for a send failure - this guards only the unexpected */ }
    }

    const fresh = await DormInquiry.findById(inquiry._id);
    res.json({ success: true, data: fresh.toAdminMediationView() });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to retry notification' });
  }
});

module.exports = router;
