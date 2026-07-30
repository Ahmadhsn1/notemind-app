const mongoose = require('mongoose');
const archiver = require('archiver');
const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const Note = require('../models/Note');
const NoteVersion = require('../models/NoteVersion');
const { summarizeAndTag, streamAnswerFromNotes, STREAM_META_DELIMITER, stripJsonFences, generateTitle, assistWriting, embedText, cosineSimilarity, generateWeeklyDigest } = require('../services/aiService');
const { sanitizeNoteHtml, htmlToPlainText, HtmlTooLargeError } = require('../utils/htmlSanitizer');
const { htmlToMarkdown } = require('../utils/markdownConverter');
const { uploadsDir, urlFor } = require('../services/uploadStorage');
const { broadcastAdminUpdate } = require('../services/socket');
const HttpError = require('../utils/HttpError');

// Fetches a note and enforces ownership; throws HttpError(404/403) so callers
// can turn it into the same response they already returned inline.
const loadOwnedNote = async (id, userId, action) => {
  const note = await Note.findById(id);
  if (!note) throw new HttpError(404, 'Note not found');
  if (note.user.toString() !== userId) throw new HttpError(403, `Not authorized to ${action} this note`);
  return note;
};

const normalizeFolder = (folder) => (typeof folder === 'string' ? folder.trim() : '') || 'General';

const normalizeTags = (tags) => {
  if (!Array.isArray(tags)) return [];
  const cleaned = tags.map((t) => (typeof t === 'string' ? t.trim() : '')).filter(Boolean);
  return Array.from(new Set(cleaned));
};

// [[wikilink]] nodes render as <span data-type="note-link" data-note-id="ID">
// (see client/src/components/editor/noteLinkExtension.js) — extracted here
// straight from the already-sanitized HTML so we only ever trust ids that
// survived the allowlist, deduped, and filtered to valid ObjectId shape.
const extractLinkedNoteIds = (html) => {
  const ids = new Set();
  const pattern = /data-note-id="([^"]+)"/g;
  let match;
  while ((match = pattern.exec(html))) {
    if (mongoose.isValidObjectId(match[1])) ids.add(match[1]);
  }
  return Array.from(ids);
};

// contentHtml (rich editor output) is sanitized and always wins over a
// client-supplied body — body is re-derived from it so AI prompts and
// keyword search never see markup. Legacy/API clients that only send body
// (no contentHtml) keep working unchanged. Also (re)computes the semantic
// embedding on every save that touches content — best-effort: a failed
// Gemini call here degrades askNotes/search back to keyword matching for
// this note rather than blocking the save.
const deriveContentFields = async (payload) => {
  let fields;
  if (payload.contentHtml === undefined) {
    if (payload.body === undefined) return {};
    fields = { body: payload.body };
  } else {
    try {
      const contentHtml = sanitizeNoteHtml(payload.contentHtml);
      fields = { contentHtml, body: htmlToPlainText(contentHtml), links: extractLinkedNoteIds(contentHtml) };
    } catch (error) {
      if (error instanceof HtmlTooLargeError) throw new HttpError(400, error.message);
      throw error;
    }
  }

  try {
    fields.embedding = await embedText(fields.body);
  } catch {
    // best-effort, see comment above
  }

  return fields;
};

const TOP_NOTES_LIMIT = 6;

// Keyword-overlap fallback — used whenever semantic scoring isn't available
// (query embedding call failed, or a given note has no stored embedding yet,
// e.g. it predates this feature and hasn't been re-saved). Title matches
// count more than body matches; words under 3 chars are skipped so common
// short words don't dominate the score.
const scoreNoteRelevance = (question, note) => {
  const words = question.toLowerCase().match(/\w+/g) || [];
  const title = note.title.toLowerCase();
  const body = note.body.toLowerCase();

  let score = 0;
  for (const word of new Set(words)) {
    if (word.length < 3) continue;
    if (title.includes(word)) score += 3;
    if (body.includes(word)) score += 1;
  }
  return score;
};

// Scaled so a strong semantic match (cosine ~0.8-0.9) lands in roughly the
// same numeric range as a strong keyword match, since both scores flow into
// the same "hasMatches" threshold check in askNotes.
const SEMANTIC_SCORE_SCALE = 10;

