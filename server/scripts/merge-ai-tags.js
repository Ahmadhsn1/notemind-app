require('dotenv').config();
const mongoose = require('mongoose');
const Note = require('../models/Note');

const run = async () => {
  await mongoose.connect(process.env.MONGO_URI);

  const notes = await Note.find({ aiTags: { $exists: true, $ne: [] } });
  let updated = 0;

  for (const note of notes) {
    const merged = Array.from(new Set([...(note.tags || []), ...note.aiTags]));
    note.tags = merged;
    note.set('aiTags', undefined, { strict: false });
    await note.save();
    updated += 1;
  }

  console.log(`Merged aiTags into tags for ${updated} note(s).`);
  await mongoose.disconnect();
};

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
