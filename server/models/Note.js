const mongoose = require('mongoose');

const noteSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  // Plain-text, server-derived from contentHtml (or written directly by
  // legacy/API clients). Never trust client-provided body once contentHtml
  // is present — see htmlSanitizer.htmlToPlainText. AI prompts and keyword
  // search both read this field.
  body: {
    type: String,
    default: '',
  },
  // Sanitized rich-text HTML from the Tiptap editor. Empty for legacy notes
  // that predate the rich editor — those fall back to rendering `body`.
  contentHtml: {
    type: String,
    default: '',
  },
  tags: {
    type: [String],
    default: [],
  },
  folder: {
    type: String,
    default: 'General',
  },
  aiSummary: {
    type: String,
    default: '',
  },
  // Notes referenced via [[wikilink]] in contentHtml — extracted server-side
  // in noteController's deriveContentFields whenever contentHtml is saved.
  // Powers the backlinks panel (computed client-side by scanning all notes'
  // `links` for the viewed note's id) and the graph view.
  links: {
    type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Note' }],
    default: [],
  },
  // 768-dim vector from aiService.embedText(body), recomputed on every
  // create/update. select:false — never sent to the client (would bloat
  // every note-list response); askNotes/the search endpoint explicitly
  // .select('+embedding') when they need to run the cosine-similarity scan.
  embedding: {
    type: [Number],
    default: [],
    select: false,
  },
  pinned: {
    type: Boolean,
    default: false,
  },
  reminderAt: {
    type: Date,
    default: null,
  },
  // Set by services/scheduler.js the moment a reminder email actually goes
  // out for the current reminderAt value — separate from reminderAt itself
  // so the client's overdue/upcoming badge (derived purely from reminderAt)
  // is unaffected. Cleared back to null whenever reminderAt is set/changed
  // (see noteController's createNote/updateNote) so editing or re-snoozing
  // a reminder makes it eligible for a fresh email instead of being treated
  // as already-sent.
  reminderNotifiedAt: {
    type: Date,
    default: null,
  },
  // Soft states — a note is "active" (shows on the main Dashboard) only when
  // both are null. Archived and trashed are mutually exclusive in the
  // controller (archiving clears deletedAt and vice versa) so a note never
  // has to be reasoned about as "both."
  archivedAt: {
    type: Date,
    default: null,
  },
  deletedAt: {
    type: Date,
    default: null,
  },
}, { timestamps: true });

// Matches getNotes' primary query+sort pattern (filter by user, newest first).
noteSchema.index({ user: 1, createdAt: -1 });

// Exact/typo-tolerant search complement to the AI keyword/semantic retrieval
// used by askNotes — not yet wired to an endpoint, but cheap to declare now
// while the schema is already being touched.
noteSchema.index({ title: 'text', body: 'text', tags: 'text' });

// Backs services/scheduler.js's every-5-minutes due-reminder scan
// (`reminderAt: {$ne: null, $lte: now}`) — without this, that query is a
// full collection scan on every tick regardless of how few notes actually
// have a reminder set.
noteSchema.index({ reminderAt: 1 });

module.exports = mongoose.model('Note', noteSchema);