// Prefers semantic similarity per-note when that note has a stored embedding
// and the query itself could be embedded; otherwise falls back to keyword
// overlap for that note. Mixed-mode by design — a handful of notes saved
// before this feature (no embedding yet) shouldn't just drop out of results.
const rankNotesByRelevance = async (query, notes) => {
  let queryEmbedding = [];
  try {
    queryEmbedding = await embedText(query, 'RETRIEVAL_QUERY');
  } catch {
    // Gemini unavailable — every note falls back to keyword scoring below.
  }

  const scored = notes.map((note) => {
    const isSemantic = Boolean(queryEmbedding.length && note.embedding?.length);
    const score = isSemantic
      ? cosineSimilarity(queryEmbedding, note.embedding) * SEMANTIC_SCORE_SCALE
      : scoreNoteRelevance(query, note);
    return { note, score, isSemantic };
  }).sort((a, b) => b.score - a.score);

  return { scored };
};

const DEFAULT_PAGE_LIMIT = 100;
const MAX_PAGE_LIMIT = 200;
const TRASH_RETENTION_DAYS = 30;

// Trashed notes older than the retention window are hard-deleted lazily,
// right before a trash listing is served, rather than via a cron/scheduler
// (no such infra exists in this app) — cheap and correct enough at this
// scale since it only runs when someone actually opens the Trash view.
const purgeExpiredTrash = async (userId) => {
  const cutoff = new Date(Date.now() - TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  await Note.deleteMany({ user: userId, deletedAt: { $lt: cutoff } });
};

// ?view=active (default) | archived | trash — a note is only ever in one of
// these three states (see Note.archivedAt/deletedAt comments).
const VIEW_FILTERS = {
  active: { archivedAt: null, deletedAt: null },
  archived: { archivedAt: { $ne: null }, deletedAt: null },
  trash: { deletedAt: { $ne: null } },
};

const getNotes = async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(MAX_PAGE_LIMIT, Math.max(1, parseInt(req.query.limit, 10) || DEFAULT_PAGE_LIMIT));
  const view = VIEW_FILTERS[req.query.view] ? req.query.view : 'active';

  if (view === 'trash') await purgeExpiredTrash(req.user.id);

  const filter = { user: req.user.id, ...VIEW_FILTERS[view] };
  const sort = view === 'active' ? { pinned: -1, createdAt: -1 } : { createdAt: -1 };

  const [notes, total] = await Promise.all([
    Note.find(filter).sort(sort).skip((page - 1) * limit).limit(limit),
    Note.countDocuments(filter),
  ]);

  res.status(200).json({ notes, page, limit, total, totalPages: Math.ceil(total / limit) || 1 });
};

const getNoteById = async (req, res) => {
  const note = await loadOwnedNote(req.params.id, req.user.id, 'view');
  res.status(200).json(note);
};

const createNote = async (req, res) => {
  const { title, tags, folder, reminderAt } = req.body;

  const note = await Note.create({
    user: req.user.id,
    title,
    ...(await deriveContentFields(req.body)),
    tags: normalizeTags(tags),
    folder: normalizeFolder(folder),
    ...(reminderAt !== undefined && { reminderAt }),
  });

  broadcastAdminUpdate('note');
  res.status(201).json(note);
};

const MAX_VERSIONS_PER_NOTE = 20;

// Snapshots a note's current title/contentHtml/body before it's overwritten.
// Only called when an update actually touches content (title or
// contentHtml) — tag/folder/pin-only edits aren't meaningful "versions".
// Caps history at MAX_VERSIONS_PER_NOTE so this can't grow unbounded for a
// note that's edited constantly.
const snapshotVersion = async (note) => {
  await NoteVersion.create({
    note: note._id,
    title: note.title,
    contentHtml: note.contentHtml,
    body: note.body,
  });

  const excess = await NoteVersion.find({ note: note._id })
    .sort({ createdAt: -1 })
    .skip(MAX_VERSIONS_PER_NOTE)
    .select('_id');
  if (excess.length) {
    await NoteVersion.deleteMany({ _id: { $in: excess.map((v) => v._id) } });
  }
};

