const express = require('express');
const router = express.Router();
const {
  registerUser,
  loginUser,
  googleAuth,
  getMe,
  updateProfile,
  changePassword,
  deleteAccount,
  linkGoogle,
  unlinkGoogle,
  forgotPassword,
  resetPassword,
} = require('../controllers/authController');
const { validateBody } = require('../middleware/validate');
const {
  registerSchema,
  loginSchema,
  updateProfileSchema,
  changePasswordSchema,
  deleteAccountSchema,
  googleAuthSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} = require('../validators/authValidators');
const { authLimiter } = require('../middleware/rateLimit');
const protect = require('../middleware/authMiddleware');

router.post('/register', authLimiter, validateBody(registerSchema), registerUser);
router.post('/login', authLimiter, validateBody(loginSchema), loginUser);
router.post('/google', authLimiter, validateBody(googleAuthSchema), googleAuth);

// Public by necessity — the whole point is that the user cannot sign in.
// authLimiter is what stops this being used to spray reset emails at
// arbitrary addresses, or to brute-force a token.
router.post('/forgot-password', authLimiter, validateBody(forgotPasswordSchema), forgotPassword);
router.post('/reset-password', authLimiter, validateBody(resetPasswordSchema), resetPassword);

router.get('/me', protect, getMe);
router.put('/profile', protect, validateBody(updateProfileSchema), updateProfile);
router.put('/password', protect, authLimiter, validateBody(changePasswordSchema), changePassword);
router.delete('/account', protect, authLimiter, validateBody(deleteAccountSchema), deleteAccount);

// Linking happens from inside an authenticated session on purpose — see the
// comment on googleAuth for why linking by email alone was a hijacking risk.
router.post('/google/link', protect, authLimiter, validateBody(googleAuthSchema), linkGoogle);
router.delete('/google/link', protect, unlinkGoogle);

module.exports = router;
