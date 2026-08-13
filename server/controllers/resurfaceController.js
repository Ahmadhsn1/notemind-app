const Resurface = require('../models/Resurface');
const HttpError = require('../utils/HttpError');
const { buildTodaysResurface, localIsoDate } = require('../services/resurfaceService');

const DAY_MS = 24 * 60 * 60 * 1000;
const STREAK_WINDOW_DAYS = 14;

// Local midnight, `delta` calendar days from `date`. setDate() rather than
// `date.getTime() + delta * DAY_MS` on purpose — the fixed-ms version
// silently skips a calendar day across a DST spring-forward (that local day
// is only 23h of real time) and double-counts one on fall-back (25h), which
// broke the streak walk-back below across a DST boundary. setDate() operates
// on wall-clock date components, so the Date engine re-derives the correct
// UTC offset for the resulting day instead of drifting by an hour. Same
// helper as noteController.getNoteStreak's, duplicated rather than shared —
// see resurfaceService.js's localIsoDate comment for why this feature keeps
// its own day helpers local instead of importing noteController's.
const addLocalDays = (date, delta) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + delta);
  return d;
};

// Days-since-epoch for a local 'YYYY-MM-DD' key, via Date.UTC (which has no
// DST) — used only to test two day-keys for adjacency (`b - a === 1`).
const epochDay = (isoDate) => {
  const [y, m, d] = isoDate.split('-').map(Number);
  return Date.UTC(y, m - 1, d) / DAY_MS;
};
// Only what the card needs to render — never the embedding.
const OLD_NOTE_SELECT = 'title folder tags createdAt body';

const serializeResurface = (doc) => ({
  date: doc.date,
  method: doc.method,
  oldNote: doc.oldNote || null,
  anchorNote: doc.anchorNote ? { _id: doc.anchorNote._id, title: doc.anchorNote.title } : null,
  reflection: doc.reflection,
  viewedAt: doc.viewedAt,
  engagedAt: doc.engagedAt,
  engagementReply: doc.engagementReply,
});

// Computes-and-caches today's resurfaced memory. The (user, date) unique
// index on Resurface is the cache: a missing document means "not built yet
// today" (including the "nothing qualified" case, stored as method:'none'
// so a no-memory day doesn't re-run the whole selection scan on every
// subsequent page load).
const getTodaysResurface = async (req, res) => {
  const today = localIsoDate(new Date());
  let doc = await Resurface.findOne({ user: req.user.id, date: today });

  if (!doc) {
    const built = await buildTodaysResurface(req.user.id);
    try {
      doc = await Resurface.create({ user: req.user.id, ...built });
    } catch (err) {
      // Two tabs loading the Dashboard simultaneously could both find no
      // record and both attempt to create one — the unique index lets only
      // one win; the loser just reads what the winner saved.
      if (err.code === 11000) {
        doc = await Resurface.findOne({ user: req.user.id, date: today });
      } else {
        throw err;
      }
    }
  }

  doc = await doc.populate([
    { path: 'oldNote', select: OLD_NOTE_SELECT },
    { path: 'anchorNote', select: 'title' },
  ]);

  res.status(200).json(serializeResurface(doc));
};

// A soft "did they even see it" signal, deliberately separate from the
// streak-worthy engagedAt below — set once, idempotent.
const markResurfaceViewed = async (req, res) => {
  const today = localIsoDate(new Date());
  const updated = await Resurface.findOneAndUpdate(
    { user: req.user.id, date: today, viewedAt: null },
    { viewedAt: new Date() },
    { returnDocument: 'after' }
  );

  const doc = updated || await Resurface.findOne({ user: req.user.id, date: today });
  if (!doc) throw new HttpError(404, "Today's memory not found");

  res.status(200).json({ viewedAt: doc.viewedAt });
};

// THE streak signal — set only on the first reply submission of the day
// (blank or not). Resubmitting later in the same day still updates the
// reply text (harmless — engagedAt and the streak it already earned don't
// change), it just won't re-set engagedAt.
const submitResurfaceReply = async (req, res) => {
  const { reply } = req.body;
  const today = localIsoDate(new Date());

  const existing = await Resurface.findOne({ user: req.user.id, date: today });
  if (!existing || !existing.oldNote) {
    throw new HttpError(404, 'No memory to reflect on today');
  }

  const update = { engagementReply: reply };
  if (!existing.engagedAt) update.engagedAt = new Date();

  const doc = await Resurface.findOneAndUpdate(
    { user: req.user.id, date: today },
    update,
    { returnDocument: 'after' }
  );

  res.status(200).json({ engagedAt: doc.engagedAt, engagementReply: doc.engagementReply });
};

// Consecutive-day streak of reflection engagement — same walk-back-with-
// grace-day + longest-run algorithm as noteController.getNoteStreak, keyed
// off Resurface.engagedAt/date instead of note activity. A fully separate
// streak from the note-activity one shown in MomentumHero.
const getResurfaceStreak = async (req, res) => {
  const records = await Resurface.find({ user: req.user.id, engagedAt: { $ne: null } }).select('date').lean();
  const activeDays = new Set(records.map((r) => r.date));

  let cursor = addLocalDays(new Date(), 0);
  if (!activeDays.has(localIsoDate(cursor))) {
    cursor = addLocalDays(cursor, -1);
  }

  let streak = 0;
  while (activeDays.has(localIsoDate(cursor))) {
    streak++;
    cursor = addLocalDays(cursor, -1);
  }

  // String-sorting the 'YYYY-MM-DD' keys directly sorts chronologically;
  // epochDay (not raw Date subtraction) is what keeps the adjacency check
  // itself DST-safe.
  const sortedDays = [...activeDays].sort();
  let longestStreak = 0;
  let run = 0;
  let prevEpoch = null;
  for (const key of sortedDays) {
    const e = epochDay(key);
    run = prevEpoch !== null && e - prevEpoch === 1 ? run + 1 : 1;
    longestStreak = Math.max(longestStreak, run);
    prevEpoch = e;
  }

  const today = addLocalDays(new Date(), 0);
  const days = [];
  for (let i = STREAK_WINDOW_DAYS - 1; i >= 0; i--) {
    const d = addLocalDays(today, -i);
    days.push({ date: localIsoDate(d), active: activeDays.has(localIsoDate(d)) });
  }

  res.status(200).json({ streak, longestStreak, days });
};

module.exports = { getTodaysResurface, markResurfaceViewed, submitResurfaceReply, getResurfaceStreak };