const updateNote = async (req, res) => {
  const existingNote = await loadOwnedNote(req.params.id, req.user.id, 'update');

  const updates = {};
  if (req.body.title !== undefined) updates.title = req.body.title;
  Object.assign(updates, await deriveContentFields(req.body));
  if (req.body.tags !== undefined) updates.tags = normalizeTags(req.body.tags);
  if (req.body.folder !== undefined) updates.folder = normalizeFolder(req.body.folder);
  if (req.body.reminderAt !== undefined) updates.reminderAt = req.body.reminderAt;

  if (updates.title !== undefined || updates.contentHtml !== undefined) {
    await snapshotVersion(existingNote);
  }

  const updatedNote = await Note.findByIdAndUpdate(req.params.id, updates, {
    new: true,
  });

  res.status(200).json(updatedNote);
};

// Soft delete — moves the note to Trash (deletedAt set) rather than removing
// it. See restoreNote / permanentlyDeleteNote / purgeExpiredTrash for the
// rest of the trash lifecycle.
const deleteNote = async (req, res) => {
  await loadOwnedNote(req.params.id, req.user.id, 'delete');

  await Note.findByIdAndUpdate(req.params.id, { deletedAt: new Date(), archivedAt: null, pinned: false });
  res.status(200).json({ message: 'Note moved to trash' });
};

const restoreNote = async (req, res) => {
  await loadOwnedNote(req.params.id, req.user.id, 'restore');

  const note = await Note.findByIdAndUpdate(req.params.id, { deletedAt: null }, { new: true });
  res.status(200).json(note);
};

// Hard delete — only reachable from Trash (the note must already be
// soft-deleted), so a user can't accidentally skip the trash/undo step from
// the main note list.
// Best-effort — scans for /uploads/<generated-filename> references in the
// note's own contentHtml and unlinks them. Known gap (accepted for v1):
// removing just an image node from a note that otherwise survives does NOT
// clean up that file, only a full note delete does — an orphan from that
// path just sits in server/uploads/ unreferenced.
const deleteOrphanedImages = async (contentHtml) => {
  if (!contentHtml) return;
  const pattern = /\/uploads\/([A-Za-z0-9_-]+\.(?:png|jpe?g|gif|webp))/g;
  let match;
  while ((match = pattern.exec(contentHtml))) {
    await fs.unlink(path.join(uploadsDir, match[1])).catch(() => {});
  }
};

const permanentlyDeleteNote = async (req, res) => {
  const note = await loadOwnedNote(req.params.id, req.user.id, 'permanently delete');
  if (!note.deletedAt) {
    throw new HttpError(400, 'Move the note to trash before deleting it permanently');
  }

  await Promise.all([
    Note.findByIdAndDelete(req.params.id),
    NoteVersion.deleteMany({ note: req.params.id }),
    deleteOrphanedImages(note.contentHtml),
  ]);
  broadcastAdminUpdate('note');
  res.status(200).json({ message: 'Note permanently deleted' });
};

const togglePinNote = async (req, res) => {
  const note = await loadOwnedNote(req.params.id, req.user.id, 'pin');
  if (note.deletedAt || note.archivedAt) {
    throw new HttpError(400, 'Restore the note before pinning it');
  }

  note.pinned = !note.pinned;
  await note.save();
  res.status(200).json(note);
};

const archiveNote = async (req, res) => {
  await loadOwnedNote(req.params.id, req.user.id, 'archive');

  const note = await Note.findByIdAndUpdate(
    req.params.id,
    { archivedAt: new Date(), pinned: false },
    { new: true }
  );
  res.status(200).json(note);
};

const unarchiveNote = async (req, res) => {
  await loadOwnedNote(req.params.id, req.user.id, 'unarchive');

  const note = await Note.findByIdAndUpdate(req.params.id, { archivedAt: null }, { new: true });
  res.status(200).json(note);
};

const getNoteVersions = async (req, res) => {
  await loadOwnedNote(req.params.id, req.user.id, 'view version history for');

  const versions = await NoteVersion.find({ note: req.params.id })
    .sort({ createdAt: -1 })
    .select('title createdAt');
  res.status(200).json(versions);
};

// Restoring snapshots the note's current (pre-restore) state first, so
// restoring is itself undoable via the same version list.
const restoreNoteVersion = async (req, res) => {
  const note = await loadOwnedNote(req.params.id, req.user.id, 'restore a version for');
  const version = await NoteVersion.findOne({ _id: req.params.versionId, note: req.params.id });
  if (!version) throw new HttpError(404, 'Version not found');

  await snapshotVersion(note);

  note.title = version.title;
  // Legacy versions predating the rich editor can have an empty contentHtml
  // with the real content only in body — fall back to it instead of letting
  // deriveContentFields sanitize an empty string and wipe the note's content.
  const payload = version.contentHtml && version.contentHtml.trim() !== ''
    ? { contentHtml: version.contentHtml }
    : { body: version.body };
  Object.assign(note, await deriveContentFields(payload));
  await note.save();

  res.status(200).json(note);
};

