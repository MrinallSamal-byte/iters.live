const express = require('express');
const router = express.Router();
const { authMiddleware: auth, roleMiddleware } = require('../middleware/auth');
const {
  createRecord,
  listRecords
} = require('../services/firebase-data.service');

// ponytail: /questions CRUD + /quizzes endpoints deleted — duplicated question-bank.routes.js
// (same `question_bank` collection, divergent schema) with zero client callers;
// client uses /api/question-bank and web uses /api/teacher/rubrics only.

const teacherOnly = roleMiddleware('teacher', 'admin');

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

router.get('/rubrics', auth, teacherOnly, async (req, res) => {
  try {
    const rubrics = await listRecords('rubrics', {
      orderBy: [{ field: 'created_at', direction: 'desc' }]
    });

    const ownRubrics = rubrics.filter((item) =>
      String(item.teacher_id || item.created_by || '') === String(req.user.id));

    res.json({ success: true, rubrics: ownRubrics });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/rubrics', auth, teacherOnly, async (req, res) => {
  try {
    const { name, description, criteria } = req.body;
    const criteriaList = Array.isArray(criteria) ? criteria : [];
    const totalPoints = criteriaList.reduce((sum, criterion) => {
      const levels = Array.isArray(criterion.levels) ? criterion.levels : [];
      const levelMax = levels.reduce((max, level) => Math.max(max, toNumber(level.points, 0)), 0);
      return sum + levelMax;
    }, 0);

    const record = await createRecord('rubrics', {
      teacher_id: String(req.user.id),
      created_by: String(req.user.id),
      name,
      description: description || null,
      criteria: criteriaList,
      total_points: totalPoints
    });

    res.json({ success: true, rubricId: record.id });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
