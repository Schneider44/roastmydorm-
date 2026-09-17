// ── Diagnostic step-logger (uses only Node.js built-ins, always safe) ──────────
const fs   = require('fs');
const path = require('path');
const _LOG = path.join(__dirname, 'uploads', 'startup-error.txt');
function _step(msg) {
  const line = `${new Date().toISOString()} ${msg}\n`;
  process.stdout.write(line);
  try { fs.mkdirSync(path.dirname(_LOG), { recursive: true }); fs.appendFileSync(_LOG, line); } catch (_) {}
}
_step(`BOOT node=${process.version} pid=${process.pid}`);

const express = require('express');        _step('express OK');
const mongoose = require('mongoose');      _step('mongoose OK');
const cors = require('cors');              _step('cors OK');
const helmet = require('helmet');          _step('helmet OK');
const compression = require('compression'); _step('compression OK');
const morgan = require('morgan');          _step('morgan OK');
const rateLimit = require('express-rate-limit'); _step('rate-limit OK');
const mongoSanitize = require('express-mongo-sanitize'); _step('mongo-sanitize OK');
const xss = require('xss-clean');          _step('xss-clean OK');
const hpp = require('hpp');                _step('hpp OK');

require('dotenv').config();               _step('dotenv OK');

const app = express();

// Log startup errors to uploads/startup-error.txt for remote diagnosis via HTTP
function _logStartupError(label, err) {
  try {
    fs.mkdirSync(path.join(__dirname, 'uploads'), { recursive: true });
    fs.appendFileSync(
      path.join(__dirname, 'uploads', 'startup-error.txt'),
      `${new Date().toISOString()} [${label}] ${err.message}\n${err.stack || ''}\n---\n`
    );
  } catch (_) {}
}

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  _logStartupError('uncaughtException', error);
});

// Trust Hostinger's nginx reverse proxy (fixes X-Forwarded-For / rate-limit validation)
app.set('trust proxy', 1);

// Serve uploads statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ============================================
// SECURITY MIDDLEWARE
// ============================================

// Helmet for security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      // The property page embeds a keyless OpenStreetMap "approximate area"
      // map. frame-src otherwise falls back to default-src 'self', which
      // silently blanks the iframe with no visible error.
      frameSrc: ["'self'", "https://www.openstreetmap.org"],
      connectSrc: ["'self'", process.env.CLIENT_URL || 'https://www.roastmydorm.com']
    }
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// Disable X-Powered-By header
app.disable('x-powered-by');

// NoSQL Injection Prevention
app.use(mongoSanitize());

// XSS Protection - Sanitize user input
app.use(xss());

// HTTP Parameter Pollution Prevention
app.use(hpp());

// Compression for response optimization
app.use(compression({
  level: 6,
  threshold: 1024, // Only compress responses > 1KB
  filter: (req, res) => {
    if (req.headers['x-no-compression']) return false;
    return compression.filter(req, res);
  }
}));

// Rate limiting - General. This is a coarse, IP-keyed BACKSTOP against
// anonymous/pre-auth abuse of the whole /api/ surface - it deliberately
// cannot key by user (it runs before any route's own `auth` middleware, so
// req.user is never populated here yet). The real, precise limiting lives
// on individual authenticated routes instead (see
// backend/middleware/rateLimiters.js, wired into backend/routes/roommate.js
// et al.) - those are keyed by user, not IP, which is what actually fixes
// "one feature's heavy legitimate use locks out every other user on the
// same network." 100/15min here was low enough that a SINGLE legitimate
// page load (several requests) plus any polling could exhaust it for an
// entire shared IP; raised to a real backstop level instead.
const generalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 300,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === '/api/health',
  handler: (req, res) => {
    const resetMs = req.rateLimit && req.rateLimit.resetTime
      ? req.rateLimit.resetTime.getTime() - Date.now()
      : 0;
    const retryAfter = Math.max(1, Math.ceil(resetMs / 1000));
    console.warn(`[rate-limit:general] blocked ip=${req.ip} route=${req.originalUrl}`);
    res.set('Retry-After', String(retryAfter));
    res.status(429).json({
      success: false,
      error: 'RATE_LIMITED',
      message: 'Trop de demandes. Réessaie dans quelques instants.',
      retryAfter,
    });
  },
});