const processNoteWithAI = async (req, res) => {
  const note = await loadOwnedNote(req.params.id, req.user.id, 'process');

  if (!note.body || note.body.trim() === '') {
    throw new HttpError(400, 'Note body is empty, nothing to summarize');
  }

  let summary, tags;
  try {
    ({ summary, tags } = await summarizeAndTag(note.body));
  } catch {
    throw new HttpError(500, 'AI processing failed');
  }

  note.aiSummary = summary;
  note.tags = normalizeTags([...note.tags, ...tags]);
  await note.save();

  res.status(200).json(note);
};

const ALLOWED_ACTION_TYPES = new Set(['add_tags', 'merge_notes', 'create_note']);
const MAX_SUGGESTED_ACTIONS = 5;
const NOTE_INDEX_LIMIT = 200;

// Momo's suggestedActions come back from Gemini as free-form JSON — never
// trust them at face value. Every noteId is checked against validNoteIds
// (the same index we told Momo about) so a hallucinated or foreign id can
// never reach an execute-time endpoint via the client.
const sanitizeSuggestedActions = (actions, validNoteIds) => {
  const sanitized = [];
  for (const action of actions) {
    if (!action || !ALLOWED_ACTION_TYPES.has(action.type) || !action.payload) continue;
    const { type, payload } = action;

    if (type === 'add_tags') {
      if (typeof payload.noteId !== 'string' || !validNoteIds.has(payload.noteId)) continue;
      const tags = normalizeTags(payload.tags);
      if (tags.length === 0) continue;
      sanitized.push({ type, payload: { noteId: payload.noteId, tags } });
    } else if (type === 'merge_notes') {
      if (!Array.isArray(payload.noteIds) || payload.noteIds.length !== 2) continue;
      const [a, b] = payload.noteIds;
      if (a === b || !validNoteIds.has(a) || !validNoteIds.has(b)) continue;
      const reason = typeof payload.reason === 'string' ? payload.reason.trim().slice(0, 300) : '';
      sanitized.push({ type, payload: { noteIds: [a, b], reason } });
    } else if (type === 'create_note') {
      const title = typeof payload.title === 'string' ? payload.title.trim().slice(0, 200) : '';
      const body = typeof payload.body === 'string' ? payload.body.trim().slice(0, 4000) : '';
      if (!title || !body) continue;
      sanitized.push({ type, payload: { title, body } });
    }

    if (sanitized.length >= MAX_SUGGESTED_ACTIONS) break;
  }
  return sanitized;
};

// Marks the end of the streamed answer text and the start of a trusted JSON
// blob ({sources, suggestedActions}) — distinct from aiService's
// STREAM_META_DELIMITER, which is Gemini-facing and never reaches the
// client: everything after that internal delimiter is parsed and run
// through sanitizeSuggestedActions here first, and only the sanitized
// result is ever written using THIS delimiter. The client (AskAIModal)
// splits its accumulated response on this string.
const CLIENT_META_DELIMITER = '\n<<<NOTEMIND_META>>>\n';

const writeFallbackReply = (res, text) => {
  res.write(text);
  res.write(CLIENT_META_DELIMITER + JSON.stringify({ sources: [], suggestedActions: [] }));
  res.end();
};

