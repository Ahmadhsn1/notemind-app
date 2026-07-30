// Generic Zod-schema-driven request validation. On success, req.body is
// replaced with the parsed (trimmed/coerced) data so controllers can trust
// its shape; on failure, responds 400 with a flat field->message map instead
// of leaking a raw Zod error object.
const validateBody = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    const errors = {};
    for (const issue of result.error.issues) {
      const field = issue.path.join('.') || 'body';
      if (!errors[field]) errors[field] = issue.message;
    }
    return res.status(400).json({ message: 'Validation failed', errors });
  }
  req.body = result.data;
  next();
};

module.exports = { validateBody };
