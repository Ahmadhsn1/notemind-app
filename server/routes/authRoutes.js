const express = require('express');
const router = express.Router();
const { registerUser, loginUser, googleAuth, getMe, updateProfile, changePassword, deleteAccount } = require('../controllers/authController');
const { validateBody } = require('../middleware/validate');
const {
  registerSchema,
  loginSchema,
  updateProfileSchema,
  changePasswordSchema,
  deleteAccountSchema,
  googleAuthSchema,
} = require('../validators/authValidators');
const { authLimiter } = require('../middleware/rateLimit');
const protect = require('../middleware/authMiddleware');

router.post('/register', authLimiter, validateBody(registerSchema), registerUser);
router.post('/login', authLimiter, validateBody(loginSchema), loginUser);
router.post('/google', authLimiter, validateBody(googleAuthSchema), googleAuth);

router.get('/me', protect, getMe);
router.put('/profile', protect, validateBody(updateProfileSchema), updateProfile);
router.put('/password', protect, authLimiter, validateBody(changePasswordSchema), changePassword);
router.delete('/account', protect, authLimiter, validateBody(deleteAccountSchema), deleteAccount);

module.exports = router;