const askNotes = async (req, res) => {
  const question = typeof req.body.question === 'string' ? req.body.question.trim() : '';
  if (!question) {
    throw new HttpError(400, 'Question is required');
  }

  const notes = await Note.find({ user: req.user.id }).select('+embedding');
  const usableNotes = notes.filter((note) => note.body && note.body.trim() !== '');

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');

  if (usableNotes.length === 0) {
    return writeFallbackReply(res, "You don't have any notes with content yet — add some notes first and I can answer questions about them.");
  }

  const { scored } = await rankNotesByRelevance(question, usableNotes);

  // Semantic cosine similarity is rarely exactly 0 even for unrelated notes
  // (embedding space isn't perfectly orthogonal), so ">0" isn't a meaningful
  // "did we actually find anything relevant" signal the way it was for
  // discrete keyword points — use a real minimum-similarity threshold there.
  // Each note may have been scored semantically or via keyword fallback
  // independently (mixed-mode, see rankNotesByRelevance), so the threshold
  // must be picked per-note from its own scoring mode, not the query's.
  const passesThreshold = (s) => s.score > (s.isSemantic ? 5.8 : 0);
  const hasMatches = passesThreshold(scored[0]);
  const topNotes = hasMatches
    ? scored.filter(passesThreshold).slice(0, TOP_NOTES_LIMIT).map((s) => s.note)
    : [...usableNotes].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, TOP_NOTES_LIMIT);

  const activeNotes = usableNotes.filter((n) => !n.archivedAt && !n.deletedAt).slice(0, NOTE_INDEX_LIMIT);
  const noteIndex = activeNotes.map((n) => ({ id: n._id.toString(), title: n.title, tags: n.tags }));

  let stream;
  try {
    stream = streamAnswerFromNotes(question, topNotes, noteIndex);
  } catch {
    return writeFallbackReply(res, "Sorry, I couldn't reach the AI service just now. Try again in a moment.");
  }

  // Buffers everything Gemini has sent so far so the (possibly
  // chunk-boundary-split) delimiter can be found reliably; only the
  // confirmed-safe prefix — never text that might be the delimiter's start —
  // is forwarded to the client as each chunk arrives.
  let full = '';
  let sentUpTo = 0;
  let delimIndex = -1;
  try {
    for await (const chunk of stream) {
      full += chunk.text || '';
      if (delimIndex !== -1) continue;
      delimIndex = full.indexOf(STREAM_META_DELIMITER);
      if (delimIndex === -1) {
        const safeUpTo = Math.max(sentUpTo, full.length - (STREAM_META_DELIMITER.length - 1));
        if (safeUpTo > sentUpTo) {
          res.write(full.slice(sentUpTo, safeUpTo));
          sentUpTo = safeUpTo;
        }
      } else if (delimIndex > sentUpTo) {
        res.write(full.slice(sentUpTo, delimIndex));
        sentUpTo = delimIndex;
      }
    }
  } catch {
    // Failed mid-stream (rare — see aiService.withRetryStream) — whatever
    // answer text already reached the client stays; end here rather than
    // writing a raw error into the middle of Momo's reply.
    return res.end();
  }

  let usedNoteIndexes = [];
  let suggestedActions = [];
  if (delimIndex !== -1) {
    try {
      const parsed = JSON.parse(stripJsonFences(full.slice(delimIndex + STREAM_META_DELIMITER.length)));
      usedNoteIndexes = Array.isArray(parsed.usedNoteIndexes) ? parsed.usedNoteIndexes : [];
      suggestedActions = Array.isArray(parsed.suggestedActions) ? parsed.suggestedActions : [];
    } catch {
      // Metadata didn't parse — degrade to answer-only, same as the branch below.
    }
  } else if (sentUpTo < full.length) {
    // Model never produced the delimiter at all — flush the tail that was
    // being withheld in case it turned out to be one.
    res.write(full.slice(sentUpTo));
  }

  const sources = usedNoteIndexes
    .filter((i) => Number.isInteger(i) && topNotes[i])
    .map((i) => ({ _id: topNotes[i]._id, title: topNotes[i].title }));

  const validNoteIds = new Set(noteIndex.map((n) => n.id));
  const actions = sanitizeSuggestedActions(suggestedActions, validNoteIds);

  res.write(CLIENT_META_DELIMITER + JSON.stringify({ sources, suggestedActions: actions }));
  res.end();
};

const SEARCH_RESULTS_LIMIT = 10;
// Cosine similarity below this is treated as noise, not a real match —
// gemini-embedding-001 baseline similarity between totally unrelated
// everyday-English notes commonly sits ~0.5-0.6, so a low threshold like
// 0.45 lets unrelated notes through. 0.58 was tuned empirically against a
// small manual test set (distinct-topic notes scored ~0.55, genuinely
// related notes ~0.6-0.7) — worth revisiting with more real usage data.
const SEARCH_MIN_SIMILARITY = 0.58;

