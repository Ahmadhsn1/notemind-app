const crypto = require('crypto');
global.crypto = crypto;

const env = require('./config/env');

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const pinoHttp = require('pino-http');
const mongoose = require('mongoose');

const logger = require('./services/logger');
const authRoutes = require('./routes/authRoutes');
const noteRoutes = require('./routes/noteRoutes');
const flashcardRoutes = require('./routes/flashcardRoutes');
const adminRoutes = require('./routes/adminRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const resurfaceRoutes = require('./routes/resurfaceRoutes');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');
const { globalLimiter } = require('./middleware/rateLimit');
const { uploadsRouter } = require('./services/uploadStorage');

// The Express app only — no listening, no DB connection, no Socket.IO. Kept
// separate from server.js so tests can mount it with Supertest against an
// in-memory MongoDB without the process trying to bind a port or dial the
// real database on import.
const app = express();

// Required before any IP-based logic. Every PaaS terminates TLS at a proxy,
// so without this req.ip is the *proxy's* address for every request — which
// turned authLimiter's 20-per-15-minutes into a single global bucket that one
// client could exhaust to lock out login for the entire user base. Set to 1
// (not `true`) so only the platform's own proxy is trusted and a client can't
// spoof X-Forwarded-For to dodge limits.
app.set('trust proxy', 1);

// Request logs are noise in test output and the assertions are the signal.
if (env.NODE_ENV !== 'test') {
  app.use(pinoHttp({
    logger,
    // Health checks are the noisiest requests in any deployment and carry no
    // information — logging them buries everything else.
    autoLogging: { ignore: (req) => req.url === '/healthz' },
    customLogLevel: (req, res, err) => {
      if (err || res.statusCode >= 500) return 'error';
      if (res.statusCode >= 400) return 'warn';
      return 'info';
    },
  }));
}

app.use(helmet());
app.use(compression());
app.use(cors({ origin: env.allowedOrigins, exposedHeaders: ['Content-Disposition'] }));
app.use(express.json({ limit: '1mb' }));

// Liveness/readiness for the platform's health check. Registered before the
// limiter and the routers so a probe is never rate-limited, and before
// notFoundHandler — previously a probe to any such path got a 404, which
// makes an orchestrator restart-loop a perfectly healthy container.
app.get('/healthz', (req, res) => {
  const dbUp = mongoose.connection.readyState === 1;
  res.status(dbUp ? 200 : 503).json({
    status: dbUp ? 'ok' : 'degraded',
    db: dbUp ? 'connected' : 'disconnected',
    uptime: Math.round(process.uptime()),
  });
});

// Rate limiting is disabled under test: the limits are shared state in Mongo,
// so a suite making dozens of auth requests would trip them and fail runs
// non-deterministically depending on test order. The limiters have their own
// dedicated test.
if (env.NODE_ENV !== 'test') {
  app.use('/api', globalLimiter);
}

// Ownership-gated rather than express.static: see services/uploadStorage.js.
app.use('/uploads', uploadsRouter);

app.use('/api/auth', authRoutes);
app.use('/api/notes', noteRoutes);
app.use('/api/flashcards', flashcardRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/resurface', resurfaceRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
