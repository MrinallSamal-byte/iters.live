const express = require('express');
const router = express.Router();
const { body, param, validationResult } = require('express-validator');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');
const {
  createRecord,
  getRecord,
  listRecords,
  updateRecord
} = require('../services/firebase-data.service');

function handleValidation(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  return null;
}

router.post(
  '/',
  authMiddleware,
  roleMiddleware('teacher', 'admin'),
  [
    body('assignment_id').notEmpty(),
    body('name').isString().isLength({ min: 1, max: 100 }),
    body('criteria').isArray({ min: 1 }).withMessage('criteria must be an array')
  ],
  async (req, res) => {
    const err = handleValidation(req, res); if (err) return;
    try {
      const record = await createRecord('rubrics', {
        assignment_id: req.body.assignment_id,
        name: req.body.name,
        criteria: req.body.criteria,
        created_by: req.user.id
      });
      res.status(201).json({ success: true, data: { id: record.id } });
    } catch (error) {
      console.error('Error context:', error);
      res.status(500).json({ success: false, message: 'Failed to create rubric' });
    }
  }
);

router.get('/:assignment_id', authMiddleware, [param('assignment_id').isString().notEmpty()], async (req, res) => {
  const err = handleValidation(req, res); if (err) return;
  try {
    const rows = await listRecords('rubrics', {
      filters: [{ field: 'assignment_id', value: req.params.assignment_id }],
      orderBy: [{ field: 'created_at', direction: 'desc' }],
      limit: 1
    });
    if (rows.length === 0) return res.status(404).json({ success: false, message: 'Rubric not found' });
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('Error context:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch rubric' });
  }
});

router.put('/:id', authMiddleware, roleMiddleware('teacher', 'admin'), [
  param('id').isString().notEmpty(),
  body('name').optional().isString().isLength({ min: 1, max: 100 }),
  body('criteria').optional().isArray({ min: 1 })
], async (req, res) => {
  const err = handleValidation(req, res); if (err) return;
  try {
    const existing = await getRecord('rubrics', req.params.id);
    if (!existing) return res.status(404).json({ success: false, message: 'Rubric not found' });

    const payload = {};
    if (typeof req.body.name !== 'undefined') payload.name = req.body.name;
    if (typeof req.body.criteria !== 'undefined') payload.criteria = req.body.criteria;

    if (Object.keys(payload).length === 0) {
      return res.json({ success: true, message: 'No changes' });
    }

    await updateRecord('rubrics', req.params.id, payload);
    res.json({ success: true, message: 'Updated' });
  } catch (error) {
    console.error('Error context:', error);
    res.status(500).json({ success: false, message: 'Failed to update rubric' });
  }
});

router.post('/:id/apply', authMiddleware, roleMiddleware('teacher', 'admin'), [param('id').isString().notEmpty()], async (req, res) => {
  const err = handleValidation(req, res); if (err) return;
  try {
    res.json({ success: true, message: 'Rubric applied to submissions (stub)' });
  } catch (error) {
    console.error('Error context:', error);
    res.status(500).json({ success: false, message: 'Failed to apply rubric' });
  }
});

module.exports = router;
