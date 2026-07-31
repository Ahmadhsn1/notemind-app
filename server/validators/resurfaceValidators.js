const { z } = require('zod');

// Tweet-length cap keeps the daily reflection genuinely lightweight — this
// is a quick "still relevant / has changed" reaction, not a new note.
const resurfaceReplySchema = z.object({
  reply: z.string().trim().max(280).optional().default(''),
});

module.exports = { resurfaceReplySchema };
