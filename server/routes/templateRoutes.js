const express = require('express');
const router = express.Router();
const protect = require('../middleware/authMiddleware');
const { validateBody } = require('../middleware/validate');
const { createTemplateSchema, updateTemplateSchema } = require('../validators/templateValidators');
const { getTemplates, createTemplate, updateTemplate, deleteTemplate } = require('../controllers/templateController');

router.get('/', protect, getTemplates);
router.post('/', protect, validateBody(createTemplateSchema), createTemplate);
router.put('/:id', protect, validateBody(updateTemplateSchema), updateTemplate);
router.delete('/:id', protect, deleteTemplate);

module.exports = router;
