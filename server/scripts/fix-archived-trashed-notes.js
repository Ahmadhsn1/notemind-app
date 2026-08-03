require('dotenv').config();
const mongoose = require('mongoose');
const Note = require('../models/Note');

// Repairs notes left in the impossible "archived AND trashed" state by the
// pre-fix archiveNote / adminController.archiveUserNote, which set archivedAt
// without clearing deletedAt. Such a note is excluded from the `active` view
// (needs both null) and the `archived` view (needs deletedAt null), so it only
// ever appeared in Trash — and purgeExpiredTrash hard-deletes anything in
// Trash older than 30 days. Every one of these is a note the user thought they
// had archived and is silently queued for destruction.
//
// Resolution: keep the ARCHIVE (clear deletedAt). Archiving was the user's
// most recent explicit intent, and it's the non-destructive reading — the
// opposite choice would leave the note on the purge path.
//
// Run with --dry to preview without writing.
const run = async () => {
  const dryRun = process.argv.includes('--dry');
  await mongoose.connect(process.env.MONGO_URI);

  const filter = { archivedAt: { $ne: null }, deletedAt: { $ne: null } };
  const affected = await Note.find(filter).select('_id title user archivedAt deletedAt').lean();

  if (affected.length === 0) {
    console.log('No notes are in the archived+trashed state — nothing to repair.');
    await mongoose.disconnect();
    return;
  }

  console.log(`Found ${affected.length} note(s) in the archived+trashed state:`);
  for (const note of affected) {
    console.log(
      `  ${note._id}  user=${note.user}  archived=${note.archivedAt.toISOString()}  trashed=${note.deletedAt.toISOString()}  "${note.title}"`
    );
  }

  if (dryRun) {
    console.log('\n--dry: no changes written. Re-run without --dry to repair.');
    await mongoose.disconnect();
    return;
  }

  const result = await Note.updateMany(filter, { $set: { deletedAt: null } });
  console.log(`\nRestored ${result.modifiedCount} note(s) to archived-only (deletedAt cleared).`);
  await mongoose.disconnect();
};

run().catch((err) => {
  console.error('Repair failed:', err);
  process.exit(1);
});
