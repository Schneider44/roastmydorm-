const mongoose = require('mongoose');

// ── Durable notification outbox (admin-mediated flow only) ───────────────
// One embedded entry per notification KIND (never re-queued as a new entry
// on retry - retried in place), tracked through a small state machine. See
// services/notificationOutbox.js for the atomic claim/dispatch logic that
// reads/writes these. An embedded array on the inquiry itself (not a
// separate outbox collection) is a deliberate scale call - see that file's
// header comment for why a collection isn't warranted yet.
const NOTIFICATION_KINDS = [
  'admin_alert',
  'student_received',
  'student_available',
  'student_unavailable',
  'student_reserved',
  'student_unreachable',
];
const NOTIFICATION_STATUSES = ['pending', 'sending', 'sent', 'failed'];

/**
 * DormInquiry - tracks a single "student initiates contact with a Dorm
 * listing's landlord" event end-to-end (contact-channel opened -> landlord
 * outcome), for the new admin-dashboard-created Dorm listings only.
 *
 * Deliberately a NEW model, not an extension of the pre-existing `Inquiry`
 * model (backend/models/Inquiry.js): that model is a static-listing lead-CRM
 * system (guest fullName/email/phone, studioId = a static-page slug, agent
 * assignment) with a completely different shape and purpose, and the old
 * PropertyRequest/legacy-page email inquiry flow must keep working exactly
 * as it does today. Keeping this separate means neither the old `Inquiry`
 * flow nor `POST /api/dorms/:id/contact` (the pre-existing anonymous
 * contact-reveal endpoint) has to change at all - see
 * backend/routes/dormInquiries.js for the new authenticated endpoint this
 * model backs.
 *
 * `listingTitle`/`listingCity`/`landlordName` are denormalized snapshots
 * taken at creation time - deliberate, so the admin table and a student's
 * own inquiry history keep reading correctly even if the listing is later
 * edited, unpublished, or deleted, without a populate() on every list call.
 */
