const express = require('express');
const router = express.Router();
const protect = require('../middleware/authMiddleware');
const { getMyNotifications, markNotificationRead } = require('../controllers/notificationController');

router.get('/', protect, getMyNotifications);
router.patch('/:id/read', protect, markNotificationRead);

module.exports = router;
