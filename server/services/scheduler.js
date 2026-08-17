const cron = require('node-cron');
const Note = require('../models/Note');
const User = require('../models/User');
const env = require('../config/env');
const logger = require('./logger');
// Both imported as namespaces, not destructured — destructuring binds the
// original function at require time, so a test spying on the module's
// export (`vi.spyOn(emailService, 'sendEmail')`, the pattern
// passwordReset.test.js already uses) would be silently bypassed. Same
// reasoning as authController.js's own emailService import.
const emailService = require('./email');
const aiService = require('./aiService');

// This is the only background/cron infra in the app — everything else
// (trash purge, etc.) is lazy, run inline the next time something touches
// the relevant data, rather than on a schedule. These two jobs genuinely
// need wall-clock triggering: nothing else in a request/response cycle would
// ever notice "a reminder just came due" or "a week has passed".
const dashboardUrl = () => `${env.allowedOrigins[0]}/dashboard`;

// The reminder email can now jump straight to the note (Dashboard.jsx reads
// ?note=<id> and opens NoteViewModal for it — see the deep-link effect
// there), unlike the plain dashboardUrl() the weekly digest still uses,
// which has no single note to point at.
const noteUrl = (noteId) => `${dashboardUrl()}?note=${noteId}`;

// Mirrors noteController.getDigest's own window/limit — duplicated rather
// than imported, since that module only exports controller functions shaped
// around (req, res), not a reusable "get this user's recent notes" call.
// Same duplicate-small-constants convention as resurfaceController's day
// helpers.
const DIGEST_WINDOW_DAYS = 7;
const DIGEST_NOTES_LIMIT = 20;

// Capped per tick (runs every 5 minutes) rather than unbounded: a genuine
// backlog (server was down for a while) drains over a few ticks instead of
// one query trying to send hundreds of emails at once.
const REMINDER_BATCH_LIMIT = 200;

// Fires once per note the moment its reminderAt comes due — never more than
// once, via reminderNotifiedAt (cleared back to null by updateNote whenever
// reminderAt itself changes, so re-snoozing makes a note eligible again).
const checkDueReminders = async () => {
  if (!emailService.isEmailConfigured()) return;

  const dueNotes = await Note.find({
    reminderAt: { $ne: null, $lte: new Date() },
    reminderNotifiedAt: null,
    deletedAt: null,
  })
    .populate('user', 'name email emailReminders')
    .limit(REMINDER_BATCH_LIMIT);

  for (const note of dueNotes) {
    // Opted out, or (shouldn't happen — deleteAccount cascades notes first —
    // but don't loop on it forever if it ever does) the owning user is gone.
    if (!note.user || note.user.emailReminders === false) {
      note.reminderNotifiedAt = new Date();
      await note.save();
      continue;
    }

    try {
      const { subject, html, text } = emailService.reminderEmail(note.user.name, note.title, noteUrl(note._id));
      await emailService.sendEmail({ to: note.user.email, subject, html, text });
      note.reminderNotifiedAt = new Date();
      await note.save();
    } catch (err) {
      // Left un-notified on purpose — the next tick (5 minutes later) retries
      // it rather than silently dropping a reminder because of one transient
      // send failure.
      logger.warn({ err, noteId: note._id.toString() }, 'Reminder email failed — will retry next tick');
    }
  }
};

// Runs weekly. Deliberately calls aiService.generateWeeklyDigest directly
// rather than going through the /notes/digest route's middleware chain —
// this is a system-initiated send, not a user-initiated request, so it
// shouldn't count against that user's own enforceAiQuota daily budget (see
// middleware/aiQuota.js). Sequential per user (not Promise.all) so it can't
// burst the Gemini key pool with dozens of simultaneous requests.
const sendWeeklyDigests = async () => {
  if (!emailService.isEmailConfigured()) return;

  const users = await User.find({ emailWeeklyDigest: true }).select('name email');
  const weekAgo = new Date(Date.now() - DIGEST_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  for (const user of users) {
    try {
      const recentNotes = await Note.find({
        user: user._id,
        updatedAt: { $gte: weekAgo },
        deletedAt: null,
      }).sort({ updatedAt: -1 }).limit(DIGEST_NOTES_LIMIT);

      // Nothing written this week — an empty "here's your recap" email would
      // be pure noise, so skip the user entirely rather than send one.
      if (recentNotes.length === 0) continue;

      const digest = await aiService.generateWeeklyDigest(recentNotes);
      // Gemini failure/exhausted quota — same best-effort convention as the
      // in-app widget (noteController.getDigest treats this as digest:null,
      // not a hard failure). Skip this user this week; next Monday retries.
      if (!digest) continue;

      const { subject, html, text } = emailService.weeklyDigestEmail(user.name, digest, recentNotes.length, dashboardUrl());
      await emailService.sendEmail({ to: user.email, subject, html, text });
    } catch (err) {
      logger.warn({ err, userId: user._id.toString() }, 'Weekly digest email failed for this user — continuing with the rest');
    }
  }
};

let tasks = [];

// Called once from server.js after the DB connects — never from app.js, so
// importing app.js for tests (as every server/tests/*.test.js does) can
// never accidentally start real cron jobs against the test DB.
const startScheduler = () => {
  tasks = [
    cron.schedule('*/5 * * * *', () => {
      checkDueReminders().catch((err) => logger.error({ err }, 'checkDueReminders tick failed'));
    }),
    // Mondays 09:00 UTC — arbitrary but fixed, so "your week" means the same
    // Mon–Mon window every time rather than drifting with server restarts.
    cron.schedule('0 9 * * 1', () => {
      sendWeeklyDigests().catch((err) => logger.error({ err }, 'sendWeeklyDigests tick failed'));
    }),
  ];
  logger.info('Scheduler started (reminder emails every 5m, weekly digest Mondays 09:00 UTC)');
};

const stopScheduler = () => {
  tasks.forEach((t) => t.stop());
  tasks = [];
};

module.exports = { startScheduler, stopScheduler, checkDueReminders, sendWeeklyDigests };