const dormInquirySchema = new mongoose.Schema({
  // Required for every legacy_direct row (unchanged behavior). An
  // admin_mediated row leaves this null for a guest requester - identity
  // then lives entirely in `requester` below - and set to the real user id
  // for an authenticated one. The function form only enforces the
  // legacy-flow requirement; it deliberately never inspects `this` for
  // admin_mediated since flowType may not be set yet at validation time
  // for a brand-new document being built field-by-field.
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: function studentRequiredForLegacyFlow() {
      return this.flowType !== 'admin_mediated';
    },
  },
  listing: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Dorm',
    required: true,
  },
  // Only set when the Dorm has a real linked User account (Dorm.landlord).
  // Most admin-authored listings won't have one - see Dorm.js's contactInfo
  // comment - so this stays null for those, and admin follow-up is manual.
  landlord: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  landlordName: { type: String, default: '' },
  // Required for legacy_direct only - an admin_mediated row carries the
  // same information in listingSnapshot.title instead.
  listingTitle: {
    type: String,
    required: function listingTitleRequiredForLegacyFlow() { return this.flowType !== 'admin_mediated'; },
  },
  listingCity: { type: String, default: '' },

  // Required for legacy_direct only - an admin_mediated row's contact
  // channel preference lives in requester.preferredContactMethod instead
  // (no 'platform_form' concept in the new flow - the student never picks
  // a channel that opens a live wa.me/tel:/mailto: link).
  contactMethod: {
    type: String,
    required: function contactMethodRequiredForLegacyFlow() { return this.flowType !== 'admin_mediated'; },
    enum: ['whatsapp', 'phone', 'email', 'platform_form'],
  },

  status: {
    type: String,
    required: true,
    enum: [
      'initiated',
      'landlord_contacted',
      'landlord_replied',
      'viewing_scheduled',
      'rented',
      'unavailable',
      'closed',
    ],
    default: 'initiated',
  },

  uniqueReference: {
    type: String,
    required: true,
    unique: true,
  },

  studentMessage: { type: String, default: '' },

  // Where the contact action was initiated from - listing slug/path, for
  // admin traceability (which page/flow generated this lead).
  sourcePage: { type: String, default: '' },

  // Milestone flags, set once and never unset - used for funnel analytics
  // (see GET /api/admin/dorm-inquiries/stats) so a status that later moves
  // PAST a milestone (e.g. viewing_scheduled -> rented) still counts toward
  // that milestone, and a repeated click/status churn never double-counts.
  milestones: {
    landlordReplied: { type: Boolean, default: false },
    viewingScheduled: { type: Boolean, default: false },
    rented: { type: Boolean, default: false },
  },

  landlordRespondedAt: { type: Date, default: null },
  closedAt: { type: Date, default: null },

  // ── Rental-outcome tracking (dual-confirmation) ─────────────────────────
  // Deliberately INDEPENDENT of `status`/`milestones` above, not a rewrite
  // of them. `status` stays exactly as it was - the operational pipeline
  // stage a landlord or admin sets by hand - and `milestones.rented` keeps
  // its existing, weaker meaning ("someone at some point set status to
  // rented"). Neither of those is proof a rental actually happened: a
  // landlord alone can already set status='rented' via the existing PATCH,
  // and that must never be confused with a verified outcome. `outcomeStatus`
  // below is the actual source of truth for "is this listing really
  // rented," reachable only through validated transitions
  // (applyOutcomeTransition) and, for the confirmed state, only ever
  // reached when both parties independently agree or an admin manually
  // verifies - see reportRentedOutcome()/confirmRentedOutcome() below.
  outcomeStatus: {
    type: String,
    required: true,
    enum: [
      'contact_initiated',
      'landlord_responded',
      'visit_scheduled',
      'rental_reported',
      'rental_confirmed',
      'no_response',
      'not_rented',
      'listing_unavailable',
      'cancelled',
    ],
    default: 'contact_initiated',
  },

  // Each party's own current claim - overwritten on resubmission (this is
  // "what do they currently say," not an append-only log; the append-only
  // record lives in outcomeHistory below).
  studentOutcome: {
    type: String,
    enum: [null, 'rented', 'visit_scheduled', 'still_searching', 'listing_unavailable'],
    default: null,
  },
  studentRespondedAt: { type: Date, default: null },

  landlordOutcome: {
    type: String,
    enum: [null, 'available', 'reserved', 'rented', 'unavailable'],
    default: null,
  },
  // Distinct from the pre-existing `landlordRespondedAt` above, which is
  // tied to the legacy status==='landlord_replied' transition - conflating
  // the two would mix "replied to the student" with "reported an outcome."
  landlordOutcomeRespondedAt: { type: Date, default: null },

  // Set once, the first time outcomeStatus enters 'rental_reported'.
  rentalReportedAt: { type: Date, default: null },
  // Set once, the first time outcomeStatus enters 'rental_confirmed'. Never
  // overwritten afterward - this is the durable evidence of confirmation.
  rentalConfirmedAt: { type: Date, default: null },

  confirmedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  confirmationSource: {
    type: String,
    enum: [null, 'dual_report', 'admin_manual'],
    default: null,
  },

  // Follow-up automation bookkeeping. followUpDueAt/reminderDueAt are set
  // ONCE at creation time (createdAt + 3d / + 7d) - never recomputed later,
  // so a delayed or backed-up cron run can't drift the actual due time.
  followUpDueAt: { type: Date, default: null },
  reminderDueAt: { type: Date, default: null },
  followUpSentAt: { type: Date, default: null },
  reminderSentAt: { type: Date, default: null },
  followUpFailureCount: { type: Number, default: 0 },

  // Landlord outcome-request automation. UNLIKE the student fields above,
  // landlordFollowUpDueAt is NOT set at inquiry creation - it stays null
  // until the student actually reports 'rented' or 'listing_unavailable'
  // (see scheduleLandlordOutcomeRequest() in
  // services/landlordOutcomeResolver.js, called from the student outcome
  // route), since asking a landlord to confirm before the student has said
  // anything would mean emailing every landlord for every inquiry - exactly
  // what this feature must not do. Once set, this reuses the identical
  // due/sent/failure-count idempotency shape as the student fields, and is
  // processed by the same processDormFollowUps() batch/lock.
  landlordFollowUpDueAt: { type: Date, default: null },
  landlordFollowUpSentAt: { type: Date, default: null },
  landlordFollowUpFailureCount: { type: Number, default: 0 },

  // Single-use enforcement for the landlord response TOKEN specifically
  // (never for a session-authenticated landlord - see the policy note on
  // PATCH /:id/landlord-outcome). Only ever the HASH of the token's jti is
  // stored, never the token/jti itself - utils/landlordOutcomeToken.js.
  // Set once, at send time, alongside landlordFollowUpSentAt.
  landlordTokenJtiHash: { type: String, default: null },
  // Set the first time a TOKEN-authenticated (not session) PATCH
  // /:id/landlord-outcome succeeds. Once set, the same token is rejected on
  // any further attempt - see the route for the exact check.
  landlordTokenConsumedAt: { type: Date, default: null },

  // A coarse, non-sensitive BUCKET, never the raw error/provider response -
  // see services/dormFollowUpProcessor.js's categorizeLandlordSendError().
  // Overwritten on every failed attempt; the full per-attempt trail (still
  // category-only, never raw) also lives in outcomeHistory.
  landlordFollowUpLastErrorCategory: {
    type: String,
    enum: [null, 'missing_contact_email', 'send_failed'],
    default: null,
  },
  landlordFollowUpLastFailedAt: { type: Date, default: null },

  // Append-only audit trail for outcome-side events specifically (status-
  // pipeline changes via applyStatus() are not duplicated here - that's a
  // separate concern already covered by AdminAction for admin-triggered
  // writes). Only ever pushed to when a tracked field's value actually
  // changes, so repeated identical submissions can't be used to bloat it.
  outcomeHistory: [{
    event: { type: String, required: true },
    actor: { type: String, required: true }, // 'student' | 'landlord' | 'admin' | 'system'
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
    createdAt: { type: Date, default: Date.now },
  }],

  // ── Admin-mediated housing-request flow (new product direction) ────────
  //
  // `flowType` is the immutable discriminator between the pre-existing
  // direct-contact flow (everything above this comment) and the new
  // admin-mediated flow (everything below). Server-set only - no route ever
  // accepts flowType from a request body. `immutable: true` blocks any
  // later .save() from changing it once set; it is NOT given a schema
  // `default`, deliberately - see the long note below on why.
  //
  // WHY NO DEFAULT: a Mongoose schema `default` only applies when a
  // document is constructed/hydrated through this model - it does NOT
  // retroactively exist in already-stored BSON, and a raw MongoDB query
  // (`DormInquiry.find({ flowType: 'legacy_direct' })`) matches only what is
  // actually persisted. Every historical row created before this field
  // existed has NO flowType key in the database at all - not
  // `'legacy_direct'`, literally absent. Any query that needs "all legacy
  // rows" MUST explicitly match `{ $or: [{ flowType: 'legacy_direct' },
  // { flowType: { $exists: false } }] }` - never assume equality alone
  // covers historical data. This exact clause is exported below as
  // LEGACY_FLOW_QUERY so every caller (query builders, admin filters,
  // future code) shares one definition instead of re-deriving it.
  //
  // No production migration is run in this change - old rows are left
  // exactly as they are; they are simply matched by "absent" rather than
  // rewritten.
  flowType: {
    type: String,
    enum: ['legacy_direct', 'admin_mediated'],
    immutable: true,
  },

  // Named `mediationStatus`, not `adminStatus` - deliberate: this value is
  // shown to the student (their own status-check page), not admin-only, so
  // a name implying "admin's internal status" would be misleading in that
  // context. Only meaningful for flowType==='admin_mediated'; stays null
  // for every legacy_direct/undefined-flowType row, and the legacy
  // `status` field above is completely untouched by this flow.
  mediationStatus: {
    type: String,
    enum: [
      null,
      'new',
      'reviewing',
      'checking_availability',
      'available',
      'reserved',
      'unavailable',
      'landlord_unreachable',
      'awaiting_student_consent',
      'handoff_sent',
      'closed',
    ],
    default: null,
  },

  // Set ONLY when mediationStatus === 'closed' - required at that moment
  // (see applyMediationTransition()'s guard below), preserved forever
  // afterward for analytics ("why did this request end without a rental").
  // A dedicated field rather than free text in mediationHistory.meta alone,
  // so it stays queryable/aggregatable directly.
  closureReason: {
    type: String,
    enum: [
      null,
      'fulfilled', // handoff happened, this closure is just pipeline cleanup
      'student_declined', // student explicitly refused to share their info
      'consent_expired', // student never answered the consent request in time
      'student_withdrew', // student asked to stop / no longer interested
      'listing_permanently_unavailable',
      'other',
    ],
    default: null,
  },

  // Append-only, separate from `outcomeHistory` above on purpose - that
  // trail is for POST-CONTACT rental-outcome events (student/landlord
  // outcome claims, confirmations); this one is for PRE-CONTACT mediation
  // events (admin review steps, consent, handoff). Keeping them apart keeps
  // "what happened before we connected these two people" and "what
  // happened after" conceptually separate even though both live on the one
  // document - exactly as required.
  mediationHistory: [{
    event: { type: String, required: true },
    actor: { type: String, required: true }, // 'student' | 'admin' | 'system'
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
    createdAt: { type: Date, default: Date.now },
  }],

  // Optional client-supplied idempotency key (admin_mediated only) - a
  // fast, best-effort exact-match check for "have I already handled this
  // exact submission" (see routes/housingRequests.js's POST /). NOT
  // uniquely indexed and NOT the source of the actual duplicate-
  // prevention guarantee - that comes from HousingRequestDedupClaim's
  // unique-indexed identity key. A missing, reused-across-different-
  // submissions, or forged value here changes nothing about correctness,
  // only about whether this fast path short-circuits the slower one.
  idempotencyKey: { type: String, default: null },

  // The requester's own submitted details. Deliberately NOT reusing
  // `student` (above) as the sole identity carrier: `student` stays
  // required only for legacy rows (see the conditional `required` below) -
  // an admin-mediated request may come from an authenticated student
  // (student set, requester.isGuest=false) OR a guest (student stays null,
  // requester.isGuest=true, identity lives only in these fields).
  requester: {
    name: { type: String, default: '' },
    // Stored pre-lowercased/trimmed at write time (see housingRequests.js) -
    // this IS already the normalized form, deliberately, so a dedup/rate-
    // limit query never has to re-derive it differently from how it was
    // saved.
    email: { type: String, default: '' },
    phoneCountryCode: { type: String, default: '' },
    phone: { type: String, default: '' },
    // Digits-only, country code merged in (e.g. "212612345678") - computed
    // once at write time via utils/requestNormalize.js's normalizePhone(),
    // the SAME function the route uses to build the dedup/rate-limit key.
    // Exists so "+212 6 12 34 56 78" and "0612345678" and "212612345678"
    // are recognized as the same person without re-deriving the merge
    // logic differently in three places.
    normalizedPhone: { type: String, default: '' },
    university: { type: String, default: '' },
    preferredContactMethod: { type: String, enum: [null, 'whatsapp', 'email', 'phone'], default: null },
    message: { type: String, default: '' },
    isGuest: { type: Boolean, default: false },
  },

  consent: {
    processingConsentVersion: { type: String, default: null },
    processingConsentAt: { type: Date, default: null },
    // Set ONLY when the student explicitly agrees, after the admin has
    // already marked the listing available, to have their details shared
    // with the landlord - see applyMediationTransition()'s guard: handoff
    // is structurally impossible without this timestamp.
    sharingConsentAt: { type: Date, default: null },
  },

  // Server-resolved at creation time from the real Dorm document - never
  // from client-supplied title/price/image/landlord fields (see
  // POST /api/housing-requests). Immutable snapshot so the student's status
  // page and the admin table keep showing accurate info even if the
  // listing is later edited/unpublished/deleted.
  listingSnapshot: {
    title: { type: String, default: '' },
    image: { type: String, default: '' },
    city: { type: String, default: '' },
    // Trimmed+lowercased once at write time (routes/housingRequests.js's
    // buildListingSnapshot()) - the admin dashboard's structured city
    // dropdown filter matches this field with an EXACT query, never a
    // regex against the display-cased `city` above (an unanchored regex
    // can't use a standard index and was the actual root cause of the
    // city filter always forcing a full collection scan).
    cityNormalized: { type: String, default: '' },
    neighborhood: { type: String, default: '' },
    price: { type: Number, default: null },
    reference: { type: String, default: '' }, // the Dorm's slug, for building the listing link
  },

  adminNotes: [{
    text: { type: String, required: true },
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    createdAt: { type: Date, default: Date.now },
  }],

  // Durable per-attempt delivery tracking - see NOTIFICATION_KINDS/
  // NOTIFICATION_STATUSES above and services/notificationOutbox.js. Every
  // field required by the durability spec lives here: state, attempt
  // count, last-attempted/sent timestamps, a SAFE error category (never a
  // raw provider response/stack/PII), and a next-retry timestamp (written
  // for a future scheduler to read; nothing auto-retries yet - the
  // follow-up scheduler stays disabled per project constraints).
  mediationNotifications: [{
    kind: { type: String, required: true, enum: NOTIFICATION_KINDS },
    status: { type: String, enum: NOTIFICATION_STATUSES, default: 'pending' },
    attempts: { type: Number, default: 0 },
    lastAttemptedAt: { type: Date, default: null },
    sentAt: { type: Date, default: null },
    errorCategory: { type: String, default: null },
    nextRetryAt: { type: Date, default: null },
  }],

  // Secure status-link for a GUEST requester (an authenticated student uses
  // their normal session instead). Only ever the HASH of the token's jti is
  // stored - mirrors landlordTokenJtiHash's policy above. Not single-use
  // for reads (a guest must be able to reload their status page
  // repeatedly) - `revokedAt` exists for an explicit admin/security
  // revocation, separate from normal expiry.
  statusToken: {
    jtiHash: { type: String, default: null },
    createdAt: { type: Date, default: null },
    expiresAt: { type: Date, default: null },
    revokedAt: { type: Date, default: null },
  },

  handoff: {
    sentAt: { type: Date, default: null },
    method: { type: String, enum: [null, 'email'], default: null },
    success: { type: Boolean, default: null },
    // A coarse category only - never a raw provider error/stack, matching
    // landlordFollowUpLastErrorCategory's existing policy above.
    failureCategory: { type: String, default: null },
    // Atomic in-flight claim flag - the actual double-send guard, not
    // decorative. services/dormHandoff.js claims this via ONE atomic
    // findOneAndUpdate matching {success:{$ne:true}, inProgress:{$ne:true}}
    // before ever calling the email provider; only the request that wins
    // that single atomic write proceeds to send. Reset to false on a
    // failed attempt (so a genuine retry can claim again) and left
    // meaningless-but-true after a success (mediationStatus is already
    // terminal 'handoff_sent' by then, so no further claim is possible
    // regardless). This is what makes concurrent double-clicks and network
    // retries safe against sending the landlord two emails - the mediation
    // state machine's own transition guard (awaiting_student_consent's
    // single path to handoff_sent) is necessary but not sufficient on its
    // own, since two concurrent requests could otherwise both observe
    // "not yet handoff_sent" before either one writes.
    inProgress: { type: Boolean, default: false },
  },
}, {
  timestamps: true,
  // Matches models/RoommateMatch.js, RoommateProfile.js, Notification.js -
  // Mongoose's implicit autoIndex build fires as an unawaited side effect
  // the first time the model is used after connect, which is exactly the
  // "don't assume indexes get created automatically" risk this schema now
  // has too (see the new landlord-related compound indexes below). Index
  // creation is instead done explicitly and awaited in server.js's
  // ensureCriticalIndexes() at boot, the same controlled path already
  // proven for those three models.
  autoIndex: false,
});

