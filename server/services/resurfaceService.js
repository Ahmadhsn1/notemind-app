const Note = require('../models/Note');
const Resurface = require('../models/Resurface');
const { cosineSimilarity, generateResurfaceReflection } = require('./aiService');

const DAY_MS = 24 * 60 * 60 * 1000;

// Anchor must be recent enough to represent "what the user's actively
// thinking about," not a stale last-edit from weeks ago.
const ANCHOR_WINDOW_DAYS = 3;
// A candidate must be at least this old to feel like a genuine "old memory"
// rather than "the thing I wrote last week."
const MIN_NOTE_AGE_DAYS = 30;
// Stricter than searchNotes' SEARCH_MIN_SIMILARITY (0.58, noteController.js)
// — search tolerates weaker matches because the user visually scans a
// results list; a single proactive card has no such filter, so a bad match
// reads as "this app doesn't get me." Bias toward precision over recall,
// even if it means falling back to the calendar method more often.
const RESURFACE_MIN_SIMILARITY = 0.62;
// A note shown again within this window would feel repetitive.
const RECENTLY_RESURFACED_LOOKBACK_DAYS = 30;
// Same values as noteController.js's RESURFACE_DAY_OFFSETS, deliberately
// re-declared here rather than imported — this feature is fully separate
// from getDigest's existing "on this day" widget, which stays untouched.
const CALENDAR_FALLBACK_DAY_OFFSETS = [7, 14, 30, 90, 180, 365];

// Local calendar date as 'YYYY-MM-DD', not toISOString() (which converts to
// UTC first and would shift the date by a day for any timezone ahead of
// UTC) — same convention as noteController.js's own localIsoDate helper,
// duplicated locally rather than imported for the same "fully separate
// feature" reason as the day-offsets constant above.
const localIsoDate = (date) => {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const getRecentlyResurfacedIds = async (userId) => {
  const since = localIsoDate(new Date(Date.now() - RECENTLY_RESURFACED_LOOKBACK_DAYS * DAY_MS));
  const ids = await Resurface.find({ user: userId, date: { $gte: since }, oldNote: { $ne: null } }).distinct('oldNote');
  return ids.map((id) => id.toString());
};

// "What's the user actively thinking about right now" — the most recently
// touched note within the last few days. Needs its embedding to power the
// semantic scan below.
const findAnchorNote = async (userId) => {
  const cutoff = new Date(Date.now() - ANCHOR_WINDOW_DAYS * DAY_MS);
  return Note.findOne({
    user: userId,
    archivedAt: null,
    deletedAt: null,
    $or: [{ createdAt: { $gte: cutoff } }, { updatedAt: { $gte: cutoff } }],
  }).sort({ updatedAt: -1 }).select('+embedding');
};

// In-process cosine scan over the user's older notes — same pattern as
// noteController.searchNotes (no vector DB, fine at personal-app note
// counts). Returns the single best match above threshold, or null.
const findSemanticCandidate = async (userId, anchor, excludeIds) => {
  if (!anchor.embedding?.length) return null;

  const ageCutoff = new Date(Date.now() - MIN_NOTE_AGE_DAYS * DAY_MS);
  const candidates = await Note.find({
    user: userId,
    archivedAt: null,
    deletedAt: null,
    createdAt: { $lte: ageCutoff },
    _id: { $nin: excludeIds },
  }).select('+embedding');

  let best = null;
  let bestScore = 0;
  for (const candidate of candidates) {
    if (!candidate.embedding?.length) continue;
    const score = cosineSimilarity(anchor.embedding, candidate.embedding);
    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
  }

  return bestScore >= RESURFACE_MIN_SIMILARITY ? best : null;
};

// Exact-calendar-day match, same concept as getDigest's onThisDay block but
// reimplemented independently (see CALENDAR_FALLBACK_DAY_OFFSETS comment) —
// walks smallest-offset-first so a fresh account gets something sooner.
const findCalendarFallback = async (userId, excludeIds) => {
  for (const days of CALENDAR_FALLBACK_DAY_OFFSETS) {
    const start = new Date(Date.now() - days * DAY_MS);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setHours(23, 59, 59, 999);

    const found = await Note.findOne({
      user: userId,
      archivedAt: null,
      deletedAt: null,
      createdAt: { $gte: start, $lte: end },
      _id: { $nin: excludeIds },
    });
    if (found) return found;
  }
  return null;
};

// Orchestrates one day's resurfacing for one user. Returns a plain object
// ready to pass into Resurface.create — always returns a result (method:
// 'none' when nothing qualifies) so the caller can persist it as the day's
// cache entry regardless of outcome.
const buildTodaysResurface = async (userId) => {
  const excludeIds = await getRecentlyResurfacedIds(userId);
  const anchor = await findAnchorNote(userId);

  let oldNote = null;
  let anchorNote = null;
  let method = 'none';

  if (anchor) {
    const nin = [...excludeIds, anchor._id.toString()];
    oldNote = await findSemanticCandidate(userId, anchor, nin);
    if (oldNote) {
      method = 'semantic';
      anchorNote = anchor;
    }
  }

  if (!oldNote) {
    const nin = anchor ? [...excludeIds, anchor._id.toString()] : excludeIds;
    oldNote = await findCalendarFallback(userId, nin);
    if (oldNote) method = 'calendar';
  }

  // Best-effort — an AI failure here must never break the endpoint. The
  // card still renders using just the old note's own content.
  let reflection = '';
  if (oldNote) {
    try {
      reflection = await generateResurfaceReflection(oldNote, anchorNote);
    } catch {
      reflection = '';
    }
  }

  return {
    date: localIsoDate(new Date()),
    oldNote: oldNote ? oldNote._id : null,
    anchorNote: anchorNote ? anchorNote._id : null,
    method,
    reflection,
  };
};

module.exports = { buildTodaysResurface, localIsoDate };
