const { z } = require('zod');

// Accepts an ISO datetime string, null (clears the reminder), or omission
// (leaves it untouched on update / unset on create) — coerced to a real
// Date so the controller can pass it straight to Mongoose. Omission must
// stay `undefined` (not collapse to `null`) after parsing, since
// updateNote's `req.body.reminderAt !== undefined` presence check is what
// decides whether to touch the field at all — collapsing it to `null` here
// would silently clear every note's reminder on any unrelated edit.
const reminderAtSchema = z
  .union([z.string(), z.null()])
  .optional()
  .transform((val) => (val === undefined ? undefined : val === null || val === '' ? null : new Date(val)))
  .refine((val) => val === undefined || val === null || !isNaN(val.getTime()), { message: 'Invalid reminder date' });

// contentHtml's own size cap is enforced downstream by htmlSanitizer's
// MAX_HTML_LENGTH — no need to duplicate that limit here, just the type.
const createNoteSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(300),
  contentHtml: z.string().optional(),
  body: z.string().optional(),
  tags: z.array(z.string()).optional(),
  folder: z.string().optional(),
  reminderAt: reminderAtSchema,
});

// Same fields, all optional — updateNote only applies keys that are present.
const updateNoteSchema = z.object({
  title: z.string().trim().min(1, 'Title cannot be empty').max(300).optional(),
  contentHtml: z.string().optional(),
  body: z.string().optional(),
  tags: z.array(z.string()).optional(),
  folder: z.string().optional(),
  reminderAt: reminderAtSchema,
});

module.exports = { createNoteSchema, updateNoteSchema };
