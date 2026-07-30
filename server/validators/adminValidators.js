const { z } = require('zod');

const updateRoleSchema = z.object({
  role: z.enum(['user', 'admin']),
});

const suspendSchema = z.object({
  suspended: z.boolean(),
});

const sendNotificationSchema = z.object({
  message: z.string().trim().min(1).max(1000),
  targetType: z.enum(['all', 'selected', 'single']),
  userIds: z.array(z.string()).optional(),
}).refine(
  (data) => data.targetType === 'all' || (Array.isArray(data.userIds) && data.userIds.length > 0),
  { message: 'At least one recipient is required', path: ['userIds'] }
).refine(
  (data) => data.targetType !== 'single' || data.userIds?.length === 1,
  { message: 'Single target requires exactly one user', path: ['userIds'] }
);

module.exports = { updateRoleSchema, suspendSchema, sendNotificationSchema };
