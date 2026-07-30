const express = require('express');
const router = express.Router();
const protect = require('../middleware/authMiddleware');
const { validateBody } = require('../middleware/validate');
const { createNoteSchema, updateNoteSchema } = require('../validators/noteValidators');
const { aiLimiter, uploadLimiter } = require('../middleware/rateLimit');
const upload = require('../middleware/upload');
const {
  getNotes,
  getNoteById,
  createNote,
  updateNote,
  deleteNote,
  restoreNote,
  permanentlyDeleteNote,
  togglePinNote,
  archiveNote,
  unarchiveNote,
  getNoteVersions,
  restoreNoteVersion,
  processNoteWithAI,
  askNotes,
  searchNotes,
  getDigest,
  getNoteStreak,
  getNoteActivity,
  suggestTitle,
  assistNoteWriting,
  exportNotesJson,
  exportNotesMarkdown,
  uploadImage,
} = require('../controllers/noteController');
const { generateFlashcardsForNote, getNoteFlashcards } = require('../controllers/flashcardController');

router.post('/ask', protect, aiLimiter, askNotes);
router.post('/search', protect, aiLimiter, searchNotes);
router.get('/digest', protect, aiLimiter, getDigest);
router.get('/streak', protect, getNoteStreak);
router.get('/activity', protect, getNoteActivity);
router.post('/suggest-title', protect, aiLimiter, suggestTitle);
router.post('/ai-assist', protect, aiLimiter, assistNoteWriting);
// Must come before GET /:id — otherwise Express treats "export" as an :id.
router.get('/export/json', protect, exportNotesJson);
router.get('/export/markdown', protect, exportNotesMarkdown);
router.post('/upload-image', protect, uploadLimiter, upload.single('image'), uploadImage);
router.get('/', protect, getNotes);
router.get('/:id', protect, getNoteById);
router.post('/', protect, validateBody(createNoteSchema), createNote);
router.put('/:id', protect, validateBody(updateNoteSchema), updateNote);
router.delete('/:id', protect, deleteNote);
router.post('/:id/restore', protect, restoreNote);
router.delete('/:id/permanent', protect, permanentlyDeleteNote);
router.patch('/:id/pin', protect, togglePinNote);
router.patch('/:id/archive', protect, archiveNote);
router.patch('/:id/unarchive', protect, unarchiveNote);
router.get('/:id/versions', protect, getNoteVersions);
router.post('/:id/versions/:versionId/restore', protect, restoreNoteVersion);
router.post('/:id/ai-process', protect, aiLimiter, processNoteWithAI);
router.post('/:id/flashcards', protect, aiLimiter, generateFlashcardsForNote);
router.get('/:id/flashcards', protect, getNoteFlashcards);

module.exports = router;
