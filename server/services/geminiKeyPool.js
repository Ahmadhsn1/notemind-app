const { GoogleGenAI } = require('@google/genai');
const env = require('../config/env');
const logger = require('./logger');

// GEMINI_API_KEYS is the multi-key form (comma-separated, however many keys
// you have — 1 or 10+, doesn't matter); GEMINI_API_KEY is kept working as a
// single-key fallback so existing setups don't need to change anything.
// Both are resolved in config/env.js.
const rawKeys = env.geminiKeys;

// Deliberately NOT a throw. This module is required transitively by
// noteRoutes -> server.js, so throwing here took down the entire
// application — notes CRUD, login, everything — because one optional
// integration's key was missing or had been rotated. AI features degrade
// instead: getClient() throws per-request, which the callers already handle
// as "AI unavailable" (aiService's retry/fallback paths, and
// deriveContentFields' best-effort embedding).
if (rawKeys.length === 0) {
  logger.warn('No Gemini API key configured — AI features are disabled (set GEMINI_API_KEY or GEMINI_API_KEYS)');
}

// One entry per configured key: a cached client (no reason to reconstruct
// GoogleGenAI on every call) plus cooldownUntil, set only when THIS key hits
// a quota error — a key that's fine keeps serving requests even while
// others are cooling down.
const pool = rawKeys.map((key, i) => ({
  key,
  label: `Gemini key #${i + 1}`,
  client: new GoogleGenAI({ apiKey: key }),
  cooldownUntil: 0,
}));

if (pool.length > 0) {
  logger.info(`Gemini key pool: ${pool.length} key${pool.length === 1 ? '' : 's'}`);
}

let cursor = -1;

// Gemini's free tier resets daily quotas at midnight Pacific time — computed
// via Intl with an IANA zone so it's correct across the PST/PDT DST
// boundary without a date library.
const getNextPacificMidnightMs = () => {
  const now = new Date();
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  });
  const parts = Object.fromEntries(fmt.formatToParts(now).map((p) => [p.type, p.value]));
  const secondsUntilMidnight = 24 * 3600 - (Number(parts.hour) * 3600 + Number(parts.minute) * 60 + Number(parts.second));
  return now.getTime() + secondsUntilMidnight * 1000 + 1000; // +1s past the boundary, not exactly on it
};

// A per-day quota (the free tier's real limit, e.g. "20 requests/day") won't
// be usable again just because Google's own `retryDelay` hint says a few
// seconds — that hint is a generic rate-limiter backoff, not the quota's
// actual reset time. The quotaId is what actually decides how long this key
// needs to sit out: "PerDay" waits for the next Pacific midnight, anything
// else (PerMinute, or unrecognized) uses a short cooldown instead.
const cooldownMsFor = (err) => {
  let quotaId = '';
  let retryDelayMs = 60_000;
  try {
    const parsed = JSON.parse(err.message).error;
    const quotaFailure = parsed.details?.find((d) => d['@type']?.includes('QuotaFailure'));
    quotaId = quotaFailure?.violations?.[0]?.quotaId || '';
    const retryInfo = parsed.details?.find((d) => d['@type']?.includes('RetryInfo'));
    if (retryInfo?.retryDelay) {
      const secs = parseFloat(retryInfo.retryDelay);
      if (!Number.isNaN(secs)) retryDelayMs = secs * 1000;
    }
  } catch {
    // Unparseable error body — fall through to the retryDelayMs default above.
  }

  if (quotaId.includes('PerDay')) return getNextPacificMidnightMs() - Date.now();
  if (quotaId.includes('PerMinute')) return Math.max(retryDelayMs, 10_000);
  return Math.max(retryDelayMs, 60_000);
};

const markExhausted = (key, err) => {
  const entry = pool.find((p) => p.key === key);
  if (!entry) return;
  entry.cooldownUntil = Date.now() + cooldownMsFor(err);
  logger.warn(`Gemini ${entry.label} exhausted — cooling down until ${new Date(entry.cooldownUntil).toISOString()}`);
};

// Round-robins across keys not currently in cooldown, so load spreads
// across all healthy keys rather than hammering whichever is first. If
// every key happens to be cooling down, still returns one (the caller's own
// retry/backoff loop is what actually waits) rather than blocking here.
const getClient = () => {
  // With no keys configured the rotation arithmetic below would produce
  // `pool[NaN]` and throw an opaque TypeError. Fail with something a reader
  // can act on — callers already treat a throw here as "AI unavailable".
  if (pool.length === 0) {
    throw new Error('AI is not configured on this server (no Gemini API key)');
  }

  const now = Date.now();
  // cursor always advances against the fixed pool array (not a
  // cooldown-filtered subset, which can change size/order call to call and
  // would otherwise make rotation skip or revisit keys unevenly) — scan
  // forward from it for the first key not in cooldown.
  for (let i = 0; i < pool.length; i++) {
    cursor = (cursor + 1) % pool.length;
    if (pool[cursor].cooldownUntil <= now) {
      const entry = pool[cursor];
      return { client: entry.client, key: entry.key, label: entry.label };
    }
  }
  // Every key is currently cooling down — still return one (the caller's own
  // retry/backoff loop is what actually waits) rather than blocking here.
  cursor = (cursor + 1) % pool.length;
  const entry = pool[cursor];
  return { client: entry.client, key: entry.key, label: entry.label };
};

const poolSize = pool.length;

const poolStatus = () => pool.map(({ label, cooldownUntil }) => ({
  label,
  available: cooldownUntil <= Date.now(),
  cooldownUntil: cooldownUntil > Date.now() ? new Date(cooldownUntil).toISOString() : null,
}));

module.exports = { getClient, markExhausted, poolSize, poolStatus };
