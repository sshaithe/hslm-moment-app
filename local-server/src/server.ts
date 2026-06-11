import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { checkConnection } from './db';

// ─── Routes ───────────────────────────────────────────────────────────────────
import backblazeRouter from './routes/backblaze';
import mediaRouter from './routes/media';
import weddingRouter from './routes/wedding';
import uploadsRouter from './routes/uploads';
import guestsRouter from './routes/guests';
import commentsRouter from './routes/comments';
import reactionsRouter from './routes/reactions';
import adminRouter from './routes/admin';

// ─── Load .env ────────────────────────────────────────────────────────────────
dotenv.config();

const app = express();
// Trust Cloudflare Tunnel proxy to get the real guest IPs for rate limiting
app.set('trust proxy', 1);
const PORT = parseInt(process.env.PORT || '4000', 10);

// ─── Logging ──────────────────────────────────────────────────────────────────
// Log to console. In production, you can pipe to a file:
//   npm run start 2>&1 | tee logs/server.log
app.use(morgan('[:date[iso]] :method :url :status :response-time ms - :res[content-length]'));

// ─── Security headers ─────────────────────────────────────────────────────────
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

// ─── CORS ─────────────────────────────────────────────────────────────────────
// Origins from .env — comma-separated. Only these origins can call the API.
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. curl, Postman, mobile apps)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error(`CORS blocked: origin '${origin}' is not allowed`));
    },
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Guest-Session', 'x-guest-session'],
    credentials: false,
  })
);

// ─── Body parsing ─────────────────────────────────────────────────────────────
// 1MB limit for JSON (metadata only — media never passes through)
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// ─── Rate limiting ────────────────────────────────────────────────────────────
// Layered rate limiting for Wi-Fi NAT (NAT IP sharing bypass):
// - Authenticated guests (have X-Guest-Session header): 600 req / 15 min per guest.
// - Anonymous requests (no header): 2500 req / 15 min per IP (large pool for NAT share).
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: (req) => {
    return req.headers['x-guest-session'] ? 600 : 2500;
  },
  keyGenerator: (req) => {
    return (req.headers['x-guest-session'] as string) || req.ip || '';
  },
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again in a few minutes.' },
});

// Admin auth: strict per-IP — 20 req / 15 min per IP
const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many admin login attempts. Please wait 15 minutes.' },
});

// Comments rate limiter (prevent database spamming): 10 comments / 1 min per guest/IP
const commentsLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 10,
  keyGenerator: (req) => {
    return (req.headers['x-guest-session'] as string) || req.ip || '';
  },
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many comments. Please wait a minute.' },
});

if (process.env.DISABLE_RATE_LIMITER !== 'true') {
  app.use('/api/admin/login', adminLimiter);
  app.use('/api/comments', commentsLimiter);
  app.use('/api', generalLimiter);
} else {
  console.log('[Server] Load testing mode: Rate limiters are DISABLED.');
}

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/api/health', async (_req, res) => {
  const dbOk = await checkConnection();
  const status = dbOk ? 200 : 503;
  res.status(status).json({
    status: dbOk ? 'ok' : 'db_unavailable',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
  });
});

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/get-upload-url', backblazeRouter);
app.use('/api/media', mediaRouter);
app.use('/api/wedding', weddingRouter);
app.use('/api/update-settings', (req, res, next) => {
  // Alias for backward compat — POST /api/update-settings → wedding router
  req.url = '/update-settings';
  weddingRouter(req, res, next);
});
app.use('/api/uploads', uploadsRouter);
app.use('/api/update-upload', (req, res, next) => {
  req.url = '/update-upload';
  uploadsRouter(req, res, next);
});
app.use('/api/delete-file', (req, res, next) => {
  req.url = '/delete-file';
  uploadsRouter(req, res, next);
});
app.use('/api/message-wall', (req, res, next) => {
  req.url = '/message-wall';
  uploadsRouter(req, res, next);
});
app.use('/api/guests', guestsRouter);
app.use('/api/update-guest', (req, res, next) => {
  req.url = '/update-guest';
  guestsRouter(req, res, next);
});
app.use('/api/admin/guests', (req, res, next) => {
  req.url = '/admin';
  guestsRouter(req, res, next);
});
app.use('/api/admin/uploads', (req, res, next) => {
  req.url = '/admin';
  uploadsRouter(req, res, next);
});
app.use('/api/comments', commentsRouter);
app.use('/api/reactions', reactionsRouter);
app.use('/api/admin', adminRouter);

// ─── 404 handler ─────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

// ─── Global error handler ─────────────────────────────────────────────────────
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[Server] Unhandled error:', err.message);
  if (err.message?.startsWith('CORS blocked')) {
    res.status(403).json({ error: err.message });
    return;
  }
  res.status(500).json({ error: 'Internal server error' });
});

// ─── Start server ─────────────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', async () => {
  console.log(`\n╔══════════════════════════════════════════════╗`);
  console.log(`║  VowVault Local Server (Plan B)              ║`);
  console.log(`║  Running on http://localhost:${PORT}             ║`);
  console.log(`╚══════════════════════════════════════════════╝\n`);

  const dbOk = await checkConnection();
  if (dbOk) {
    console.log(`✅ PostgreSQL connected successfully`);
  } else {
    console.error(`❌ PostgreSQL connection FAILED — check DATABASE_URL in .env`);
  }

  console.log(`\n  Allowed origins: ${allowedOrigins.join(', ')}`);
  console.log(`  Health check:   GET http://localhost:${PORT}/api/health\n`);
});

export default app;
