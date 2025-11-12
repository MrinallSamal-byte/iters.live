const express = require('express');
const router = express.Router();
const { body, param, validationResult } = require('express-validator');
const { query } = require('../database/db');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');

function handleValidation(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
}

// Create rubric
router.post(
  '/',
  authMiddleware,
  roleMiddleware('teacher', 'admin'),
  [
    body('assignment_id').isInt({ min: 1 }),
    body('name').isString().isLength({ min: 1, max: 100 }),
    body('criteria').isArray({ min: 1 }).withMessage('criteria must be an array')
  ],
  async (req, res) => {
    const err = handleValidation(req, res); if (err) return;
    try {
      const { assignment_id, name, criteria } = req.body;
      const result = await query('INSERT INTO rubrics (assignment_id, name, criteria) VALUES ($1, $2, $3) RETURNING id', [assignment_id, name, JSON.stringify(criteria)]
      );
      res.status(201).json({ success: true, data: { id: result[0].id } });
    } catch (error) {
      console.error('Error context:', error);
      res.status(500).json({ success: false, message: 'Failed to create rubric' });
    }
  }
);

// Get rubric for assignment
router.get('/:assignment_id', authMiddleware, [param('assignment_id').isInt({ min: 1 })], async (req, res) => {
  const err = handleValidation(req, res); if (err) return;
  try {
    const rows = await query('SELECT * FROM rubrics WHERE assignment_id = $1 ORDER BY created_at DESC LIMIT 1', [req.params.assignment_id]);
    if (rows.length === 0) return res.status(404).json({ success: false, message: 'Rubric not found' });
    const r = rows[0];
    try { r.criteria = JSON.parse(r.criteria); } catch { r.criteria = []; }
    res.json({ success: true, data: r });
  } catch (error) {
    console.error('Error context:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch rubric' });
  }
});

// Update rubric
router.put('/:id', authMiddleware, roleMiddleware('teacher', 'admin'), [
  param('id').isInt({ min: 1 }),
  body('name').optional().isString().isLength({ min: 1, max: 100 }),
  body('criteria').optional().isArray({ min: 1 })
], async (req, res) => {
  const err = handleValidation(req, res); if (err) return;
  try {
    const fields = [];
    const params = [];
    if (typeof req.body.name !== 'undefined') { fields.push('name = ?'); params.push(req.body.name); }
    if (typeof req.body.criteria !== 'undefined') { fields.push('criteria = ?'); params.push(JSON.stringify(req.body.criteria)); }
    if (fields.length === 0) return res.json({ success: true, message: 'No changes' });
    params.push(Number(req.params.id));
    await query(`UPDATE rubrics SET ${fields.join(', ')} WHERE id = ?`, params);
    res.json({ success: true, message: 'Updated' });
  } catch (error) {
    console.error('Error context:', error);
    res.status(500).json({ success: false, message: 'Failed to update rubric' });
  }
});

// Apply rubric to submissions (stub - depends on submissions schema)
router.post('/:id/apply', authMiddleware, roleMiddleware('teacher', 'admin'), [param('id').isInt({ min: 1 })], async (req, res) => {
  const err = handleValidation(req, res); if (err) return;
  try {
    // TODO: Implement applying rubric to assignment submissions when submissions table available
    res.json({ success: true, message: 'Rubric applied to submissions (stub)' });
  } catch (error) {
    console.error('Error context:', error);
    res.status(500).json({ success: false, message: 'Failed to apply rubric' });
  }
});

module.exports = router;
