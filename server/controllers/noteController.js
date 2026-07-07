const Note = require('../models/Note');

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
    const note = await Note.findById(req.params.id);
    if (!note) {
      return res.status(404).json({ message: 'Note not found' });
    }
    if (note.user.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to view this note' });
    }
    res.status(200).json(note);
  } catch (error) {
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
      tags,
      folder,
    });

    res.status(201).json(note);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const updateNote = async (req, res) => {
  try {
    const note = await Note.findById(req.params.id);
    if (!note) {
      return res.status(404).json({ message: 'Note not found' });
    }
    if (note.user.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to update this note' });
    }

    const updatedNote = await Note.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });

    res.status(200).json(updatedNote);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const deleteNote = async (req, res) => {
  try {
    const note = await Note.findById(req.params.id);
    if (!note) {
      return res.status(404).json({ message: 'Note not found' });
    }
    if (note.user.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to delete this note' });
    }

    await Note.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: 'Note deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = { getNotes, getNoteById, createNote, updateNote, deleteNote };
