const Flashcard = require('../models/Flashcard');
const Note = require('../models/Note');
const HttpError = require('../utils/HttpError');
const { generateFlashcards } = require('../services/aiService');
const { applySM2 } = require('../utils/spacedRepetition');
const { broadcastAdminUpdate } = require('../services/socket');

const DUE_LIMIT = 50;

// Generates a fresh batch of cards from a note's current body and appends
// them to whatever cards already exist for it — repeated generation on an
// edited note builds up a deck rather than silently overwriting past cards
// (a user may have already reviewed and progressed some of them).
const generateFlashcardsForNote = async (req, res) => {
  const note = await Note.findById(req.params.id);
  if (!note) throw new HttpError(404, 'Note not found');
  if (note.user.toString() !== req.user.id) throw new HttpError(403, 'Not authorized to generate flashcards for this note');
  if (!note.body || !note.body.trim()) throw new HttpError(400, 'Note body is empty, nothing to generate flashcards from');

  let cards;
  try {
    cards = await generateFlashcards(note.body);
  } catch {
    throw new HttpError(500, 'Flashcard generation failed');
  }
  if (cards.length === 0) throw new HttpError(500, 'Flashcard generation failed');

  const created = await Flashcard.insertMany(
    cards.map((c) => ({ user: req.user.id, note: note._id, question: c.question, answer: c.answer }))
  );

  broadcastAdminUpdate('flashcard');
  res.status(201).json(created);
};

const getNoteFlashcards = async (req, res) => {
  const note = await Note.findById(req.params.id);
  if (!note) throw new HttpError(404, 'Note not found');
  if (note.user.toString() !== req.user.id) throw new HttpError(403, 'Not authorized to view flashcards for this note');

  const cards = await Flashcard.find({ note: req.params.id, user: req.user.id }).sort({ createdAt: -1 });
  res.status(200).json(cards);
};

const getDueFlashcards = async (req, res) => {
  const cards = await Flashcard.find({ user: req.user.id, dueDate: { $lte: new Date() } })
    .sort({ dueDate: 1 })
    .limit(DUE_LIMIT)
    .populate('note', 'title');
  res.status(200).json(cards);
};

const reviewFlashcard = async (req, res) => {
  const quality = Number(req.body.quality);
  if (!Number.isInteger(quality) || quality < 0 || quality > 5) {
    throw new HttpError(400, 'quality must be an integer from 0 to 5');
  }

  const card = await Flashcard.findById(req.params.id);
  if (!card) throw new HttpError(404, 'Flashcard not found');
  if (card.user.toString() !== req.user.id) throw new HttpError(403, 'Not authorized to review this flashcard');

  Object.assign(card, applySM2(card, quality));
  card.lastReviewedAt = new Date();
  await card.save();

  res.status(200).json(card);
};

const DAY_MS = 24 * 60 * 60 * 1000;
const dayKey = (date) => date.toISOString().slice(0, 10);

// Consecutive-day streak of actual reviews (see Flashcard.lastReviewedAt),
// walking back from today. If nothing's been reviewed yet today, the streak
// still counts through yesterday — otherwise it would flicker to 0 every
// morning before the user gets a chance to review, even with an unbroken
// streak everywhere else.
const getReviewStreak = async (req, res) => {
  const cards = await Flashcard.find({ user: req.user.id, lastReviewedAt: { $ne: null } })
    .select('lastReviewedAt')
    .lean();
  const reviewedDays = new Set(cards.map((c) => dayKey(c.lastReviewedAt)));

  let cursor = new Date();
  cursor.setUTCHours(0, 0, 0, 0);
  if (!reviewedDays.has(dayKey(cursor))) {
    cursor = new Date(cursor.getTime() - DAY_MS);
  }

  let streak = 0;
  while (reviewedDays.has(dayKey(cursor))) {
    streak++;
    cursor = new Date(cursor.getTime() - DAY_MS);
  }

  res.status(200).json({ streak });
};

const deleteFlashcard = async (req, res) => {
  const card = await Flashcard.findById(req.params.id);
  if (!card) throw new HttpError(404, 'Flashcard not found');
  if (card.user.toString() !== req.user.id) throw new HttpError(403, 'Not authorized to delete this flashcard');

  await Flashcard.findByIdAndDelete(req.params.id);
  broadcastAdminUpdate('flashcard');
  res.status(200).json({ message: 'Flashcard deleted' });
};

module.exports = {
  generateFlashcardsForNote,
  getNoteFlashcards,
  getDueFlashcards,
  reviewFlashcard,
  deleteFlashcard,
  getReviewStreak,
};
