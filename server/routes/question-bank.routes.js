const express = require('express');
const router = express.Router();
const { body, param, query, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const csv = require('csv-parse');
const ExcelJS = require('exceljs');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');
const {
  createRecord,
  deleteRecord,
  getRecord,
  listRecords,
  updateRecord
} = require('../services/firebase-data.service');

const importLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false
});

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    const ok = ['text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
    if (ok.includes(file.mimetype)) cb(null, true); else cb(new Error('Invalid file type'));
  },
  limits: { fileSize: 5 * 1024 * 1024 }
});

function handleValidation(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  return null;
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeQuestion(record) {
  return {
    ...record,
    subject_id: toNumber(record.subject_id, record.subject_id),
    marks: toNumber(record.marks, 1),
    options: Array.isArray(record.options) ? record.options : []
  };
}

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
      const record = await createRecord('question_bank', {
        teacher_id: req.user.id,
        subject_id: toNumber(req.body.subject_id, 0),
        question_text: req.body.question_text,
        question_type: req.body.question_type,
        difficulty: req.body.difficulty,
        topic: req.body.topic || null,
        blooms_taxonomy: req.body.blooms_taxonomy || null,
        options: req.body.options || [],
        correct_answer: req.body.correct_answer || null,
        marks: toNumber(req.body.marks, 1)
      });
      res.status(201).json({ success: true, data: { id: record.id } });
    } catch (error) {
      console.error('Error context:', error);
      res.status(500).json({ success: false, message: 'Failed to create question', error: process.env.NODE_ENV === 'development' ? error.message : undefined });
    }
  }
);

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
      const filters = [];

      if (subject_id) filters.push({ field: 'subject_id', value: Number(subject_id) });
      if (difficulty) filters.push({ field: 'difficulty', value: difficulty });
      if (topic) filters.push({ field: 'topic', value: topic });
      if (req.user.role === 'teacher') filters.push({ field: 'teacher_id', value: req.user.id });

      let rows = await listRecords('question_bank', {
        filters,
        orderBy: [{ field: 'created_at', direction: 'desc' }]
      });

      if (q) {
        const queryText = String(q).toLowerCase();
        rows = rows.filter((item) => {
          return String(item.question_text || '').toLowerCase().includes(queryText)
            || String(item.topic || '').toLowerCase().includes(queryText);
        });
      }

      const pageNum = Number(page);
      const limitNum = Number(limit);
      const offset = (pageNum - 1) * limitNum;

      res.json({
        success: true,
        data: {
          items: rows.slice(offset, offset + limitNum).map(normalizeQuestion),
          page: pageNum,
          limit: limitNum,
          total: rows.length
        }
      });
    } catch (error) {
      console.error('Error context:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch questions', error: process.env.NODE_ENV === 'development' ? error.message : undefined });
    }
  }
);

router.get('/:id', authMiddleware, [param('id').isString().notEmpty()], async (req, res) => {
  const err = handleValidation(req, res); if (err) return;
  try {
    const row = await getRecord('question_bank', req.params.id);
    if (!row) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: normalizeQuestion(row) });
  } catch (error) {
    console.error('Error context:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch question' });
  }
});

router.put(
  '/:id',
  authMiddleware,
  roleMiddleware('teacher', 'admin'),
  [
    param('id').isString().notEmpty(),
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
      const existing = await getRecord('question_bank', req.params.id);
      if (!existing) return res.status(404).json({ success: false, message: 'Not found' });
      if (req.user.role === 'teacher' && existing.teacher_id !== req.user.id) {
        return res.status(403).json({ success: false, message: 'Forbidden' });
      }

      const payload = {};
      ['question_text', 'question_type', 'difficulty', 'topic', 'blooms_taxonomy', 'correct_answer'].forEach((field) => {
        if (typeof req.body[field] !== 'undefined') payload[field] = req.body[field];
      });
      if (typeof req.body.options !== 'undefined') payload.options = req.body.options;
      if (typeof req.body.marks !== 'undefined') payload.marks = toNumber(req.body.marks, existing.marks);

      await updateRecord('question_bank', req.params.id, payload);
      res.json({ success: true, message: 'Updated' });
    } catch (error) {
      console.error('Error context:', error);
      res.status(500).json({ success: false, message: 'Failed to update question' });
    }
  }
);

router.delete('/:id', authMiddleware, roleMiddleware('teacher', 'admin'), [param('id').isString().notEmpty()], async (req, res) => {
  const err = handleValidation(req, res); if (err) return;
  try {
    const existing = await getRecord('question_bank', req.params.id);
    if (!existing) return res.status(404).json({ success: false, message: 'Not found' });
    if (req.user.role === 'teacher' && existing.teacher_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    await deleteRecord('question_bank', req.params.id);
    res.json({ success: true, message: 'Deleted' });
  } catch (error) {
    console.error('Error context:', error);
    res.status(500).json({ success: false, message: 'Failed to delete question' });
  }
});

router.post('/import', authMiddleware, roleMiddleware('teacher', 'admin'), importLimiter, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'File is required' });
    const teacher_id = req.user.id;
    const inserted = [];

    const createQuestion = async ({ subject_id, question_text, question_type, difficulty, topic, correct_answer, marks }) => {
      const record = await createRecord('question_bank', {
        teacher_id,
        subject_id: Number(subject_id),
        question_text: String(question_text).slice(0, 5000),
        question_type: question_type || 'mcq',
        difficulty: difficulty || 'easy',
        topic: topic || null,
        correct_answer: correct_answer || null,
        marks: Number(marks || 1),
        options: []
      });
      inserted.push(record.id);
    };

    if (req.file.mimetype === 'text/csv' || req.file.originalname.endsWith('.csv')) {
      await new Promise((resolve, reject) => {
        csv.parse(req.file.buffer, { columns: true, trim: true }, async (err, records) => {
          if (err) return reject(err);
          try {
            for (const record of records) {
              if (!record.subject_id || !record.question_text) continue;
              await createQuestion(record);
            }
            resolve();
          } catch (createError) {
            reject(createError);
          }
        });
      });
    } else {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(req.file.buffer);
      const worksheet = workbook.worksheets[0];
      const headerRow = worksheet.getRow(1).values.map((value) => String(value || '').toLowerCase());
      const indexOf = (name) => headerRow.findIndex((header) => header === name.toLowerCase());

      for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber += 1) {
        const row = worksheet.getRow(rowNumber).values;
        const subject_id = Number(row[indexOf('subject_id')]);
        const question_text = row[indexOf('question_text')];
        if (!subject_id || !question_text) continue;
        await createQuestion({
          subject_id,
          question_text,
          question_type: row[indexOf('question_type')] || 'mcq',
          difficulty: row[indexOf('difficulty')] || 'easy',
          topic: row[indexOf('topic')] || null,
          correct_answer: row[indexOf('correct_answer')] || null,
          marks: Number(row[indexOf('marks')] || 1)
        });
      }
    }

    res.json({
      success: true,
      message: 'Import complete',
      data: { inserted: inserted.length, ids: inserted }
    });
  } catch (error) {
    console.error('Question import error:', error);
    res.status(500).json({ success: false, message: 'Failed to import question bank data' });
  }
});

module.exports = router;