// Duplicate-click / rapid-retry protection window: look up the most recent
// matching (student, listing, contactMethod) inquiry.
dormInquirySchema.index({ student: 1, listing: 1, contactMethod: 1, createdAt: -1 });
// Student's own inquiry history.
dormInquirySchema.index({ student: 1, createdAt: -1 });
// Landlord's own connected inquiries.
dormInquirySchema.index({ landlord: 1, createdAt: -1 });
// Admin list/filter/stats.
dormInquirySchema.index({ status: 1, createdAt: -1 });
dormInquirySchema.index({ listingCity: 1 });
dormInquirySchema.index({ listing: 1, createdAt: -1 });
// Follow-up cron batch scans ("due 3-day questions"/"due 7-day reminders
// not yet sent"), and the admin dashboard's outcome filters/conversion
// stats - both always filter by outcomeStatus first.
dormInquirySchema.index({ outcomeStatus: 1, followUpDueAt: 1 });
dormInquirySchema.index({ outcomeStatus: 1, reminderDueAt: 1 });
dormInquirySchema.index({ outcomeStatus: 1, createdAt: -1 });
// Landlord processor query (services/dormFollowUpProcessor.js Step 3):
// { landlordFollowUpSentAt: null, landlordOutcome: null,
//   landlordFollowUpDueAt: {$lte: now}, outcomeStatus: {$nin:[...]},
//   landlordFollowUpFailureCount: {$lt: MAX} }. Ordered by the ESR rule -
// Equality fields first (landlordFollowUpSentAt, landlordOutcome are both
// always queried as `null`), then the one Range field the index can use
// efficiently as a bound (landlordFollowUpDueAt). `outcomeStatus: $nin` is
// a negation - not a usable index predicate either way, so it's
// deliberately left out of this index rather than padding it with a field
// that can't narrow the scan. `landlordFollowUpFailureCount` is a SECOND
// range condition; a compound index can only use one range component
// efficiently, and by the time the DB has already narrowed to "not yet
// sent, not yet answered, due now" the remaining candidate set is small
// enough that filtering failureCount in-memory (rather than adding a
// second index) is the right tradeoff - see the "Indexes" section of the
// integrity-pass report for the verified .explain() output backing this.
dormInquirySchema.index({ landlordFollowUpSentAt: 1, landlordOutcome: 1, landlordFollowUpDueAt: 1 });
// Admin conflict detection (?conflictsOnly=true list filter + /stats
// `conflicts` count in routes/admin/dormInquiries.js) - both query
// {studentOutcome, landlordOutcome} directly, matching this index exactly.
// Deliberately NOT reused for the landlordDeliveryFailed filter (see that
// filter's own comment in routes/admin/dormInquiries.js) - different field,
// different index would be needed, and that filter's volume doesn't
// justify one (see the report).
dormInquirySchema.index({ studentOutcome: 1, landlordOutcome: 1 });

