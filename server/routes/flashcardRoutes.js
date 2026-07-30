const express = require('express');
const router = express.Router();
const protect = require('../middleware/authMiddleware');
const { getDueFlashcards, reviewFlashcard, deleteFlashcard, getReviewStreak } = require('../controllers/flashcardController');

router.get('/due', protect, getDueFlashcards);
router.get('/streak', protect, getReviewStreak);
router.post('/:id/review', protect, reviewFlashcard);
router.delete('/:id', protect, deleteFlashcard);

module.exports = router;
