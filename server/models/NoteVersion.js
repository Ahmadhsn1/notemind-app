const mongoose = require('mongoose');

// A snapshot of a Note's content taken immediately before an update that
// touches title/contentHtml — see noteController's snapshotVersion. Lets a
// user undo an AI-assist mistake or a bad edit without relying on browser
// undo, and makes restoring itself safe (restoring snapshots the pre-restore
// state too).
const noteVersionSchema = new mongoose.Schema({
  note: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Note',
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  contentHtml: {
    type: String,
    default: '',
  },
  body: {
    type: String,
    default: '',
  },
}, { timestamps: true });

noteVersionSchema.index({ note: 1, createdAt: -1 });

module.exports = mongoose.model('NoteVersion', noteVersionSchema);