// Powers the Dashboard search bar's "find by meaning" augmentation — the
// instant substring filter stays client-side and unchanged; this endpoint
// supplies additional note ids that are semantically relevant even when they
// share no keywords with the query, merged in client-side.
const searchNotes = async (req, res) => {
  const query = typeof req.body.query === 'string' ? req.body.query.trim() : '';
  if (!query) {
    throw new HttpError(400, 'Query is required');
  }

  let queryEmbedding = [];
  try {
    queryEmbedding = await embedText(query, 'RETRIEVAL_QUERY');
  } catch {
    throw new HttpError(500, 'Search failed');
  }
  if (!queryEmbedding.length) {
    return res.status(200).json({ noteIds: [] });
  }

  const notes = await Note.find({ user: req.user.id }).select('+embedding');
  const noteIds = notes
    .filter((n) => n.embedding?.length)
    .map((n) => ({ id: n._id, score: cosineSimilarity(queryEmbedding, n.embedding) }))
    .filter((r) => r.score >= SEARCH_MIN_SIMILARITY)
    .sort((a, b) => b.score - a.score)
    .slice(0, SEARCH_RESULTS_LIMIT)
    .map((r) => r.id);

  res.status(200).json({ noteIds });
};

const DIGEST_WINDOW_DAYS = 7;
const DIGEST_NOTES_LIMIT = 20;
// "On this day" resurfacing — matches notes created exactly N days ago
// rather than requiring a full calendar year (the classic "this day last
// year" pattern needs a userbase old enough to have year-old notes; these
// shorter, more frequent checkpoints give a fresh account something to
// resurface much sooner).
const RESURFACE_DAY_OFFSETS = [7, 14, 30, 90, 180, 365];

