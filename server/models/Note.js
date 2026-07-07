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
  body: {
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
  aiTags: {
    type: [String],
    default: [],
  },
}, { timestamps: true });

module.exports = mongoose.model('Note', noteSchema);
