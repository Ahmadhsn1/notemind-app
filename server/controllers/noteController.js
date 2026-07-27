const Note = require('../models/Note');
const { summarizeAndTag, answerFromNotes, generateTitle } = require('../services/aiService');

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Fetches a note and enforces ownership; throws HttpError(404/403) so callers
// can turn it into the same response they already returned inline.
const loadOwnedNote = async (id, userId, action) => {
  const note = await Note.findById(id);
  if (!note) throw new HttpError(404, 'Note not found');
  if (note.user.toString() !== userId) throw new HttpError(403, `Not authorized to ${action} this note`);
  return note;
};

const normalizeFolder = (folder) => (typeof folder === 'string' ? folder.trim() : '') || 'General';

const normalizeTags = (tags) => {
  if (!Array.isArray(tags)) return [];
  const cleaned = tags.map((t) => (typeof t === 'string' ? t.trim() : '')).filter(Boolean);
  return Array.from(new Set(cleaned));
};

const TOP_NOTES_LIMIT = 6;

// Simple keyword-overlap retrieval — no vector DB needed at this scale.
// Title matches count more than body matches; words under 3 chars are
// skipped so common short words don't dominate the score.
const scoreNoteRelevance = (question, note) => {
  const words = question.toLowerCase().match(/\w+/g) || [];
  const title = note.title.toLowerCase();
  const body = note.body.toLowerCase();

  let score = 0;
  for (const word of new Set(words)) {
    if (word.length < 3) continue;
    if (title.includes(word)) score += 3;
    if (body.includes(word)) score += 1;
  }
  return score;
};

const getNotes = async (req, res) => {
  try {
    const notes = await Note.find({ user: req.user.id }).sort({ createdAt: -1 });
    res.status(200).json(notes);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const getNoteById = async (req, res) => {
  try {
    const note = await loadOwnedNote(req.params.id, req.user.id, 'view');
    res.status(200).json(note);
  } catch (error) {
    if (error instanceof HttpError) return res.status(error.status).json({ message: error.message });
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const createNote = async (req, res) => {
  try {
    const { title, body, tags, folder } = req.body;

    const note = await Note.create({
      user: req.user.id,
      title,
      body,
      tags: normalizeTags(tags),
      folder: normalizeFolder(folder),
    });

    res.status(201).json(note);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const updateNote = async (req, res) => {
  try {
    await loadOwnedNote(req.params.id, req.user.id, 'update');

    const updates = {};
    if (req.body.title !== undefined) updates.title = req.body.title;
    if (req.body.body !== undefined) updates.body = req.body.body;
    if (req.body.tags !== undefined) updates.tags = normalizeTags(req.body.tags);
    if (req.body.folder !== undefined) updates.folder = normalizeFolder(req.body.folder);

    const updatedNote = await Note.findByIdAndUpdate(req.params.id, updates, {
      new: true,
    });

    res.status(200).json(updatedNote);
  } catch (error) {
    if (error instanceof HttpError) return res.status(error.status).json({ message: error.message });
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const deleteNote = async (req, res) => {
  try {
    await loadOwnedNote(req.params.id, req.user.id, 'delete');

    await Note.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: 'Note deleted successfully' });
  } catch (error) {
    if (error instanceof HttpError) return res.status(error.status).json({ message: error.message });
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const processNoteWithAI = async (req, res) => {
  try {
    const note = await loadOwnedNote(req.params.id, req.user.id, 'process');

    if (!note.body || note.body.trim() === '') {
      return res.status(400).json({ message: 'Note body is empty, nothing to summarize' });
    }

    const { summary, tags } = await summarizeAndTag(note.body);

    note.aiSummary = summary;
    note.tags = normalizeTags([...note.tags, ...tags]);
    await note.save();

    res.status(200).json(note);
  } catch (error) {
    if (error instanceof HttpError) return res.status(error.status).json({ message: error.message });
    res.status(500).json({ message: 'AI processing failed', error: error.message });
  }
};

const askNotes = async (req, res) => {
  try {
    const question = typeof req.body.question === 'string' ? req.body.question.trim() : '';
    if (!question) {
      return res.status(400).json({ message: 'Question is required' });
    }

    const notes = await Note.find({ user: req.user.id });
    const usableNotes = notes.filter((note) => note.body && note.body.trim() !== '');

    if (usableNotes.length === 0) {
      return res.status(200).json({
        answer: "You don't have any notes with content yet — add some notes first and I can answer questions about them.",
        sources: [],
      });
    }

    const scored = usableNotes
      .map((note) => ({ note, score: scoreNoteRelevance(question, note) }))
      .sort((a, b) => b.score - a.score);

    const hasMatches = scored[0].score > 0;
    const topNotes = hasMatches
      ? scored.filter((s) => s.score > 0).slice(0, TOP_NOTES_LIMIT).map((s) => s.note)
      : [...usableNotes].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, TOP_NOTES_LIMIT);

    const { answer, usedNoteIndexes } = await answerFromNotes(question, topNotes);

    const sources = usedNoteIndexes
      .filter((i) => Number.isInteger(i) && topNotes[i])
      .map((i) => ({ _id: topNotes[i]._id, title: topNotes[i].title }));

    res.status(200).json({ answer, sources });
  } catch (error) {
    res.status(500).json({ message: 'AI question answering failed', error: error.message });
  }
};

const suggestTitle = async (req, res) => {
  try {
    const body = typeof req.body.body === 'string' ? req.body.body.trim() : '';
    if (!body) {
      return res.status(400).json({ message: 'Note body is required to suggest a title' });
    }

    const title = await generateTitle(body);
    res.status(200).json({ title });
  } catch (error) {
    res.status(500).json({ message: 'Title suggestion failed', error: error.message });
  }
};

module.exports = {
  getNotes,
  getNoteById,
  createNote,
  updateNote,
  deleteNote,
  processNoteWithAI,
  askNotes,
  suggestTitle,
};
