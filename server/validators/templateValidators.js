const { z } = require('zod');

// contentHtml's own byte-size ceiling is enforced downstream by
// htmlSanitizer's MAX_HTML_LENGTH (same as notes) — no need to duplicate
// that cap here, just the type.
const createTemplateSchema = z.object({
  name: z.string().trim().min(1, 'Template name is required').max(80, 'Template name must be 80 characters or fewer'),
  title: z.string().trim().max(300).optional(),
  contentHtml: z.string().optional(),
});

// Same fields, all optional — updateTemplate only applies keys that are
// present, same pattern as updateNoteSchema.
const updateTemplateSchema = z.object({
  name: z.string().trim().min(1, 'Template name is required').max(80, 'Template name must be 80 characters or fewer').optional(),
  title: z.string().trim().max(300).optional(),
  contentHtml: z.string().optional(),
});

module.exports = { createTemplateSchema, updateTemplateSchema };
