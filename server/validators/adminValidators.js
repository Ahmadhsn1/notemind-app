const { z } = require('zod');

const updateRoleSchema = z.object({
  role: z.enum(['user', 'admin']),
});

const suspendSchema = z.object({
  suspended: z.boolean(),
});

module.exports = { updateRoleSchema, suspendSchema };
