require('dotenv').config();
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs/promises');
const Note = require('../models/Note');
const NoteVersion = require('../models/NoteVersion');
const Flashcard = require('../models/Flashcard');
const Resurface = require('../models/Resurface');
const Notification = require('../models/Notification');
const User = require('../models/User');
const { uploadsDir } = require('../services/uploadStorage');

// READ-ONLY audit of referential integrity across every collection. Writes
// nothing. Counts the data left behind by the pre-dataCleanup delete paths,
// which each cascaded through a different subset of collections — see
// services/dataCleanup.js for the fix. Run it after a repair to confirm the
// numbers went to zero, or periodically as a canary.
const run = async () => {
  await mongoose.connect(process.env.MONGO_URI);

  const noteIds = new Set((await Note.find().distinct('_id')).map(String));
  const userIds = new Set((await User.find().distinct('_id')).map(String));

  const versions = await NoteVersion.find().select('note').lean();
  const cards = await Flashcard.find().select('note user').lean();
  const resurfaces = await Resurface.find().select('user oldNote anchorNote').lean();
  const notes = await Note.find().select('user links contentHtml').lean();
  const notifications = await Notification.find().select('recipients').lean();

  const missingNote = (id) => id && !noteIds.has(String(id));
  const missingUser = (id) => id && !userIds.has(String(id));

  const referencedImages = new Set();
  for (const note of notes) {
    for (const match of (note.contentHtml || '').matchAll(/\/uploads\/([A-Za-z0-9_-]+\.(?:png|jpe?g|gif|webp))/g)) {
      referencedImages.add(match[1]);
    }
  }
  let onDisk = [];
  try {
    onDisk = (await fs.readdir(uploadsDir)).filter((f) => !f.startsWith('.'));
  } catch {
    // uploads dir may not exist yet
  }

  const findings = [
    ['NoteVersions whose note is gone', versions.filter((v) => missingNote(v.note)).length],
    ['Flashcards whose note is gone', cards.filter((c) => missingNote(c.note)).length],
    ['Flashcards whose user is gone', cards.filter((c) => missingUser(c.user)).length],
    ['Notes whose user is gone', notes.filter((n) => missingUser(n.user)).length],
    ['Resurface rows whose user is gone', resurfaces.filter((r) => missingUser(r.user)).length],
    ['Resurface rows with a dangling oldNote', resurfaces.filter((r) => missingNote(r.oldNote)).length],
    ['Resurface rows with a dangling anchorNote', resurfaces.filter((r) => missingNote(r.anchorNote)).length],
    ['Notes with a dangling wikilink target', notes.filter((n) => (n.links || []).some(missingNote)).length],
    ['Notifications with a deleted recipient', notifications.filter((n) => (n.recipients || []).some(missingUser)).length],
    ['Notes stuck archived AND trashed', await Note.countDocuments({ archivedAt: { $ne: null }, deletedAt: { $ne: null } })],
    ['Upload files referenced by no note', onDisk.filter((f) => !referencedImages.has(f)).length],
  ];

  console.log(`\nScope: ${notes.length} notes, ${userIds.size} users, ${onDisk.length} upload files\n`);
  let total = 0;
  for (const [label, count] of findings) {
    total += count;
    console.log(`  ${count === 0 ? '  ok' : 'ISSUE'}  ${String(count).padStart(6)}  ${label}`);
  }
  console.log(total === 0 ? '\nNo integrity issues found.\n' : `\n${total} orphaned/inconsistent record(s) total.\n`);

  await mongoose.disconnect();
};

run().catch((err) => {
  console.error('Integrity check failed:', err.message);
  process.exit(1);
});
