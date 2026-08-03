const AiUsage = require('../models/AiUsage');
const HttpError = require('../utils/HttpError');

// Per-account daily ceiling on billed Gemini calls. Deliberately generous —
// this is an abuse/runaway ceiling, not a product plan limit. When plans land
// this becomes a per-tier number rather than a constant.
const DAILY_AI_CALL_LIMIT = Number(process.env.DAILY_AI_CALL_LIMIT) || 200;

const utcDateKey = (date = new Date()) => date.toISOString().slice(0, 10);

// Complements `aiLimiter` rather than replacing it: that one is per-IP and
// caps burst rate, this one is per-user and caps daily spend. Neither
// subsumes the other — an IP limiter can't stop one account spending all day
// (and counts a whole office behind one NAT as a single user), while a daily
// quota can't stop a burst.
//
// Atomic upsert ($inc, checked against the post-increment value) so two
// concurrent requests can't both read the same count and both pass.
const consume = async (userId) => {
  const usage = await AiUsage.findOneAndUpdate(
    { user: userId, date: utcDateKey() },
    { $inc: { count: 1 } },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
  );
  return usage.count <= DAILY_AI_CALL_LIMIT;
};

// Hard gate, for routes whose entire purpose is the AI call. Exceeding the
// quota means the request can't be served, so it 429s.
const enforceAiQuota = async (req, res, next) => {
  if (!(await consume(req.user.id))) {
    throw new HttpError(
      429,
      `You've reached today's AI usage limit (${DAILY_AI_CALL_LIMIT} requests). It resets at midnight UTC.`
    );
  }
  next();
};

// Soft gate, for the note create/update path. Every save triggers a billed
// embedText call, but the save itself is not an AI feature — blocking it
// would mean "you've used your AI quota, so you can no longer write notes,"
// which is indefensible. Over quota, the embedding is simply skipped: that
// note falls back to keyword matching in search/ask (exactly the same
// degradation deriveContentFields already applies when Gemini is
// unreachable) and gets a real embedding on its next save.
//
// Returns false on any error too — a quota-store failure must never be able
// to block a note from saving.
const tryConsumeAiQuota = async (userId) => {
  try {
    return await consume(userId);
  } catch {
    return false;
  }
};

module.exports = { enforceAiQuota, tryConsumeAiQuota, DAILY_AI_CALL_LIMIT, utcDateKey };
