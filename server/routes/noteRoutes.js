const express = require('express');
const router = express.Router();
const protect = require('../middleware/authMiddleware');
const { validateBody } = require('../middleware/validate');
const {
  createNoteSchema,
  updateNoteSchema,
  askNotesSchema,
  searchNotesSchema,
  suggestTitleSchema,
  aiAssistSchema,
} = require('../validators/noteValidators');
const { aiLimiter, uploadLimiter, exportLimiter } = require('../middleware/rateLimit');
// aiLimiter caps burst rate per IP; enforceAiQuota caps daily spend per
// account. Both are applied to every route whose purpose is a billed Gemini
// call — neither substitutes for the other. The note create/update path is
// deliberately excluded here and consumes the same quota softly inside
// deriveContentFields, so an exhausted quota can never block saving a note.
const { enforceAiQuota } = require('../middleware/aiQuota');
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
  signImageUrls,
} = require('../controllers/noteController');
const { generateFlashcardsForNote, getNoteFlashcards } = require('../controllers/flashcardController');

router.post('/ask', protect, aiLimiter, enforceAiQuota, validateBody(askNotesSchema), askNotes);
router.post('/search', protect, aiLimiter, enforceAiQuota, validateBody(searchNotesSchema), searchNotes);
router.get('/digest', protect, aiLimiter, enforceAiQuota, getDigest);
router.get('/streak', protect, getNoteStreak);
router.get('/activity', protect, getNoteActivity);
router.post('/suggest-title', protect, aiLimiter, enforceAiQuota, validateBody(suggestTitleSchema), suggestTitle);
router.post('/ai-assist', protect, aiLimiter, enforceAiQuota, validateBody(aiAssistSchema), assistNoteWriting);
// Must come before GET /:id — otherwise Express treats "export" as an :id.
// exportLimiter: these stream an archive of every note the user owns and the
// markdown variant zips at compression level 9, so they're by far the most
// expensive calls in the app to serve.
router.get('/export/json', protect, exportLimiter, exportNotesJson);
router.get('/export/markdown', protect, exportLimiter, exportNotesMarkdown);
router.post('/upload-image', protect, uploadLimiter, upload.single('image'), uploadImage);
// Protected counterpart to the unauthenticated /uploads route: this is where
// ownership is actually checked, and it hands back short-lived signed URLs.
// Must stay above GET /:id or Express reads "sign-images" as an id.
router.post('/sign-images', protect, signImageUrls);
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
router.post('/:id/ai-process', protect, aiLimiter, enforceAiQuota, processNoteWithAI);
router.post('/:id/flashcards', protect, aiLimiter, enforceAiQuota, generateFlashcardsForNote);
router.get('/:id/flashcards', protect, getNoteFlashcards);

module.exports = router;