const TERMINAL_STATUSES = new Set(['rented', 'unavailable', 'closed']);

dormInquirySchema.methods.applyStatus = function applyStatus(nextStatus) {
  // Legacy pipeline-stage transitions only ever apply to the legacy flow -
  // an admin_mediated row uses applyMediationTransition() instead. Guarded
  // here (not just by convention in route handlers) so a future caller
  // cannot silently corrupt a new-flow document by calling the wrong
  // method.
  if (this.flowType === 'admin_mediated') {
    const err = new Error('applyStatus() cannot be used on an admin_mediated inquiry - use applyMediationTransition() instead.');
    err.code = 'WRONG_FLOW_FOR_TRANSITION';
    throw err;
  }
  this.status = nextStatus;

  if (nextStatus === 'landlord_replied' && !this.milestones.landlordReplied) {
    this.milestones.landlordReplied = true;
    if (!this.landlordRespondedAt) this.landlordRespondedAt = new Date();
  }
  if (nextStatus === 'viewing_scheduled') {
    this.milestones.viewingScheduled = true;
  }
  if (nextStatus === 'rented') {
    this.milestones.rented = true;
  }
  if (TERMINAL_STATUSES.has(nextStatus) && !this.closedAt) {
    this.closedAt = new Date();
  }
};

// Validated transition table for `outcomeStatus` - the ONLY thing allowed
// to move it is applyOutcomeTransition() below. No route handler ever
// assigns to inquiry.outcomeStatus directly, and no client-supplied string
// is ever written straight into it - this table is the single point where
// "is this transition legal" is decided.
const OUTCOME_TRANSITIONS = {
  contact_initiated: ['landlord_responded', 'visit_scheduled', 'rental_reported', 'no_response', 'listing_unavailable', 'cancelled'],
  landlord_responded: ['visit_scheduled', 'rental_reported', 'not_rented', 'listing_unavailable', 'cancelled'],
  visit_scheduled: ['rental_reported', 'not_rented', 'listing_unavailable', 'cancelled'],
  rental_reported: ['rental_confirmed', 'not_rented', 'listing_unavailable', 'cancelled'],
  rental_confirmed: [], // terminal - never transitions again
  no_response: ['landlord_responded', 'visit_scheduled', 'rental_reported', 'cancelled'],
  not_rented: ['cancelled'],
  listing_unavailable: ['cancelled'],
  cancelled: [],
};