// Stricter rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    const resetMs = req.rateLimit && req.rateLimit.resetTime
      ? req.rateLimit.resetTime.getTime() - Date.now()
      : 0;
    const retryAfter = Math.max(1, Math.ceil(resetMs / 1000));
    console.warn(`[rate-limit:auth] blocked ip=${req.ip} route=${req.originalUrl}`);
    res.set('Retry-After', String(retryAfter));
    res.status(429).json({
      success: false,
      error: 'RATE_LIMITED',
      message: 'Trop de tentatives. Réessaie dans quelques instants.',
      retryAfter,
    });
  },
});

// Apply rate limiters
app.use('/api/', generalLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/send-verification', authLimiter);
app.use('/api/auth/resend-verification', authLimiter);

// CORS configuration — HTTPS-only in production, localhost allowed in dev
const allowedOrigins = [
  process.env.CLIENT_URL,
  'https://www.roastmydorm.com',
  'https://roastmydorm.com',
  'http://www.roastmydorm.com',
  'http://roastmydorm.com',
  'https://www.roastmydorm.com',
  process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
  ...(process.env.NODE_ENV !== 'production' ? [
    'http://localhost:5173',
    'http://localhost:3000',
    'http://localhost:63519',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5507',
    'file://',
  ] : [])
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error(`Not allowed by CORS: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  maxAge: 86400 // 24 hours
}));

// ============================================
// BODY PARSING & LOGGING
// ============================================

// Stripe webhook MUST receive raw body for signature verification — mount BEFORE express.json
try {
  const { webhookHandler: stripeWebhookHandler } = require('./routes/stripe');
  app.post(
    '/api/stripe/webhook',
    express.raw({ type: 'application/json', limit: '1mb' }),
    stripeWebhookHandler
  );
} catch (e) {
  console.error('[startup] Failed to load stripe webhook:', e.message);
  _logStartupError('stripe', e);
}

// Body parsing with size limits (100kb for JSON API, 10mb only for file upload routes)
app.use(express.json({
  limit: '100kb',
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

// Logging - different format for production
if (process.env.NODE_ENV === 'production') {
  app.use(morgan('combined'));
} else {
  app.use(morgan('dev'));
}

// ============================================
// DATABASE CONNECTION (patched for Vercel)
// ============================================

// Fail immediately if DB not connected instead of buffering for 10s (Vercel timeout is 10s)
mongoose.set('bufferCommands', false);

// Cache the connection across invocations (important for serverless)
let cachedConn = null;

// Safety-critical indexes that MUST exist before any request is served
// against them - a background "it'll build eventually" index is not good
// enough here, since RoommateMatch's unique {user1Id,user2Id} index is part
// of how duplicate mutual-interest records are prevented (see
// controllers/roommateController.js sendInterest). Tracked separately from
// mongoose's own connection readyState because readyState going to 1 only
// means the socket is connected, not that this check has run yet - and once
// it's 1, later connectDB() calls take the early-return branch and would
// otherwise skip re-checking after a first-attempt failure.
let criticalIndexesReady = false;
async function ensureCriticalIndexes() {
  if (criticalIndexesReady) return;
  const RoommateMatch = require('./models/RoommateMatch');
  const RoommateProfile = require('./models/RoommateProfile');
  const Notification = require('./models/Notification');
  const DormInquiry = require('./models/DormInquiry');
  // HousingRequestDedupClaim's unique index on `identityKey` is not an
  // optional performance index - it IS the atomic-deduplication mechanism
  // (see services/housingRequestDedupClaim.js). Without it,
  // HousingRequestDedupClaim.create() never throws E11000 on a concurrent
  // duplicate, and every racer silently "wins," which is exactly the bug
  // this collection exists to prevent. Distinct from the proposed
  // DormInquiry performance indexes (deliberately NOT added as `.index()`
  // calls on that schema yet, pending explicit approval) - this one is
  // required for correctness from the moment this feature is live at all.
  const HousingRequestDedupClaim = require('./models/HousingRequestDedupClaim');
  // syncIndexes() (not init()) deliberately - init()'s build promise is
  // cached on the model after first use and does not reliably re-attempt on
  // a later call, which matters here because this function itself gets
  // called again on every connectDB() invocation until it succeeds.
  await RoommateMatch.syncIndexes();
  await RoommateProfile.syncIndexes();
  await Notification.syncIndexes();
  await DormInquiry.syncIndexes();
  await HousingRequestDedupClaim.syncIndexes();
  criticalIndexesReady = true;
}

// Register mongoose error listeners immediately (before any connect attempt)
// so that auth failures never become unhandled 'error' events that crash the process
if (!mongoose.connection.__hasListeners) {
  mongoose.connection.__hasListeners = true;
  mongoose.connection.on('error', (err) => {
    console.error('❌ MongoDB connection error:', err.message);
  });
  mongoose.connection.on('disconnected', () => {
    console.warn('⚠️ MongoDB disconnected');
    cachedConn = null;
  });
}

const connectDB = async () => {
  try {
    // If already connected, reuse it - but still confirm critical indexes
    // before handing the connection back (see ensureCriticalIndexes above:
    // this is what makes a first-attempt index failure keep failing on every
    // later request instead of silently succeeding once readyState is 1).
    if (mongoose.connection.readyState === 1) {
      await ensureCriticalIndexes();
      return mongoose.connection;
    }

    // If currently connecting, wait for it instead of calling connect() again
    if (mongoose.connection.readyState === 2) {
      await new Promise((resolve, reject) => {
        mongoose.connection.once('connected', resolve);
        mongoose.connection.once('error', reject);
      });
      await ensureCriticalIndexes();
      cachedConn = mongoose.connection;
      return cachedConn;
    }

    let mongoUri = process.env.MONGODB_URI;

    if (!mongoUri) {
      throw new Error('MONGODB_URI environment variable is not set.');
    }

    // On production/serverless, never try local/in-memory DB fallback
    const isLocal =
      mongoUri.includes('localhost') ||
      mongoUri.includes('127.0.0.1');

    if (process.env.NODE_ENV === 'production' && isLocal) {
      throw new Error('Production MONGODB_URI cannot be localhost/127.0.0.1. Use MongoDB Atlas URI.');
    }

    // Keep your in-memory DB only for local dev
    if (isLocal && process.env.NODE_ENV !== 'production') {
      try {
        const { getMemoryDbUri, seedAdminUser } = require('./utils/devDb');
        mongoUri = await getMemoryDbUri();
        process.env.MONGODB_URI = mongoUri;

        await mongoose.connect(mongoUri, {
          maxPoolSize: 10,
          serverSelectionTimeoutMS: 5000,
          socketTimeoutMS: 45000,
        });

        console.log('✅ In-memory MongoDB connected successfully');

        // Seed admin user for development
        await seedAdminUser(mongoose);

      } catch (memError) {
        console.error('❌ In-memory DB setup failed:', memError.message);
        throw new Error('No valid MongoDB connection available');
      }
    } else {
      await mongoose.connect(mongoUri, {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 15000,
        socketTimeoutMS: 45000,
        connectTimeoutMS: 15000,
      });

      console.log('✅ MongoDB connected successfully');
    }

    await ensureCriticalIndexes();

    cachedConn = mongoose.connection;
    return cachedConn;

  } catch (err) {
    console.error('❌ MongoDB connection error:', err.message);
    throw err;
  }
};

// Connect once when the function/container initializes.
connectDB().catch((err) => {
  if (process.env.VERCEL) {
    // Swallow on serverless: process.exit() would kill the whole function
    // container, not just this cold start, and the per-request /api
    // middleware below already re-attempts (and re-verifies critical
    // indexes) on every request, so a transient failure here self-heals.
    return;
  }
  // Outside serverless (Passenger, or `node server.js` directly), a failed
  // first connection - including a failed critical-index build, see
  // ensureCriticalIndexes() above - is not something to silently paper over
  // with per-request 503s. Fail loudly and let the process supervisor
  // (Passenger) restart it, rather than running indefinitely in a state
  // where safety-critical uniqueness guarantees might not be enforced.
  console.error('FATAL: startup database connection/index verification failed:', err.message);
  _step(`FATAL startup DB error: ${err.message}`);
  process.exit(1);
});

// ============================================
// DB CONNECTION MIDDLEWARE
// ============================================

// Ensure DB is connected before any API route (handles cold starts with bufferCommands=false)
app.use('/api', async (req, res, next) => {
  if (req.path === '/health') return next(); // skip for health check
  
  // In development mode, allow test login even without DB
  if (process.env.NODE_ENV !== 'production' && req.path === '/auth/login' && req.method === 'POST') {
    return next(); // Skip DB check for test login
  }
  
  try {
    await connectDB();
    next();
  } catch (err) {
    res.status(503).json({ success: false, message: 'Database unavailable. Please try again in a moment.' });
  }
});

// ============================================
// ROUTES
// ============================================

function safeRoute(path, modulePath) {
  try {
    app.use(path, require(modulePath));
  } catch (e) {
    console.error(`[startup] Failed to load route ${modulePath}:`, e.message);
    _logStartupError(modulePath, e);
    app.use(path, (req, res) => res.status(503).json({ success: false, message: `Route temporarily unavailable: ${path}` }));
  }
}

// Temporary email diagnostics endpoint — remove after fixing email issue
app.get('/api/test-email', async (req, res) => {
  const to = req.query.to || process.env.ADMIN_EMAIL;
  const result = { env: {
    RESEND_API_KEY: process.env.RESEND_API_KEY ? '✅ set' : '❌ missing',
    RESEND_FROM: process.env.RESEND_FROM || '❌ missing',
    EMAIL_USER: process.env.EMAIL_USER || '❌ missing',
    EMAIL_PASS: process.env.EMAIL_PASS ? `✅ set (${process.env.EMAIL_PASS.length} chars)` : '❌ missing',
    NODE_ENV: process.env.NODE_ENV
  }};
  try {
    const { sendVerificationEmail } = require('./utils/email');
    await sendVerificationEmail(to, 'Test', '123456', 'code');
    result.emailSent = true;
    result.sentTo = to;
  } catch (e) {
    result.emailSent = false;
    result.error = e.message;
  }
  res.json(result);
});

safeRoute('/api/auth', './routes/auth');
safeRoute('/api/auth', './routes/googleAuth');
safeRoute('/api/enquiries', './routes/enquiries');
safeRoute('/api/inquiries', './routes/inquiries');

// WhatsApp webhook (verify + receive)
try {
  const { webhookVerify, webhookReceive } = require('./services/whatsapp');
  app.get('/api/webhooks/whatsapp',  webhookVerify);
  app.post('/api/webhooks/whatsapp', express.json(), webhookReceive);
} catch (e) {
  console.error('[startup] Failed to load whatsapp service:', e.message);
  _logStartupError('whatsapp', e);
}

safeRoute('/api/dorms', './routes/dorms');
safeRoute('/api/dorm-inquiries', './routes/dormInquiries');
// New admin-mediated housing-request flow - deliberately a separate mount
// from /api/dorm-inquiries above, not a branch inside it. See the header
// comment on routes/housingRequests.js for why.
safeRoute('/api/housing-requests', './routes/housingRequests');
// Internal, cron-only endpoints (own auth via X-Internal-Cron-Secret, not
// the normal JWT flow - see middleware/internalAuth.js). Never linked from
// the admin UI.
safeRoute('/api/internal/dorm-follow-ups', './routes/internal/dormFollowUps');
safeRoute('/api/reviews', './routes/reviews');
safeRoute('/api/users', './routes/users');
safeRoute('/api/messages', './routes/messages');
safeRoute('/api/analytics', './routes/analytics');
safeRoute('/api/roommate', './routes/roommate');
safeRoute('/api/notifications', './routes/notifications');
// Block/report routes existed but were never mounted here - the frontend's
// report button has been calling POST /api/reports and 404ing in production.
safeRoute('/api/block', './routes/block');
safeRoute('/api/reports', './routes/report');
safeRoute('/api/blog', './routes/blog');
safeRoute('/api/questions', './routes/questions');
safeRoute('/api/badges', './routes/badges');
safeRoute('/api/seo', './routes/seo');
safeRoute('/api/verification', './routes/verification');

// Property Submission Routes (landlords)
safeRoute('/api/property-requests', './routes/propertyRequests');

// Stripe subscription routes (checkout, status, cancel, billing portal)
safeRoute('/api/stripe', './routes/stripe');

// Admin Dashboard Routes (full suite: dorms, users, reviews, analytics, etc.)
safeRoute('/api/admin', './routes/admin/index');

// Dynamic public listing page for database-backed Dorm records (see
// frontend/property-detail.html + frontend/js/property-detail.js, which
// already handled the static properties.js-driven case and was extended to
// also fetch /api/dorms/slug/:slug when loaded from this path). Served
// directly here, ahead of the static-file middleware below, since it isn't
// a real file on disk.
//
// SEO fix: this used to be an unconditional res.sendFile() of the generic
// template regardless of :slug, which is why every listing's pre-JS <head>
// (title/description/canonical) was identical and pointed at
// /property-detail.html instead of its own URL - see routes/dormSeo.js's
// own comment for the full root-cause writeup and proof. The handler below
// does one Dorm lookup (reused for the redirect check, the noindex
// decision, and the metadata - never queried twice) and injects real
// per-listing tags into the same template before sending it; the
// client-side fetch of /api/dorms/slug/:slug and property-detail.js's own
// rendering are completely unchanged.
//
// frontendPath is declared further down this file (module-level const),
// but by the time any request actually reaches this handler the whole
// module has already finished loading, so the closure sees it fine.
const { createDormSeoHandler } = require('./routes/dormSeo');
app.get('/logement/:slug', createDormSeoHandler({
  DormModel: require('./models/Dorm'),
  // A function, not the value itself: frontendPath is declared later in
  // this same file (see comment above), so it must be read lazily at
  // request time, never destructured here at module-load time.
  getFrontendPath: () => frontendPath,
}));

// Same pattern for the roommate profile-view page: :publicProfileId is the
// opaque id from RoommateProfile (never the internal Mongo userId - see
// roommateController.js's stripInternalId). find-roommate-profile-view.js
// reads it back out of the URL path itself, not a query string.
app.get('/colocataires/:publicProfileId', (req, res) => {
  res.sendFile(path.join(frontendPath, 'find-roommate-profile-view.html'));
});

// SEO Routes - Serve at root level for search engines
app.get('/sitemap.xml', (req, res) => {
  require('./routes/seo').handle(req, res);
});
app.get('/robots.txt', (req, res) => {
  const seoUtils = require('./utils/seo');
  const baseUrl = process.env.BASE_URL || 'https://www.roastmydorm.com';
  res.set('Content-Type', 'text/plain');
  res.send(seoUtils.generateRobotsTxt(baseUrl));
});

// Health check endpoint — minimal public info, full info for internal callers only
app.get('/api/health', async (req, res) => {
  const isInternal = req.headers['x-internal-key'] === process.env.HEALTH_SECRET;
  let dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';

  if (mongoose.connection.readyState !== 1) {
    try { await connectDB(); dbStatus = 'connected'; } catch (_) { dbStatus = 'disconnected'; }
  }

  // Public response — no sensitive info
  const publicResponse = {
    status: dbStatus === 'connected' ? 'OK' : 'DEGRADED',
    timestamp: new Date().toISOString()
  };

  if (!isInternal) {
    return res.status(dbStatus === 'connected' ? 200 : 503).json(publicResponse);
  }

  // Internal/admin callers get full diagnostics
  res.json({
    ...publicResponse,
    environment: process.env.NODE_ENV || 'development',
    uptime: process.uptime(),
    memoryUsage: process.memoryUsage(),
    database: dbStatus
  });
});

// Liveness: the Node process itself is up. Deliberately touches nothing
// else (no DB), so it can never be dragged down by a database problem -
// that's what /health/ready is for.
app.get('/health/live', (req, res) => {
  res.status(200).json({ status: 'OK' });
});

// Readiness: essential dependencies (MongoDB) are actually available. Does
// not attempt a reconnect (unlike /api/health) - a readiness probe should
// answer immediately with the current state, not spend a request trying to
// fix it.
app.get('/health/ready', (req, res) => {
  const ready = mongoose.connection.readyState === 1;
  res.status(ready ? 200 : 503).json({ status: ready ? 'OK' : 'NOT_READY' });
});

// ============================================
// STATIC FILES (Production)
// ============================================

// Serve uploaded listing photos. Configurable root (see
// utils/dormImageStorage.js) so it can point outside this app's own
// directory if a deploy ever wipes/replaces it.
app.use('/uploads', express.static(
  process.env.DORM_UPLOAD_ROOT || path.join(__dirname, 'uploads'),
  { maxAge: '30d' }
));

// Serve frontend static files - see config/staticRoot.js for why this is
// resolved from one shared function instead of a hardcoded path here.
const frontendPath = require('./config/staticRoot').resolveStaticRoot();

// Startup hygiene: sweep any sitemap.xml.tmp-* file left behind by a
// process that was killed between writeFileSync and renameSync in a
// previous run (see utils/sitemapGenerator.js's writeFileAtomic). These
// are already harmless - never served, never read back - this just stops
// them accumulating across repeated crashes/restarts. Never touches
// sitemap.xml itself.
try {
  const removed = require('./utils/sitemapGenerator').cleanupStaleTempFiles(
    path.join(frontendPath, 'sitemap.xml')
  );
  if (removed.length) {
    console.log(`[sitemap] Removed ${removed.length} stale temp file(s) from a previous process: ${removed.join(', ')}`);
  }
} catch (err) {
  console.error('[sitemap] Stale temp file cleanup failed (non-fatal):', err.message);
}

app.use(express.static(frontendPath, {
  maxAge: '30d',
  setHeaders: (res, filePath) => {
    if (/\.(js|css|webp|png|jpe?g|svg|ico|woff2?|ttf)$/i.test(filePath)) {
      res.setHeader('Cache-Control', 'public, max-age=2592000, immutable');
    }
    // Token-bearing response pages - the token itself lives only in a URL
    // fragment (never sent to any server) and this page never links out to
    // a third-party origin, but Referrer-Policy is set here too as
    // defense-in-depth alongside the page's own <meta name="referrer">.
    if (/(^|[\\/])(landlord-followup|dorm-followup)\.html$/i.test(filePath)) {
      res.setHeader('Referrer-Policy', 'no-referrer');
      // Overrides the outer maxAge:'30d' above - a page whose URL fragment
      // carries a one-time credential must never be served from a shared
      // or browser disk cache.
      res.setHeader('Cache-Control', 'no-store');
    }
    // landlord-followup.html specifically: tighter than the app-wide helmet
    // CSP in the security-middleware section above (which allows a couple
    // of things - openstreetmap frameSrc, broad imgSrc - this page needs
    // none of). frame-ancestors is the CSP-native anti-clickjacking
    // control; X-Frame-Options is the same protection for older browsers
    // that don't read frame-ancestors.
    if (/(^|[\\/])landlord-followup\.html$/i.test(filePath)) {
      res.setHeader('Content-Security-Policy', [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com",
        "font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com",
        "img-src 'self' data:",
        "connect-src 'self'",
        "frame-ancestors 'none'",
        "base-uri 'none'",
        "form-action 'self'",
      ].join('; '));
      res.setHeader('X-Frame-Options', 'DENY');
    }
  }
}));
// ============================================
// 404 HANDLING (must come after API routes and the static-file middleware
// above, so it only ever catches genuinely unmatched requests)
// ============================================

// Unmatched /api/* requests get a JSON 404, not the HTML error page - an API
// client shouldn't have to parse HTML to find out its endpoint doesn't exist.
app.use('/api', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found'
  });
});

// Static asset extensions that express.static above didn't find should 404
// for real (JSON/plain), never with 404.html's HTML body - a <script src>
// or <link href> pointing at a missing file must not get back an HTML
// document, or the browser's strict MIME-type check blocks it outright
// (this is the exact bug that silently broke script.js and the whole js/
// folder in production earlier this project: a missing .js file was being
// served as text/html with a 200 status). This check has to stay separate
// from the generic HTML 404 handler below it.
const STATIC_ASSET_RE = /\.(js|css|webp|png|jpe?g|svg|ico|woff2?|ttf|json|xml|txt|map)$/i;
app.use((req, res, next) => {
  if (!STATIC_ASSET_RE.test(req.path)) return next();
  res.status(404).type('text/plain').send('Not found');
});

// Everything else unmatched is a genuinely unknown page - this is a fully
// static multi-page site (each real page is its own .html file already
// matched by express.static above), not a client-side-routed app, so there
// is no SPA-style index.html fallback here on purpose. Serve the real 404
// page with a real 404 status instead of quietly returning the homepage
// with 200.
//
// NOTE ON THE PATH BELOW: this deployment's production web root is NOT
// "../frontend" relative to this file - it's "../public_html" (see
// `frontendPath` above, and frontend/.htaccess's PassengerAppRoot, which
// point at .../nodejs as this app's own folder with public_html as its
// sibling). `frontendPath` already resolves correctly for both local dev
// and production; reusing it here (rather than hardcoding a relative path)
// is what makes this correct in both places without manual verification
// per environment.
app.use((req, res) => {
  res.status(404).sendFile(path.join(frontendPath, '404.html'), (err) => {
    if (err) res.status(404).type('text/plain').send('Not found');
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Error:', {
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString()
  });

  const statusCode = err.statusCode || 500;
  const response = {
    success: false,
    message: (err.isOperational || process.env.NODE_ENV !== 'production')
      ? err.message
      : 'An unexpected error occurred'
  };

  if (process.env.NODE_ENV === 'development') {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
});

// ============================================
// GRACEFUL SHUTDOWN
// ============================================

const gracefulShutdown = async (signal) => {
  console.log(`\n${signal} received. Starting graceful shutdown...`);

  try {
    await mongoose.connection.close();
    console.log('✅ MongoDB connection closed');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error during shutdown:', err);
    process.exit(1);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  // Do NOT call process.exit(1) in serverless — it kills the entire function container
});

// ============================================
// START SERVER
// ============================================

const PORT = process.env.PORT || 5000;

// Skip only on Vercel's serverless runtime, which imports `app` directly and
// manages the request lifecycle itself. Everywhere else — including Hostinger's
// Passenger, which requires this file through its own harness rather than
// running `node server.js` directly — `require.main === module` is false even
// though the app must still bind a real port, so that check can't be used here.
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV}`);
  }).on('error', (err) => {
    console.error('Server error:', err.message);
  });

  // Deploy-packaging note: the in-process dorm-follow-up scheduler start
  // call (services/dormFollowUpScheduler.js) is intentionally NOT included
  // in this deploy. That module's own dependency closure (dormFollowUpProcessor,
  // landlordOutcomeResolver, dormFollowUpQueries, CronLock, followUpToken)
  // belongs to the legacy dorm-inquiry follow-up flow, which is out of scope
  // for this controlled deploy and must stay disabled per standing
  // instruction. Since ENABLE_DORM_FOLLOWUP_SCHEDULER is unset in
  // production, calling startDormFollowUpScheduler() here would have been a
  // no-op anyway (see isSchedulerEnabled()) - omitting the call changes no
  // runtime behavior, it only avoids a require() of files not shipped in
  // this deploy.
}

// ============================================
// EXPORT APP (for Vercel)
// ============================================

// Exposed for tests only (see tests/serverIndexFailure.test.js) - lets a
// test deterministically await the real connection/index-verification
// promise instead of guessing with a fixed setTimeout, which was flaky
// under parallel test-suite load.
app._connectDB = connectDB;

module.exports = app;