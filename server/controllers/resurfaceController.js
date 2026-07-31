const Resurface = require('../models/Resurface');
const HttpError = require('../utils/HttpError');
const { buildTodaysResurface, localIsoDate } = require('../services/resurfaceService');

const DAY_MS = 24 * 60 * 60 * 1000;
const STREAK_WINDOW_DAYS = 14;
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

  let cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  if (!activeDays.has(localIsoDate(cursor))) {
    cursor = new Date(cursor.getTime() - DAY_MS);
  }

  let streak = 0;
  while (activeDays.has(localIsoDate(cursor))) {
    streak++;
    cursor = new Date(cursor.getTime() - DAY_MS);
  }

  const sortedDayTimes = [...activeDays].map((key) => new Date(key).getTime()).sort((a, b) => a - b);
  let longestStreak = 0;
  let run = 0;
  let prevTime = null;
  for (const t of sortedDayTimes) {
    run = prevTime !== null && t - prevTime === DAY_MS ? run + 1 : 1;
    longestStreak = Math.max(longestStreak, run);
    prevTime = t;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = [];
  for (let i = STREAK_WINDOW_DAYS - 1; i >= 0; i--) {
    const d = new Date(today.getTime() - i * DAY_MS);
    days.push({ date: localIsoDate(d), active: activeDays.has(localIsoDate(d)) });
  }

  res.status(200).json({ streak, longestStreak, days });
};

module.exports = { getTodaysResurface, markResurfaceViewed, submitResurfaceReply, getResurfaceStreak };
