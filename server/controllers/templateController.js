const Template = require('../models/Template');
const HttpError = require('../utils/HttpError');
const { sanitizeNoteHtml, HtmlTooLargeError } = require('../utils/htmlSanitizer');

// Same fetch-then-check ownership pattern every note-scoped endpoint follows
// (see loadOwnedNote in noteController) — no query-level scoping, an
// explicit check instead, so a 403 for "exists but isn't yours" is never
// confused with a 404 for "doesn't exist".
const loadOwnedTemplate = async (req) => {
  const template = await Template.findById(req.params.id);
  if (!template) throw new HttpError(404, 'Template not found');
  if (template.user.toString() !== req.user.id) throw new HttpError(403, 'Not authorized to access this template');
  return template;
};

// Generous enough that no real user hits it by templating actual workflows,
// low enough that it isn't a free-form storage dumping ground.
const MAX_TEMPLATES_PER_USER = 60;

const getTemplates = async (req, res) => {
  const templates = await Template.find({ user: req.user.id }).sort({ updatedAt: -1 });
  res.json(templates);
};

const createTemplate = async (req, res) => {
  const count = await Template.countDocuments({ user: req.user.id });
  if (count >= MAX_TEMPLATES_PER_USER) {
    throw new HttpError(400, `You can save up to ${MAX_TEMPLATES_PER_USER} templates. Delete one before adding another.`);
  }

  let contentHtml = '';
  try {
    contentHtml = sanitizeNoteHtml(req.body.contentHtml || '');
  } catch (error) {
    if (error instanceof HtmlTooLargeError) throw new HttpError(400, error.message);
    throw error;
  }

  const template = await Template.create({
    user: req.user.id,
    name: req.body.name,
    title: req.body.title || '',
    contentHtml,
  });
  res.status(201).json(template);
};

const updateTemplate = async (req, res) => {
  const template = await loadOwnedTemplate(req);

  if (req.body.name !== undefined) template.name = req.body.name;
  if (req.body.title !== undefined) template.title = req.body.title;
  if (req.body.contentHtml !== undefined) {
    try {
      template.contentHtml = sanitizeNoteHtml(req.body.contentHtml);
    } catch (error) {
      if (error instanceof HtmlTooLargeError) throw new HttpError(400, error.message);
      throw error;
    }
  }

  await template.save();
  res.json(template);
};

const deleteTemplate = async (req, res) => {
  const template = await loadOwnedTemplate(req);
  await template.deleteOne();
  res.json({ message: 'Template deleted' });
};

module.exports = { getTemplates, createTemplate, updateTemplate, deleteTemplate };
