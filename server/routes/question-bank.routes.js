const express = require('express');
const router = express.Router();
const { body, param, query, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const csv = require('csv-parse');
const ExcelJS = require('exceljs');
const { query: dbQuery } = require('../database/db');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');

// Rate limit imports
const importLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false
});

// File upload (CSV/Excel) for import
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    const ok = ['text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
    if (ok.includes(file.mimetype)) cb(null, true); else cb(new Error('Invalid file type'));
  },
  limits: { fileSize: 5 * 1024 * 1024 }
});

// Helpers
function handleValidation(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
}

// Create question
router.post(
  '/',
  authMiddleware,
  roleMiddleware('teacher', 'admin'),
  [
    body('subject_id').isInt({ min: 1 }).withMessage('subject_id is required'),
    body('question_text').trim().notEmpty().withMessage('question_text is required'),
    body('question_type').isIn(['mcq', 'short_answer', 'essay']).withMessage('Invalid question_type'),
    body('difficulty').isIn(['easy', 'medium', 'hard']).withMessage('Invalid difficulty'),
    body('topic').optional().isString().isLength({ max: 100 }),
    body('blooms_taxonomy').optional().isIn(['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create']),
    body('options').optional().isArray(),
    body('correct_answer').optional().isString(),
    body('marks').optional().isInt({ min: 0, max: 100 })
  ],
  async (req, res) => {
    const err = handleValidation(req, res); if (err) return;
    try {
      const teacher_id = req.user.id;
      const { subject_id, question_text, question_type, difficulty, topic = null, blooms_taxonomy = null, options = null, correct_answer = null, marks = 1 } = req.body;
      const result = await dbQuery(
        `INSERT INTO question_bank (teacher_id, subject_id, question_text, question_type, difficulty, topic, blooms_taxonomy, options, correct_answer, marks)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [teacher_id, subject_id, question_text, question_type, difficulty, topic, blooms_taxonomy, options ? JSON.stringify(options) : null, correct_answer, marks]
      );
      res.status(201).json({ success: true, data: { id: result[0].id } });
    } catch (error) {
      console.error('Error context:', error);
      res.status(500).json({ success: false, message: 'Failed to create question', error: process.env.NODE_ENV === 'development' ? error.message : undefined });
    }
  }
);

// List questions with filters and pagination
router.get(
  '/',
  authMiddleware,
  [
    query('subject_id').optional().isInt({ min: 1 }),
    query('difficulty').optional().isIn(['easy', 'medium', 'hard']),
    query('topic').optional().isString(),
    query('q').optional().isString(),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 })
  ],
  async (req, res) => {
    const err = handleValidation(req, res); if (err) return;
    try {
      const { subject_id, difficulty, topic, q, page = 1, limit = 20 } = req.query;
      const where = [];
      const params = [];
      if (subject_id) { where.push('subject_id = $1'); params.push(Number(subject_id)); }
      if (difficulty) { where.push('difficulty = $2'); params.push(difficulty); }
      if (topic) { where.push('topic = $3'); params.push(topic); }
      if (q) { where.push('(question_text LIKE $4 OR topic LIKE $5)'); params.push(`%${q}%`, `%${q}%`); }
      // Teachers can only see their own by default; admin sees all
      if (req.user.role === 'teacher') { where.push('teacher_id = $6'); params.push(req.user.id); }
      const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';
      const offset = (Number(page) - 1) * Number(limit);

      const total = await dbQuery(`SELECT COUNT(*) AS c FROM question_bank ${whereSql}`, params);
      const rows = await dbQuery(
        `SELECT * FROM question_bank ${whereSql} ORDER BY created_at DESC LIMIT ${Number(limit)} OFFSET ${offset}`,
        params
      );
      // Parse options JSON
      rows.forEach(r => { if (r.options) { try { r.options = JSON.parse(r.options); } catch { r.options = []; } } });
      res.json({ success: true, data: { items: rows, page: Number(page), limit: Number(limit), total: total[0].c || 0 } });
    } catch (error) {
      console.error('Error context:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch questions', error: process.env.NODE_ENV === 'development' ? error.message : undefined });
    }
  }
);

// Get details
router.get('/:id', authMiddleware, [param('id').isInt({ min: 1 })], async (req, res) => {
  const err = handleValidation(req, res); if (err) return;
  try {
    const id = Number(req.params.id);
    const rows = await dbQuery('SELECT * FROM question_bank WHERE id = $10', [id]);
    if (rows.length === 0) return res.status(404).json({ success: false, message: 'Not found' });
    const row = rows[0];
    if (row.options) { try { row.options = JSON.parse(row.options); } catch { row.options = []; } }
    res.json({ success: true, data: row });
  } catch (error) {
    console.error('Error context:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch question' });
  }
});

// Update
router.put(
  '/:id',
  authMiddleware,
  roleMiddleware('teacher', 'admin'),
  [
    param('id').isInt({ min: 1 }),
    body('question_text').optional().isString(),
    body('question_type').optional().isIn(['mcq', 'short_answer', 'essay']),
    body('difficulty').optional().isIn(['easy', 'medium', 'hard']),
    body('topic').optional().isString().isLength({ max: 100 }),
    body('blooms_taxonomy').optional().isIn(['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create']),
    body('options').optional().isArray(),
    body('correct_answer').optional().isString(),
    body('marks').optional().isInt({ min: 0, max: 100 })
  ],
  async (req, res) => {
    const err = handleValidation(req, res); if (err) return;
    try {
      const id = Number(req.params.id);
      // Ownership check for teachers
      if (req.user.role === 'teacher') {
        const own = await dbQuery('SELECT id FROM question_bank WHERE id = ? AND teacher_id = ?', [id, req.user.id]);
        if (own.length === 0) return res.status(403).json({ success: false, message: 'Forbidden' });
      }
      const fields = ['question_text','question_type','difficulty','topic','blooms_taxonomy','correct_answer','marks'];
      const sets = [];
      const params = [];
      for (const f of fields) {
        if (typeof req.body[f] !== 'undefined') { sets.push(`${f} = ?`); params.push(req.body[f]); }
      }
      if (typeof req.body.options !== 'undefined') { sets.push('options = ?'); params.push(JSON.stringify(req.body.options)); }
      if (sets.length === 0) return res.json({ success: true, message: 'No changes' });
      params.push(id);
      await dbQuery(`UPDATE question_bank SET ${sets.join(', ')} WHERE id = ?`, params);
      res.json({ success: true, message: 'Updated' });
    } catch (error) {
      console.error('Error context:', error);
      res.status(500).json({ success: false, message: 'Failed to update question' });
    }
  }
);

// Delete
router.delete('/:id', authMiddleware, roleMiddleware('teacher', 'admin'), [param('id').isInt({ min: 1 })], async (req, res) => {
  const err = handleValidation(req, res); if (err) return;
  try {
    const id = Number(req.params.id);
    if (req.user.role === 'teacher') {
      const own = await dbQuery('SELECT id FROM question_bank WHERE id = ? AND teacher_id = ?', [id, req.user.id]);
      if (own.length === 0) return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    await dbQuery('DELETE FROM question_bank WHERE id = ?', [id]);
    res.json({ success: true, message: 'Deleted' });
  } catch (error) {
    console.error('Error context:', error);
    res.status(500).json({ success: false, message: 'Failed to delete question' });
  }
});

// Import from CSV/Excel
router.post('/import', authMiddleware, roleMiddleware('teacher', 'admin'), importLimiter, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'File is required' });
    const teacher_id = req.user.id;
    const inserted = [];

    if (req.file.mimetype === 'text/csv' || req.file.originalname.endsWith('.csv')) {
      await new Promise((resolve, reject) => {
        csv.parse(req.file.buffer, { columns: true, trim: true }, async (err, records) => {
          if (err) return reject(err);
          for (const r of records) {
            const { subject_id, question_text, question_type, difficulty, topic, correct_answer, marks } = r;
            if (!subject_id || !question_text) continue;
            const result = await dbQuery(
              `INSERT INTO question_bank (teacher_id, subject_id, question_text, question_type, difficulty, topic, correct_answer, marks)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
              [teacher_id, Number(subject_id), String(question_text).slice(0, 5000), (question_type||'mcq'), (difficulty||'easy'), topic||null, correct_answer||null, Number(marks||1)]
            );
            inserted.push(result[0].id);
          }
          resolve();
        });
      });
    } else {
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(req.file.buffer);
      const ws = wb.worksheets[0];
      const headers = ws.getRow(1).values.map(v => String(v||'').toLowerCase());
      const idx = (name) => headers.findIndex(h => h === name.toLowerCase());
      for (let r = 2; r <= ws.rowCount; r++) {
        const row = ws.getRow(r).values;
        const subject_id = Number(row[idx('subject_id')]);
        const question_text = row[idx('question_text')];
        if (!subject_id || !question_text) continue;
        const question_type = row[idx('question_type')] || 'mcq';
        const difficulty = row[idx('difficulty')] || 'easy';
        const topic = row[idx('topic')] || null;
        const correct_answer = row[idx('correct_answer')] || null;
        const marks = Number(row[idx('marks')] || 1);
        const result = await dbQuery(
          `INSERT INTO question_bank (teacher_id, subject_id, question_text, question_type, difficulty, topic, correct_answer, marks)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [teacher_id, subject_id, String(question_text).slice(0, 5000), question_type, difficulty, topic, correct_answer, marks]
        );
        inserted.push(result[0].id);
      }
    }

    res.json({ success: true, message: 'Imported', data: { count: inserted.length, ids: inserted } });
  } catch (error) {
    console.error('Error context:', error);
    res.status(500).json({ success: false, message: 'Import failed', error: process.env.NODE_ENV === 'development' ? error.message : undefined });
  }
});

module.exports = router;
