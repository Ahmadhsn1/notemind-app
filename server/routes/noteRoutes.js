const express = require('express');
const router = express.Router();
const protect = require('../middleware/authMiddleware');
const {
  getNotes,
  getNoteById,
  createNote,
  updateNote,
  deleteNote,
} = require('../controllers/noteController');

router.get('/', protect, getNotes);
router.get('/:id', protect, getNoteById);
router.post('/', protect, createNote);
router.put('/:id', protect, updateNote);
router.delete('/:id', protect, deleteNote);

module.exports = router;
