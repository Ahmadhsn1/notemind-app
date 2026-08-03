const { z } = require('zod');

const registerSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  email: z.string().trim().toLowerCase().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(200),
});

// Deliberately no min-length on password here (unlike register) — existing
// users may have accounts created before this validation existed; login
// should only ever fail on wrong credentials, never on policy the account
// predates.
const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

const updateProfileSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  email: z.string().trim().toLowerCase().email('Invalid email address'),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters').max(200),
});

// No min-length — Google-only accounts (no password set) confirm deletion
// with an empty string, since the controller skips the password check
// entirely when the account has none to check against.
const deleteAccountSchema = z.object({
  password: z.string(),
});

const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email('Invalid email address'),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required').max(200),
  newPassword: z.string().min(8, 'Password must be at least 8 characters').max(200),
});

const googleAuthSchema = z.object({
  credential: z.string().min(1, 'Missing Google credential'),
});

module.exports = {
  registerSchema,
  loginSchema,
  updateProfileSchema,
  changePasswordSchema,
  deleteAccountSchema,
  googleAuthSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
};
