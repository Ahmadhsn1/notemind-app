const mongoose = require('mongoose');

// A user-authored note starting point — distinct from the fixed
// NOTE_TEMPLATES array on the client (client/src/utils/noteTemplates.js),
// which stays code-only and isn't editable/deletable. This model backs the
// "create your own template" flow: save any note's title/content as a
// reusable template, then edit or delete it later.
const templateSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 80,
  },
  title: {
    type: String,
    trim: true,
    default: '',
    maxlength: 300,
  },
  // Sanitized through the exact same allowlist as Note.contentHtml (see
  // templateController) so a saved template round-trips through
  // NoteEditor/NoteFormModal with nothing stripped the second time around.
  contentHtml: {
    type: String,
    default: '',
  },
}, { timestamps: true });

// Most-recently-updated first is the natural order for a picker list — a
// template someone just tweaked should surface at the top, not wherever it
// happened to sort by creation date.
templateSchema.index({ user: 1, updatedAt: -1 });

module.exports = mongoose.model('Template', templateSchema);