// Dashboard's "Momo's Recap" + "On this day" widget. Both are best-effort:
// a Gemini failure degrades the recap to null rather than failing the whole
// request, since resurfaced notes (a pure DB query, no AI involved) are
// still useful on their own.
const getDigest = async (req, res) => {
  const weekAgo = new Date(Date.now() - DIGEST_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const recentNotes = await Note.find({
    user: req.user.id,
    updatedAt: { $gte: weekAgo },
    deletedAt: null,
  }).sort({ updatedAt: -1 }).limit(DIGEST_NOTES_LIMIT);

  let digest = null;
  if (recentNotes.length > 0) {
    try {
      digest = await generateWeeklyDigest(recentNotes);
    } catch {
      digest = null;
    }
  }

  const seen = new Set();
  const onThisDay = [];
  for (const days of RESURFACE_DAY_OFFSETS) {
    const start = new Date();
    start.setDate(start.getDate() - days);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setHours(23, 59, 59, 999);

    const found = await Note.find({
      user: req.user.id,
      createdAt: { $gte: start, $lte: end },
      deletedAt: null,
    }).select('title folder createdAt');

    for (const note of found) {
      if (!seen.has(note._id.toString())) {
        seen.add(note._id.toString());
        onThisDay.push(note);
      }
    }
  }

  res.status(200).json({ digest, noteCount: recentNotes.length, onThisDay });
};

const NOTE_DAY_MS = 24 * 60 * 60 * 1000;
// Local calendar day (not UTC, unlike flashcardController.getReviewStreak's
// dayKey) — matches how the rest of this file already handles day
// boundaries (see the RESURFACE_DAY_OFFSETS loop above, which uses plain
// setHours too).
const dayKey = (date) => new Date(date).toDateString();
// Local calendar date as 'YYYY-MM-DD' for JSON output — NOT toISOString(),
// which converts to UTC first and would shift the date by a day for any
// timezone ahead of UTC (e.g. local midnight in UTC+5 is still the previous
// day in UTC).
const localIsoDate = (date) => {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

// Consecutive-day streak of note activity (created or edited), walking back
// from today the same way flashcardController.getReviewStreak walks back
// through review days — if nothing's been touched yet today, the streak
// still counts through yesterday, so it doesn't flicker to 0 every morning
// before the user's had a chance to write anything today. Fully derived from
// Note.createdAt/updatedAt on every call (no persisted counter) so it can
// never drift out of sync with the real data.
const getNoteStreak = async (req, res) => {
  const notes = await Note.find({ user: req.user.id }).select('createdAt updatedAt').lean();
  const activeDays = new Set();
  for (const n of notes) {
    activeDays.add(dayKey(n.createdAt));
    activeDays.add(dayKey(n.updatedAt));
  }

  let cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  if (!activeDays.has(dayKey(cursor))) {
    cursor = new Date(cursor.getTime() - NOTE_DAY_MS);
  }

  let streak = 0;
  while (activeDays.has(dayKey(cursor))) {
    streak++;
    cursor = new Date(cursor.getTime() - NOTE_DAY_MS);
  }

  // Longest-ever run of consecutive active days, not just the current
  // trailing one above — walk the distinct active days in order and track
  // the longest unbroken run.
  const sortedDayTimes = [...activeDays].map((key) => new Date(key).getTime()).sort((a, b) => a - b);
  let longestStreak = 0;
  let run = 0;
  let prevTime = null;
  for (const t of sortedDayTimes) {
    run = prevTime !== null && t - prevTime === NOTE_DAY_MS ? run + 1 : 1;
    longestStreak = Math.max(longestStreak, run);
    prevTime = t;
  }

  // Last 14 calendar days, oldest first — lets the client show exactly
  // which days actually counted, not just the final number.
  const STREAK_WINDOW_DAYS = 14;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = [];
  for (let i = STREAK_WINDOW_DAYS - 1; i >= 0; i--) {
    const d = new Date(today.getTime() - i * NOTE_DAY_MS);
    days.push({ date: localIsoDate(d), active: activeDays.has(dayKey(d)) });
  }

  res.status(200).json({ streak, longestStreak, days });
};

const ACTIVITY_MAX_RANGE_DAYS = 400;

// Day-by-day note-creation counts for an arbitrary [from, to] range — backs
// the Month/Custom views of the Dashboard's "Daily activity" chart. Unlike
// the trailing-7-day view (computed client-side from the already-loaded,
// capped-at-200-notes list — see Dashboard.jsx's fetchNotes — which is
// always safe for a single week but not for a wider range), this queries
// the full note set server-side, so counts stay correct regardless of how
// far back the range reaches or how many notes the account has.
const getNoteActivity = async (req, res) => {
  const from = new Date(`${req.query.from}T00:00:00`);
  const to = new Date(`${req.query.to}T23:59:59.999`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to < from) {
    throw new HttpError(400, 'Invalid from/to date range');
  }
  const rangeDays = Math.round((to.getTime() - from.getTime()) / NOTE_DAY_MS) + 1;
  if (rangeDays > ACTIVITY_MAX_RANGE_DAYS) {
    throw new HttpError(400, `Range too large (max ${ACTIVITY_MAX_RANGE_DAYS} days)`);
  }

  const notes = await Note.find({
    user: req.user.id,
    createdAt: { $gte: from, $lte: to },
  }).select('createdAt').lean();

  const counts = {};
  for (const n of notes) {
    const key = localIsoDate(n.createdAt);
    counts[key] = (counts[key] || 0) + 1;
  }

  const days = [];
  for (let i = 0; i < rangeDays; i++) {
    const key = localIsoDate(new Date(from.getTime() + i * NOTE_DAY_MS));
    days.push({ date: key, count: counts[key] || 0 });
  }

  res.status(200).json({ days });
};

const suggestTitle = async (req, res) => {
  const body = typeof req.body.body === 'string' ? req.body.body.trim() : '';
  if (!body) {
    throw new HttpError(400, 'Note body is required to suggest a title');
  }

  let title;
  try {
    title = await generateTitle(body);
  } catch {
    throw new HttpError(500, 'Title suggestion failed');
  }

  res.status(200).json({ title });
};

const WRITING_ASSIST_ACTIONS = new Set(['continue', 'improve', 'shorten', 'fix-grammar']);
const WRITING_ASSIST_MAX_LENGTH = 8000;

const assistNoteWriting = async (req, res) => {
  const { action } = req.body;
  const text = typeof req.body.text === 'string' ? req.body.text.trim() : '';

  if (!WRITING_ASSIST_ACTIONS.has(action)) {
    throw new HttpError(400, 'Invalid or missing action');
  }
  if (!text) {
    throw new HttpError(400, 'Text is required');
  }
  if (text.length > WRITING_ASSIST_MAX_LENGTH) {
    throw new HttpError(400, `Text exceeds ${WRITING_ASSIST_MAX_LENGTH} characters`);
  }

  let result;
  try {
    result = await assistWriting(action, text);
  } catch {
    throw new HttpError(500, 'AI writing assist failed');
  }

  res.status(200).json({ result });
};

// Maps the *detected* (not client-declared) mime type to the extension used
// in the generated filename — file-type is ESM-only, hence the dynamic
// import inside an otherwise-CommonJS controller.
const ALLOWED_IMAGE_EXTENSIONS = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
};

const uploadImage = async (req, res) => {
  if (!req.file) throw new HttpError(400, 'No image file provided');

  const { fileTypeFromBuffer } = await import('file-type');
  const detected = await fileTypeFromBuffer(req.file.buffer);
  const ext = detected && ALLOWED_IMAGE_EXTENSIONS[detected.mime];
  if (!ext) {
    throw new HttpError(400, 'Unsupported or invalid image file');
  }

  // Never trust the client's original filename (or its declared mimetype) —
  // the generated name is the only thing sanitizeNoteHtml's exclusiveFilter
  // regex will ever allow back into a note's contentHtml.
  const filename = `${req.user.id}-${crypto.randomUUID()}.${ext}`;
  await fs.writeFile(path.join(uploadsDir, filename), req.file.buffer);

  res.status(201).json({ url: urlFor(filename) });
};

// A real backup, not just "the current view" — includes archived/trashed notes
// with their state flags intact, so a restore (manual for now; there's no
// import endpoint yet) wouldn't silently lose that context.
const exportNotesJson = async (req, res) => {
  const notes = await Note.find({ user: req.user.id })
    .select('-embedding')
    .sort({ createdAt: 1 });

  const exportDate = new Date().toISOString().slice(0, 10);
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="notemind-export-${exportDate}.json"`);
  res.status(200).json({
    exportedAt: new Date().toISOString(),
    noteCount: notes.length,
    notes,
  });
};

// Strips characters that are unsafe/awkward across filesystems and appends a
// short id suffix — titles collide constantly in practice (this account alone
// has several notes literally titled "sss"/"ss"), so the suffix is load-bearing,
// not decorative.
const safeMarkdownFilename = (title, id) => {
  const base = (title || 'untitled')
    .trim()
    .replace(/[/\\?%*:|"<>]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60) || 'untitled';
  return `${base} (${id.toString().slice(-6)}).md`;
};

const exportNotesMarkdown = async (req, res) => {
  const notes = await Note.find({ user: req.user.id })
    .select('-embedding')
    .sort({ createdAt: 1 });

  const exportDate = new Date().toISOString().slice(0, 10);
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="notemind-export-${exportDate}.zip"`);

  const archive = archiver('zip', { zlib: { level: 9 } });
  // Errors from the archiver stream arrive via this event, not as a rejected
  // promise — throwing here would be an uncaught exception in an event
  // callback, not something the controller's own async/await could catch.
  archive.on('error', (err) => {
    console.error('Export archive error:', err);
    if (!res.headersSent) res.status(500).json({ message: 'Export failed' });
    else res.end();
  });
  archive.pipe(res);

  const usedNames = new Set();
  for (const note of notes) {
    let filename = safeMarkdownFilename(note.title, note._id);
    while (usedNames.has(filename)) filename = filename.replace(/\.md$/, '-dup.md');
    usedNames.add(filename);

    const frontMatter = [
      '---',
      `title: ${JSON.stringify(note.title)}`,
      `folder: ${JSON.stringify(note.folder)}`,
      `tags: [${note.tags.map((t) => JSON.stringify(t)).join(', ')}]`,
      `createdAt: ${note.createdAt.toISOString()}`,
      `updatedAt: ${note.updatedAt.toISOString()}`,
      '---',
      '',
    ].join('\n');

    const markdown = htmlToMarkdown(note.contentHtml) || note.body || '';
    archive.append(`${frontMatter}${markdown}\n`, { name: filename });
  }

  await archive.finalize();
};

module.exports = {
  getNotes,
  getNoteById,
  createNote,
  updateNote,
  deleteNote,
  restoreNote,
  permanentlyDeleteNote,
  togglePinNote,
  archiveNote,
  unarchiveNote,
  getNoteVersions,
  restoreNoteVersion,
  processNoteWithAI,
  askNotes,
  searchNotes,
  getDigest,
  getNoteStreak,
  getNoteActivity,
  suggestTitle,
  assistNoteWriting,
  exportNotesJson,
  exportNotesMarkdown,
  uploadImage,
};
