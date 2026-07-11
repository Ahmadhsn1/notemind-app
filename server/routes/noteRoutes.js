const express = require('express');
const router = express.Router();
const protect = require('../middleware/authMiddleware');
const {
  getNotes,
  getNoteById,
  createNote,
  updateNote,
  deleteNote,
  processNoteWithAI,
  askNotes,
  suggestTitle,
} = require('../controllers/noteController');

router.post('/ask', protect, askNotes);
router.post('/suggest-title', protect, suggestTitle);
router.get('/', protect, getNotes);
router.get('/:id', protect, getNoteById);
router.post('/', protect, createNote);
router.put('/:id', protect, updateNote);
router.delete('/:id', protect, deleteNote);
router.post('/:id/ai-process', protect, processNoteWithAI);

module.exports = router;