/**
 * The only legal way to change outcomeStatus. Same-value calls are a no-op
 * (returns false, no history entry) - this is what makes repeat/duplicate
 * requests idempotent instead of erroring. An actually-disallowed
 * transition throws, which routes must catch and surface as 409, not 500 -
 * it's a legitimate state-race outcome (e.g. two concurrent requests),
 * not a server fault.
 */
dormInquirySchema.methods.applyOutcomeTransition = function applyOutcomeTransition(nextOutcomeStatus, { actor, actorId = null, event, meta = {} } = {}) {
  if (this.outcomeStatus === nextOutcomeStatus) return false;
  const allowed = OUTCOME_TRANSITIONS[this.outcomeStatus] || [];
  if (!allowed.includes(nextOutcomeStatus)) {
    const err = new Error(`Invalid outcome transition: ${this.outcomeStatus} -> ${nextOutcomeStatus}`);
    err.code = 'INVALID_OUTCOME_TRANSITION';
    throw err;
  }
  this.outcomeStatus = nextOutcomeStatus;
  this.outcomeHistory.push({ event, actor, actorId, meta, createdAt: new Date() });
  return true;
};

/**
 * Confirms a rental. Idempotent: calling this on an already-confirmed
 * inquiry is a silent no-op, which is exactly what makes double-clicks and
 * concurrent duplicate requests (two tabs, a retried POST) safe - the
 * confirmation is never re-applied, rentalConfirmedAt/confirmedBy are never
 * overwritten by a later call.
 *
 * source: 'dual_report' (both parties independently agree - actorId stays
 * null, since no single user "did" it) or 'admin_manual' (actorId = the
 * confirming admin).
 *
 * 'admin_manual' deliberately bypasses the OUTCOME_TRANSITIONS table rather
 * than requiring the inquiry to already be in 'rental_reported': the admin
 * route is itself gated behind isAdmin, and the spec grants admin the
 * authority to "review and set the definitive outcome" regardless of
 * pipeline stage (e.g. verifying a rental over the phone that neither
 * party ever self-reported through the app). 'dual_report' still goes
 * through the normal table as a sanity check, since it's only ever reached
 * from 'rental_reported' by construction in reportRentedOutcome() below.
 *
 * INVARIANT (corrected): a confirmed inquiry is valid when EITHER
 *   (a) confirmationSource === 'dual_report' AND studentOutcome === 'rented'
 *       AND landlordOutcome === 'rented' - both fields are REAL, independently
 *       submitted party claims, never written here; OR
 *   (b) confirmationSource === 'admin_manual' AND confirmedBy/rentalConfirmedAt
 *       /a non-empty reason all exist.
 * 'admin_manual' NEVER writes studentOutcome/landlordOutcome/their
 * *RespondedAt timestamps - fabricating a party's answer (even to a value
 * that happens to be correct) would make it indistinguishable from a real
 * submission everywhere else in the app (the admin table's "Étudiant"/
 * "Propriétaire" columns, conflict detection, audit history), which is
 * exactly the integrity violation this correction removes. An admin
 * confirming despite one or both fields being null, or even
 * CONFLICTING (e.g. student='rented', landlord='available'), is a
 * deliberate, authorized override - the original party responses (and any
 * conflict they represent) must remain visible afterward, unmodified.
 *
 * `reason` is REQUIRED for 'admin_manual' (a human-readable justification,
 * e.g. "Confirmed by phone with landlord on 2026-09-17") and is the ONLY
 * new data admin_manual writes beyond the confirmation fields themselves -
 * stored in the immutable outcomeHistory event, never overwritten.
 */
dormInquirySchema.methods.confirmRentedOutcome = function confirmRentedOutcome(source, actorId = null, reason = null) {
  if (this.outcomeStatus === 'rental_confirmed') return false;

  if (source === 'admin_manual') {
    if (!reason || !String(reason).trim()) {
      const err = new Error('A reason is required for a manual rental confirmation.');
      err.code = 'REASON_REQUIRED';
      throw err;
    }
    if (!actorId) {
      const err = new Error('A manual rental confirmation requires an authenticated admin.');
      err.code = 'ADMIN_REQUIRED';
      throw err;
    }
    this.outcomeStatus = 'rental_confirmed';
    // studentOutcome/landlordOutcome and their *RespondedAt timestamps are
    // DELIBERATELY left untouched - see the invariant note above.
    this.outcomeHistory.push({ event: 'rental_confirmed', actor: 'admin', actorId, meta: { source, reason: String(reason).trim() }, createdAt: new Date() });
  } else {
    if (this.studentOutcome !== 'rented' || this.landlordOutcome !== 'rented') {
      const err = new Error('dual_report confirmation requires both studentOutcome and landlordOutcome to already be "rented".');
      err.code = 'DUAL_REPORT_MISMATCH';
      throw err;
    }
    this.applyOutcomeTransition('rental_confirmed', {
      actor: actorId ? 'admin' : 'system',
      actorId,
      event: 'rental_confirmed',
      meta: { source },
    });
  }

  this.rentalConfirmedAt = new Date();
  this.confirmedBy = actorId;
  this.confirmationSource = source;
  return true;
};

/**
 * Records one party's "rented" claim and applies the dual-confirmation
 * rule: if the OTHER party has already independently claimed 'rented' too,
 * this call confirms the rental (source 'dual_report'). Otherwise it's a
 * one-sided report only - outcomeStatus moves to 'rental_reported' (never
 * 'rental_confirmed') and rentalReportedAt is set once, on first report.
 *
 * party: 'student' | 'landlord'.
 */
