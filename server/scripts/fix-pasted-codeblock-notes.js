require('dotenv').config();
const mongoose = require('mongoose');
const Note = require('../models/Note');
const { sanitizeNoteHtml } = require('../utils/htmlSanitizer');

// One-off cleanup for notes saved while the editor's paste handling wrapped
// whole pastes in <pre><code> (fixed in NoteEditor's strictCodeBlockExtension
// — see client/src/components/editor/strictCodeBlockExtension.js). Unwraps
// the leading <pre><code>...</code></pre> block into plain paragraphs; any
// markup after it (e.g. a trailing empty <p></p> from the editor) is left
// untouched. body/links/embedding are unaffected, since htmlToPlainText
// already reads through <pre>/<code> tags the same as <p> ones.
const CORRUPTED_PREFIX = /^<pre><code>([\s\S]*?)<\/code><\/pre>/;

const run = async () => {
  await mongoose.connect(process.env.MONGO_URI);

  const candidates = await Note.find({ contentHtml: { $regex: '^<pre><code>' } });
  let updated = 0;

  for (const note of candidates) {
    const match = note.contentHtml.match(CORRUPTED_PREFIX);
    if (!match) continue;

    const paragraphs = match[1]
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => `<p>${line}</p>`)
      .join('');

    note.contentHtml = sanitizeNoteHtml(paragraphs + note.contentHtml.slice(match[0].length));
    await note.save();
    updated += 1;
  }

  console.log(`Unwrapped ${updated} note(s) out of ${candidates.length} candidate(s).`);
  await mongoose.disconnect();
};

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
