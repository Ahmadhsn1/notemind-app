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

// tags/folder/body previously had no bounds at all — a client could post
// 100k tags or a 1MB plain-text body (only contentHtml was size-checked, via
// htmlSanitizer's MAX_HTML_LENGTH). body in particular is what gets embedded
// and fed into AI prompts, so an uncapped one is a cost problem as well as a
// storage one.
const MAX_TAGS = 50;
const MAX_TAG_LENGTH = 60;
const MAX_FOLDER_LENGTH = 80;
const MAX_BODY_LENGTH = 100_000;

const tagsSchema = z
  .array(z.string().trim().max(MAX_TAG_LENGTH, `Each tag must be ${MAX_TAG_LENGTH} characters or fewer`))
  .max(MAX_TAGS, `A note can have at most ${MAX_TAGS} tags`)
  .optional();

const folderSchema = z.string().trim().max(MAX_FOLDER_LENGTH, `Folder name must be ${MAX_FOLDER_LENGTH} characters or fewer`).optional();

// contentHtml's own size cap is enforced downstream by htmlSanitizer's
// MAX_HTML_LENGTH — no need to duplicate that limit here, just the type.
const bodySchema = z.string().max(MAX_BODY_LENGTH, 'Note content is too large').optional();

const createNoteSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(300),
  contentHtml: z.string().optional(),
  body: bodySchema,
  tags: tagsSchema,
  folder: folderSchema,
  reminderAt: reminderAtSchema,
});

// Same fields, all optional — updateNote only applies keys that are present.
const updateNoteSchema = z.object({
  title: z.string().trim().min(1, 'Title cannot be empty').max(300).optional(),
  contentHtml: z.string().optional(),
  body: bodySchema,
  tags: tagsSchema,
  folder: folderSchema,
  reminderAt: reminderAtSchema,
});

// The four AI routes had no validateBody at all — askNotes/searchNotes did an
// inline `typeof === 'string'` check and nothing more, so a 1MB question (the
// express.json ceiling) went verbatim into a Gemini prompt. These caps are
// generous for real use and bound the per-request token spend.
const MAX_QUESTION_LENGTH = 2_000;
const MAX_SEARCH_QUERY_LENGTH = 500;
// Mirrors WRITING_ASSIST_MAX_LENGTH in noteController, the one AI route that
// already truncated its input.
const MAX_ASSIST_LENGTH = 8_000;

const askNotesSchema = z.object({
  question: z.string().trim().min(1, 'Question is required').max(MAX_QUESTION_LENGTH, 'Question is too long'),
});

const searchNotesSchema = z.object({
  query: z.string().trim().min(1, 'Query is required').max(MAX_SEARCH_QUERY_LENGTH, 'Search query is too long'),
});

const suggestTitleSchema = z.object({
  body: z.string().trim().min(1, 'Note content is required').max(MAX_ASSIST_LENGTH, 'Note content is too long'),
});

// `action` is only shape-checked here; noteController's WRITING_ASSIST_ACTIONS
// set stays the authority on which actions exist, so the two can't disagree.
// validateBody replaces req.body with the parsed result, so every key the
// controller reads has to be declared or it would be stripped.
const aiAssistSchema = z.object({
  action: z.string().trim().min(1, 'Action is required').max(40),
  text: z.string().trim().min(1, 'Text is required').max(MAX_ASSIST_LENGTH, 'Text is too long'),
});

module.exports = {
  createNoteSchema,
  updateNoteSchema,
  askNotesSchema,
  searchNotesSchema,
  suggestTitleSchema,
  aiAssistSchema,
};