dormInquirySchema.methods.reportRentedOutcome = function reportRentedOutcome(party) {
  const now = new Date();
  const otherPartyOutcome = party === 'student' ? this.landlordOutcome : this.studentOutcome;

  if (party === 'student') {
    this.studentOutcome = 'rented';
    this.studentRespondedAt = now;
  } else {
    this.landlordOutcome = 'rented';
    this.landlordOutcomeRespondedAt = now;
  }

  if (otherPartyOutcome === 'rented') {
    this.confirmRentedOutcome('dual_report', null);
    return;
  }

  if (this.outcomeStatus === 'rental_confirmed') return; // never downgrade
  if (this.outcomeStatus !== 'rental_reported') {
    this.applyOutcomeTransition('rental_reported', {
      actor: party,
      actorId: null,
      event: `${party}_reported_rented`,
    });
  }
  if (!this.rentalReportedAt) this.rentalReportedAt = now;
};

/**
 * True when the two independently-submitted claims contradict each other.
 * Deliberately only the specific pairings the spec calls out - NOT a
 * generic "any two different values" rule, since e.g.
 * student='visit_scheduled' + landlord='reserved' are different strings but
 * not actually in conflict (both describe "still in progress"). Read-only;
 * never itself changes outcomeStatus or either party's outcome - conflicts
 * are surfaced for admin review, not auto-resolved.
 */
dormInquirySchema.methods.hasOutcomeConflict = function hasOutcomeConflict() {
  const s = this.studentOutcome;
  const l = this.landlordOutcome;
  if (!s || !l) return false;
  if (s === 'rented' && (l === 'available' || l === 'unavailable')) return true;
  if (l === 'rented' && (s === 'still_searching' || s === 'listing_unavailable')) return true;
  return false;
};

// ── Admin-mediated housing-request state machine ──────────────────────────
//
// Sequence the spec requires, enforced structurally (not just by caller
// discipline): checking_availability -> available -> awaiting_student_consent
// -> handoff_sent. It is impossible to reach handoff_sent without first
// passing through awaiting_student_consent, and impossible to reach
// awaiting_student_consent from anywhere except available - so "consent
// before availability" and "handoff before availability and consent" are
// both rejected by the table shape itself, not by an extra runtime check
// alone (applyMediationTransition() below adds a second, explicit guard on
// top of this for defense-in-depth, since a table can express "not
// reachable in one hop" but not "the consent timestamp must actually be
// set").
const MEDIATION_TRANSITIONS = {
  new: ['reviewing', 'closed'],
  reviewing: ['checking_availability', 'closed'],
  checking_availability: ['available', 'unavailable', 'reserved', 'landlord_unreachable', 'closed'],
  available: ['awaiting_student_consent', 'closed'],
  awaiting_student_consent: ['handoff_sent', 'closed'],
  reserved: ['checking_availability', 'closed'], // admin may re-check later
  unavailable: ['closed'],
  landlord_unreachable: ['checking_availability', 'closed'], // admin may retry
  handoff_sent: [], // terminal - the post-contact rental-outcome system takes over from here
  closed: [], // terminal
};

// Valid values for closureReason - required exactly when nextStatus ===
// 'closed' (see the guard in applyMediationTransition()). Kept as its own
// list (not reused from anywhere else) so it can evolve independently of
// mediationStatus itself.
const CLOSURE_REASONS = [
  'fulfilled',
  'student_declined',
  'consent_expired',
  'student_withdrew',
  'listing_permanently_unavailable',
  'other',
];

// The ONLY targets an admin correction may land on. Deliberately excludes
// 'available', 'awaiting_student_consent' and 'handoff_sent' - a correction
// exists to walk a record BACK to an earlier working state for a human to
// redo properly (e.g. a mistaken close, or a handoff that needs to be
// reviewed again), never to fabricate forward progress. In particular,
// 'handoff_sent' is not a correction target at all: the only way that
// status is ever set is applyMediationTransition(), which enforces the
// real consent check - a correction path landing there would be exactly
// the "fabricate consent/handoff success" hole this requirement closes.
const CORRECTION_ALLOWED_TARGETS = ['reviewing', 'checking_availability', 'closed'];

/**
 * The only legal way to change mediationStatus. Mirrors
 * applyOutcomeTransition()'s shape (same-value calls are a no-op, an
 * illegal transition throws with a `code` a route can map to 409) but is a
 * fully separate function/table, per the requirement that legacy and
 * admin-mediated transitions never share logic.
 *
 * Rejects, each with a distinct `code`:
 *  - being called on a non-admin_mediated row (WRONG_FLOW_FOR_TRANSITION)
 *  - a nextStatus not reachable from the current one (INVALID_MEDIATION_TRANSITION)
 *  - reaching 'awaiting_student_consent' without the listing actually being
 *    marked available first - structurally already impossible via the
 *    table (only 'available' can reach it), checked again explicitly
 *    (CONSENT_BEFORE_AVAILABILITY) so the error is specific rather than a
 *    generic "invalid transition"
 *  - reaching 'handoff_sent' without consent.sharingConsentAt already set
 *    (HANDOFF_BEFORE_CONSENT) - this is the one guard the table alone
 *    cannot express, since the table only knows "came from
 *    awaiting_student_consent," not "and consent was actually recorded"
 *  - moving away from a terminal state ('handoff_sent', 'closed') at all -
 *    already impossible via the table (both map to []), so no extra check
 *    needed; the only way to touch a terminal row again is
 *    correctMediationStatus() below, a distinct, explicitly-named admin
 *    correction path
 */
