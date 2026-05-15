const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');
const path = require('path');

require('dotenv').config();

const app = express();

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

// Rate limiting - General
const generalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 100,
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === '/api/health'
});

// Stricter rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per 15 minutes
  message: {
    success: false,
    message: 'Too many login attempts, please try again after 15 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false
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
const { webhookHandler: stripeWebhookHandler } = require('./routes/stripe');
app.post(
  '/api/stripe/webhook',
  express.raw({ type: 'application/json', limit: '1mb' }),
  stripeWebhookHandler
);

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
    // If already connected, reuse it
    if (mongoose.connection.readyState === 1) {
      return mongoose.connection;
    }

    // If currently connecting, wait for it instead of calling connect() again
    if (mongoose.connection.readyState === 2) {
      await new Promise((resolve, reject) => {
        mongoose.connection.once('connected', resolve);
        mongoose.connection.once('error', reject);
      });
      cachedConn = mongoose.connection;
      return cachedConn;
    }

    let mongoUri = process.env.MONGODB_URI;

    if (!mongoUri) {
      throw new Error('MONGODB_URI is missing. Set it in .env locally and in Vercel Environment Variables.');
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
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      });

      console.log('✅ MongoDB connected successfully');
    }

    cachedConn = mongoose.connection;
    return cachedConn;

  } catch (err) {
    console.error('❌ MongoDB connection error:', err.message);
    throw err;
  }
};

// Connect once when the function/container initializes.
// If it fails, it will throw; your routes should handle DB-dependent operations accordingly.
connectDB().catch(() => {
  // swallow here to avoid crashing immediately on cold start;
  // DB-dependent endpoints will still error and logs will show why.
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

app.use('/api/auth', require('./routes/auth'));
app.use('/api/dorms', require('./routes/dorms'));
app.use('/api/reviews', require('./routes/reviews'));
app.use('/api/users', require('./routes/users'));
app.use('/api/messages', require('./routes/messages'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/roommate', require('./routes/roommate'));
app.use('/api/blog', require('./routes/blog'));
app.use('/api/questions', require('./routes/questions'));
app.use('/api/badges', require('./routes/badges'));
app.use('/api/seo', require('./routes/seo'));
app.use('/api/verification', require('./routes/verification'));

// Property Submission Routes (landlords)
app.use('/api/property-requests', require('./routes/propertyRequests'));

// Stripe subscription routes (checkout, status, cancel, billing portal)
app.use('/api/stripe', require('./routes/stripe'));

// Admin Dashboard Routes (full suite: dorms, users, reviews, analytics, etc.)
app.use('/api/admin', require('./routes/admin/index'));

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

// ============================================
// STATIC FILES (Production)
// ============================================

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'client/build')));

  app.get('*', (req, res, next) => {
    // Skip API routes
    if (req.path.startsWith('/api')) {
      return next();
    }
    res.sendFile(path.join(__dirname, 'client/build', 'index.html'));
  });
}

// ============================================
// ERROR HANDLING
// ============================================

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
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
// START LOCAL SERVER (for local development)
// ============================================

const PORT = process.env.PORT || 5000;

// Only start server if running locally (not in Vercel/serverless)
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV}`);
  }).on('error', (err) => {
    console.error('Server error:', err.message);
  });
}

// ============================================
// EXPORT APP (for Vercel)
// ============================================

module.exports = app;