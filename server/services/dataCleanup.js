const Note = require('../models/Note');
const NoteVersion = require('../models/NoteVersion');
const Flashcard = require('../models/Flashcard');
const Resurface = require('../models/Resurface');
const Notification = require('../models/Notification');
const PasswordResetToken = require('../models/PasswordResetToken');
const { deleteFiles } = require('./uploadStorage');

// THE single place that knows what "deleting a note" and "deleting a user"
// actually entail.
//
// Before this existed there were six independent delete paths (the trash
// auto-purge, the user-facing permanent delete, the admin note delete, the
// self-service account delete, the admin user delete, and the admin bulk
// delete) and no two of them cleaned up the same set of collections. The
// user-visible symptoms were flashcards that kept quizzing you on notes you'd
// destroyed, and account deletion that left reflection history and uploaded
// images behind. Every one of those paths now calls into here, so the cascade
// can only ever drift in one place.
//
// Deliberately NOT cleaned up: AdminAuditLog. It snapshots targetLabel as
// plain text precisely so it stays readable after its subject is gone (see
// models/AdminAuditLog.js) — deleting a user is itself a logged action.

// Matches the `${userId}-${uuid}.${ext}` shape noteController.uploadImage
// generates, as embedded in stored contentHtml.
const UPLOAD_REF_PATTERN = /\/uploads\/([A-Za-z0-9_-]+\.(?:png|jpe?g|gif|webp))/g;

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const imageFilenamesIn = (contentHtml) => {
  const names = new Set();
  if (!contentHtml) return names;
  for (const match of contentHtml.matchAll(UPLOAD_REF_PATTERN)) {
    names.add(match[1]);
  }
  return names;
};

// An image is only safe to unlink once NO surviving note still references it.
// The previous implementation skipped this check and unlinked every image in
// the deleted note's HTML unconditionally — so pasting one image into two
// notes and deleting either one left the survivor with a permanently broken
// <img> and no way to recover the file.
const unreferencedImages = async (candidates, excludedNoteIds) => {
  if (candidates.size === 0) return [];

  const stillReferenced = await Note.find({
    _id: { $nin: excludedNoteIds },
    contentHtml: { $in: [...candidates].map((name) => new RegExp(escapeRegex(name))) },
  })
    .select('contentHtml')
    .lean();

  const keep = new Set();
  for (const note of stillReferenced) {
    for (const name of imageFilenamesIn(note.contentHtml)) keep.add(name);
  }

  return [...candidates].filter((name) => !keep.has(name));
};

/**
 * Hard-deletes the given notes and everything that hangs off them.
 * Safe to call with an empty list. Returns a summary for logging.
 */
const purgeNotes = async (noteIds) => {
  if (!noteIds || noteIds.length === 0) {
    return { notes: 0, versions: 0, flashcards: 0, images: 0 };
  }

  // Read the HTML before deleting the notes — it's the only record of which
  // uploads they referenced.
  const notes = await Note.find({ _id: { $in: noteIds } }).select('contentHtml').lean();
  const candidateImages = new Set();
  for (const note of notes) {
    for (const name of imageFilenamesIn(note.contentHtml)) candidateImages.add(name);
  }

  const [versions, flashcards] = await Promise.all([
    NoteVersion.deleteMany({ note: { $in: noteIds } }),
    Flashcard.deleteMany({ note: { $in: noteIds } }),
  ]);

  await Promise.all([
    // A resurfaced memory whose note is gone becomes a no-memory day rather
    // than a dangling reference: engagedAt (and therefore the user's
    // reflection streak) is preserved, while method:'none' keeps the document
    // coherent for serializeResurface and submitResurfaceReply, both of which
    // already treat a null oldNote as "nothing to reflect on today."
    Resurface.updateMany(
      { oldNote: { $in: noteIds } },
      { $set: { oldNote: null, method: 'none' } }
    ),
    Resurface.updateMany({ anchorNote: { $in: noteIds } }, { $set: { anchorNote: null } }),
    // Wikilinks pointing at a note that no longer exists would otherwise
    // linger in every other note's `links` array and in the graph view.
    Note.updateMany({ links: { $in: noteIds } }, { $pull: { links: { $in: noteIds } } }),
  ]);

  // Must run before the notes themselves are deleted, so the reference check
  // can exclude them by id rather than racing their removal.
  const orphanedImages = await unreferencedImages(candidateImages, noteIds);

  const deleted = await Note.deleteMany({ _id: { $in: noteIds } });
  const images = await deleteFiles(orphanedImages);

  return {
    notes: deleted.deletedCount,
    versions: versions.deletedCount,
    flashcards: flashcards.deletedCount,
    images,
  };
};

/**
 * Full account wipe for one or more users: their notes (via purgeNotes) plus
 * everything else scoped directly to the user.
 */
const purgeUsers = async (userIds) => {
  const ids = Array.isArray(userIds) ? userIds : [userIds];
  if (ids.length === 0) return { notes: 0, versions: 0, flashcards: 0, images: 0, resurfaces: 0 };

  const noteIds = await Note.find({ user: { $in: ids } }).distinct('_id');
  const noteSummary = await purgeNotes(noteIds);

  const [flashcards, resurfaces] = await Promise.all([
    // Notes are gone by now, so this only catches cards whose note reference
    // was already broken — belt-and-braces, normally a no-op.
    Flashcard.deleteMany({ user: { $in: ids } }),
    Resurface.deleteMany({ user: { $in: ids } }),
    // An outstanding reset link must not survive the account it belongs to —
    // a recycled email address could otherwise redeem it.
    PasswordResetToken.deleteMany({ user: { $in: ids } }),
    // Admin broadcasts are shared documents, so the user is pulled out of
    // them rather than the notification being deleted.
    Notification.updateMany(
      { $or: [{ recipients: { $in: ids } }, { readBy: { $in: ids } }] },
      { $pull: { recipients: { $in: ids }, readBy: { $in: ids } } }
    ),
  ]);

  // A broadcast nobody can see any more is just orphaned rows.
  await Notification.deleteMany({ recipients: { $size: 0 } });

  return {
    ...noteSummary,
    flashcards: noteSummary.flashcards + flashcards.deletedCount,
    resurfaces: resurfaces.deletedCount,
  };
};

module.exports = { purgeNotes, purgeUsers };