dormInquirySchema.methods.applyMediationTransition = function applyMediationTransition(nextStatus, { actor, actorId = null, event, meta = {}, closureReason = null } = {}) {
  if (this.flowType !== 'admin_mediated') {
    const err = new Error('applyMediationTransition() can only be used on an admin_mediated inquiry.');
    err.code = 'WRONG_FLOW_FOR_TRANSITION';
    throw err;
  }
  if (this.mediationStatus === nextStatus) return false;

  const allowed = MEDIATION_TRANSITIONS[this.mediationStatus] || [];
  if (!allowed.includes(nextStatus)) {
    const err = new Error(`Invalid mediation transition: ${this.mediationStatus} -> ${nextStatus}`);
    err.code = 'INVALID_MEDIATION_TRANSITION';
    throw err;
  }

  if (nextStatus === 'awaiting_student_consent' && this.mediationStatus !== 'available') {
    const err = new Error('Cannot request consent before the listing has been marked available.');
    err.code = 'CONSENT_BEFORE_AVAILABILITY';
    throw err;
  }
  if (nextStatus === 'handoff_sent' && !this.consent.sharingConsentAt) {
    const err = new Error('Cannot hand off to the landlord before the student has given sharing consent.');
    err.code = 'HANDOFF_BEFORE_CONSENT';
    throw err;
  }
  // Every path into 'closed' must say why - required so the analytics this
  // requirement asks for ("why did requests end without a rental") are
  // never a pile of unexplained closures. Validated against CLOSURE_REASONS
  // rather than accepted as free text.
  if (nextStatus === 'closed') {
    if (!closureReason || !CLOSURE_REASONS.includes(closureReason)) {
      const err = new Error(`A valid closureReason is required when closing a mediation request. Got: ${closureReason}`);
      err.code = 'CLOSURE_REASON_REQUIRED';
      throw err;
    }
    this.closureReason = closureReason;
  }

  this.mediationStatus = nextStatus;
  this.mediationHistory.push({ event, actor, actorId, meta: closureReason ? { ...meta, closureReason } : meta, createdAt: new Date() });
  return true;
};

/**
 * Explicit admin correction path for a TERMINAL mediation state
 * ('handoff_sent' or 'closed') - the only way either is ever touched again,
 * since MEDIATION_TRANSITIONS maps both to []. Always requires an
 * authenticated admin and a non-empty reason, and always records the
 * correction in mediationHistory - mirrors confirmRentedOutcome's
 * 'admin_manual' path exactly (same rationale: a deliberate, audited
 * override, not a normal pipeline step).
 */
dormInquirySchema.methods.correctMediationStatus = function correctMediationStatus(nextStatus, actorId, reason, { closureReason = null } = {}) {
  if (this.flowType !== 'admin_mediated') {
    const err = new Error('correctMediationStatus() can only be used on an admin_mediated inquiry.');
    err.code = 'WRONG_FLOW_FOR_TRANSITION';
    throw err;
  }
  if (!actorId) {
    const err = new Error('A mediation-status correction requires an authenticated admin.');
    err.code = 'ADMIN_REQUIRED';
    throw err;
  }
  if (!reason || !String(reason).trim()) {
    const err = new Error('A reason is required to correct a mediation status.');
    err.code = 'REASON_REQUIRED';
    throw err;
  }
  // Restricted allowlist, not "any known mediationStatus" - see
  // CORRECTION_ALLOWED_TARGETS' comment for why 'available',
  // 'awaiting_student_consent' and especially 'handoff_sent' are
  // deliberately unreachable from here: this path must never be able to
  // fabricate consent or a successful handoff.
  if (!CORRECTION_ALLOWED_TARGETS.includes(nextStatus)) {
    const err = new Error(`'${nextStatus}' is not a valid correction target. Allowed: ${CORRECTION_ALLOWED_TARGETS.join(', ')}`);
    err.code = 'INVALID_CORRECTION_TARGET';
    throw err;
  }
  if (nextStatus === 'closed') {
    if (!closureReason || !CLOSURE_REASONS.includes(closureReason)) {
      const err = new Error(`A valid closureReason is required when correcting to 'closed'. Got: ${closureReason}`);
      err.code = 'CLOSURE_REASON_REQUIRED';
      throw err;
    }
    this.closureReason = closureReason;
  }
  const previousStatus = this.mediationStatus;
  this.mediationStatus = nextStatus;
  // Immutable audit event: previous status, next status, admin id,
  // timestamp (createdAt below) and reason - flowType is never touched by
  // this method (not present anywhere in this function body), and history
  // is only ever appended to, never rewritten or removed.
  this.mediationHistory.push({
    event: 'mediation_status_corrected',
    actor: 'admin',
    actorId,
    meta: { from: previousStatus, to: nextStatus, reason: String(reason).trim(), closureReason },
    createdAt: new Date(),
  });
  return true;
};

// ── Audience-scoped serializers ────────────────────────────────────────────
//
// Three separate views instead of one broad `.toObject()`/`.getPublicData()`
// reused everywhere - each audience sees only what it needs, so a field
// added later for one audience cannot accidentally leak to another by
// being included in a shared serializer nobody re-audited.

/** What the student's own status-check page may see. No landlord PII ever. */
dormInquirySchema.methods.toStudentMediationView = function toStudentMediationView() {
  return {
    reference: this.uniqueReference,
    mediationStatus: this.mediationStatus,
    closureReason: this.closureReason,
    listing: this.listingSnapshot,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
    consent: {
      sharingConsentGiven: !!this.consent.sharingConsentAt,
    },
    handoff: {
      completed: this.mediationStatus === 'handoff_sent',
      sentAt: this.handoff.sentAt,
    },
  };
};

/**
 * What the admin "Demandes de logement" table/detail view may see. An
 * EXPLICIT allowlist - "admin" does not mean "the whole document." Every
 * field below is individually picked; nothing is ever spread wholesale from
 * `this`. In particular, deliberately EXCLUDED even for admin:
 *  - statusToken (jtiHash/createdAt/expiresAt/revokedAt) - a guest's
 *    status-page credential; the admin UI never needs to see or use it,
 *    and displaying even the hash is an unused security internal.
 *  - handoff.failureCategory beyond what's listed - only the coarse
 *    category ever existed on this model (see the field's own comment),
 *    never a raw provider response/error stack, so there is nothing more
 *    to accidentally include.
 *  - mediationHistory/adminNotes are re-mapped into plain objects with a
 *    fixed key set, not passed through as Mongoose subdocuments - this
 *    means a field added to either subdocument schema in the future does
 *    NOT automatically appear in the admin view; a human has to add it
 *    here on purpose.
 */
