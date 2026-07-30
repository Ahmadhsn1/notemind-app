const mongoose = require('mongoose');

// SM-2 spaced-repetition fields (easeFactor/interval/repetitions/dueDate) —
// see utils/spacedRepetition.applySM2, which is the only place that mutates
// them after creation. dueDate defaults to now so a freshly generated card
// shows up in the next review session immediately.
const flashcardSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  note: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Note',
    required: true,
  },
  question: {
    type: String,
    required: true,
  },
  answer: {
    type: String,
    required: true,
  },
  easeFactor: {
    type: Number,
    default: 2.5,
  },
  interval: {
    type: Number,
    default: 0,
  },
  repetitions: {
    type: Number,
    default: 0,
  },
  dueDate: {
    type: Date,
    default: Date.now,
  },
  // Set only in reviewFlashcard, never on creation — distinct from `updatedAt`
  // (which insertMany also stamps) so streak calculation only counts days the
  // user actually reviewed a card, not days they merely generated a deck.
  lastReviewedAt: {
    type: Date,
    default: null,
  },
}, { timestamps: true });

flashcardSchema.index({ user: 1, dueDate: 1 });
flashcardSchema.index({ note: 1 });

module.exports = mongoose.model('Flashcard', flashcardSchema);
