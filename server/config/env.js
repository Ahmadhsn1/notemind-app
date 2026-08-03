const path = require('path');

// Anchored to the server directory rather than process.cwd(). dotenv's default
// is cwd-relative, so `node server/scripts/check-data-integrity.js` from the
// repo root found no .env and died on "MONGO_URI: expected string" — which
// reads like a missing variable rather than a wrong working directory.
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { z } = require('zod');

// Single validated view of process.env, imported before anything else in
// server.js so a misconfigured deploy dies at boot with a readable message
// instead of booting "successfully" and failing at runtime.
//
// The motivating case: a typo'd JWT_SECRET used to bind the port, pass the
// platform health check, and then return 500 on every login and 401 on every
// authenticated request — a total outage that looked like a healthy deploy.
//
// Optional-but-paired variables are cross-checked at the bottom, since half a
// feature's config is worse than none of it (Google sign-in configured on the
// server but not the client renders a button that can only fail).

const csv = (value) => value.split(',').map((s) => s.trim()).filter(Boolean);

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(5000),

  MONGO_URI: z.string().min(1, 'MONGO_URI is required (MongoDB connection string)'),

  // 16 everywhere catches genuinely weak secrets (jsonwebtoken will happily
  // sign with "dev"); production additionally requires 32 — see below. The
  // split exists so tightening the bar doesn't break an existing local setup
  // mid-session, since rotating this value invalidates every issued token.
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),

  // Comma-separated allowlist of browser origins. Required in production:
  // the old `|| 'http://localhost:5173'` fallback meant a deploy that forgot
  // it blocked every request via CORS with nothing in the logs.
  CLIENT_URL: z.string().optional(),

  GEMINI_API_KEY: z.string().optional(),
  GEMINI_API_KEYS: z.string().optional(),

  GOOGLE_CLIENT_ID: z.string().optional(),

  DAILY_AI_CALL_LIMIT: z.coerce.number().int().positive().default(200),

  // Cloudflare R2 (S3-compatible). All four must be present together or
  // uploads fall back to local disk — see services/uploadStorage.js.
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET: z.string().optional(),

  // Transactional email (Resend). Both together or neither — with them unset
  // the reset flow still works end to end, but the message is logged rather
  // than sent (see services/email.js), which is what makes it developable
  // without credentials.
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(),

  SENTRY_DSN: z.string().optional(),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const lines = parsed.error.issues.map((i) => `  - ${i.path.join('.') || 'env'}: ${i.message}`);
  console.error(`\nInvalid environment configuration:\n${lines.join('\n')}\n`);
  process.exit(1);
}

const env = parsed.data;
const isProduction = env.NODE_ENV === 'production';

const fatal = (message) => {
  console.error(`\nInvalid environment configuration:\n  - ${message}\n`);
  process.exit(1);
};

if (isProduction && !env.CLIENT_URL) {
  fatal('CLIENT_URL is required in production (comma-separated list of allowed browser origins)');
}

if (isProduction && env.JWT_SECRET.length < 32) {
  fatal('JWT_SECRET must be at least 32 characters in production — generate one with: openssl rand -base64 48');
}

const geminiKeys = env.GEMINI_API_KEYS ? csv(env.GEMINI_API_KEYS) : (env.GEMINI_API_KEY ? [env.GEMINI_API_KEY] : []);

const emailParts = [env.RESEND_API_KEY, env.EMAIL_FROM];
if (emailParts.some(Boolean) && !emailParts.every(Boolean)) {
  fatal('Email is partially configured — set both RESEND_API_KEY and EMAIL_FROM, or neither');
}

const r2Parts = [env.R2_ACCOUNT_ID, env.R2_ACCESS_KEY_ID, env.R2_SECRET_ACCESS_KEY, env.R2_BUCKET];
const r2Configured = r2Parts.every(Boolean);
if (r2Parts.some(Boolean) && !r2Configured) {
  fatal('R2 is partially configured — set all of R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, or none of them');
}
if (isProduction && !r2Configured) {
  // Local disk on a container platform is wiped on every deploy, silently
  // breaking every image any user ever pasted. Refusing to boot is kinder
  // than discovering it after the first redeploy.
  fatal('R2 storage must be configured in production — local disk uploads do not survive a redeploy');
}

module.exports = {
  ...env,
  isProduction,
  allowedOrigins: env.CLIENT_URL ? csv(env.CLIENT_URL) : ['http://localhost:5173'],
  geminiKeys,
  aiEnabled: geminiKeys.length > 0,
  r2Configured,
};