dormInquirySchema.methods.toAdminMediationView = function toAdminMediationView() {
  return {
    id: this._id,
    reference: this.uniqueReference,
    flowType: this.flowType,
    mediationStatus: this.mediationStatus,
    closureReason: this.closureReason,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
    requester: {
      name: this.requester.name,
      email: this.requester.email,
      phoneCountryCode: this.requester.phoneCountryCode,
      phone: this.requester.phone,
      university: this.requester.university,
      preferredContactMethod: this.requester.preferredContactMethod,
      message: this.requester.message,
      isGuest: this.requester.isGuest,
    },
    listing: this.listingSnapshot,
    listingId: this.listing,
    student: this.student || null,
    sourcePage: this.sourcePage,
    consent: {
      processingConsentVersion: this.consent.processingConsentVersion,
      processingConsentAt: this.consent.processingConsentAt,
      sharingConsentAt: this.consent.sharingConsentAt,
    },
    mediationHistory: this.mediationHistory.map((h) => ({
      event: h.event,
      actor: h.actor,
      actorId: h.actorId,
      meta: h.meta,
      createdAt: h.createdAt,
    })),
    adminNotes: this.adminNotes.map((n) => ({
      text: n.text,
      actorId: n.actorId,
      createdAt: n.createdAt,
    })),
    // Explicit field-by-field mapping (never the raw subdocument) - every
    // field here is already safe (no PII, no raw provider response was
    // ever allowed into errorCategory - see categorizeNotificationError()),
    // but this keeps the allowlist convention consistent with every other
    // field in this view and survives a future field being added to the
    // schema without silently widening this response.
    mediationNotifications: (this.mediationNotifications || []).map((n) => ({
      kind: n.kind,
      status: n.status,
      attempts: n.attempts,
      lastAttemptedAt: n.lastAttemptedAt,
      sentAt: n.sentAt,
      errorCategory: n.errorCategory,
      nextRetryAt: n.nextRetryAt,
    })),
    handoff: {
      sentAt: this.handoff.sentAt,
      method: this.handoff.method,
      success: this.handoff.success,
      failureCategory: this.handoff.failureCategory,
    },
  };
};

// A module-private capability token - the ONLY value toLandlordHandoffView()
// accepts as proof it is being called from the real, authorized handoff
// code path (see services/dormHandoff.js, added in a later phase). A
// Symbol rather than a string/boolean constant specifically because it
// cannot be produced by guessing, hardcoding, or copy-pasting a literal -
// only code that does `require('../models/DormInquiry').HANDOFF_AUTHORIZATION_TOKEN`
// can ever pass this check, so an accidental or malicious call to this
// serializer from anywhere else in the codebase fails closed.
const HANDOFF_AUTHORIZATION_TOKEN = Symbol('dormInquiry.landlordHandoffAuthorized');

/**
 * What is sent TO the landlord at handoff time. Deliberately the narrowest
 * of the three - only the fields the spec's section 11 lists (name, email,
 * phone/WhatsApp, university, preferred contact method, message, property
 * reference). Never the student's account id, never internal mediation
 * history, never admin notes.
 *
 * Defense in depth, on top of (never instead of) the route-level check:
 * refuses to serialize anything at all unless ALL of the following hold -
 *  1. `authorization` is exactly HANDOFF_AUTHORIZATION_TOKEN, proving the
 *     caller is the authorized handoff path, not an accidental call from
 *     an admin list view or a copy-pasted route;
 *  2. flowType === 'admin_mediated';
 *  3. mediationStatus is 'awaiting_student_consent' (a pre-send preview,
 *     called just before the transition into handoff_sent) or
 *     'handoff_sent' (the real send, or re-displaying what was sent);
 *  4. consent.sharingConsentAt is actually set - never trusts the caller's
 *     belief that consent exists, re-checks the field itself.
 * A route that "forgets" to check consent is still blocked here.
 */
dormInquirySchema.methods.toLandlordHandoffView = function toLandlordHandoffView(authorization) {
  if (authorization !== HANDOFF_AUTHORIZATION_TOKEN) {
    const err = new Error('toLandlordHandoffView() requires explicit authorization from the executing handoff path.');
    err.code = 'HANDOFF_VIEW_UNAUTHORIZED';
    throw err;
  }
  if (this.flowType !== 'admin_mediated') {
    const err = new Error('toLandlordHandoffView() can only be used on an admin_mediated inquiry.');
    err.code = 'WRONG_FLOW_FOR_TRANSITION';
    throw err;
  }
  if (!['awaiting_student_consent', 'handoff_sent'].includes(this.mediationStatus)) {
    const err = new Error(`Cannot build a landlord handoff view at mediationStatus '${this.mediationStatus}'.`);
    err.code = 'HANDOFF_VIEW_WRONG_STATUS';
    throw err;
  }
  if (!this.consent.sharingConsentAt) {
    const err = new Error('Cannot build a landlord handoff view before the student has given sharing consent.');
    err.code = 'HANDOFF_BEFORE_CONSENT';
    throw err;
  }
  return {
    reference: this.uniqueReference,
    studentName: this.requester.name,
    studentEmail: this.requester.email,
    studentPhone: this.requester.phoneCountryCode
      ? `${this.requester.phoneCountryCode}${this.requester.phone}`
      : this.requester.phone,
    university: this.requester.university,
    preferredContactMethod: this.requester.preferredContactMethod,
    message: this.requester.message,
    propertyReference: this.listingSnapshot.reference,
    propertyTitle: this.listingSnapshot.title,
  };
};

// Shared "match every legacy row, including historical ones with no
// flowType key at all" clause - see the long note on the `flowType` field
// above for why equality alone is never sufficient. Every query that must
// only ever see legacy rows (follow-up scheduler eligibility, any future
// legacy-only admin filter) should spread/reuse this exact object rather
// than re-deriving the same $or by hand.
const LEGACY_FLOW_QUERY = { $or: [{ flowType: 'legacy_direct' }, { flowType: { $exists: false } }] };

module.exports = mongoose.model('DormInquiry', dormInquirySchema);
module.exports.OUTCOME_TRANSITIONS = OUTCOME_TRANSITIONS;
module.exports.MEDIATION_TRANSITIONS = MEDIATION_TRANSITIONS;
module.exports.CLOSURE_REASONS = CLOSURE_REASONS;
module.exports.CORRECTION_ALLOWED_TARGETS = CORRECTION_ALLOWED_TARGETS;
module.exports.HANDOFF_AUTHORIZATION_TOKEN = HANDOFF_AUTHORIZATION_TOKEN;
module.exports.LEGACY_FLOW_QUERY = LEGACY_FLOW_QUERY;
module.exports.NOTIFICATION_KINDS = NOTIFICATION_KINDS;
module.exports.NOTIFICATION_STATUSES = NOTIFICATION_STATUSES;
