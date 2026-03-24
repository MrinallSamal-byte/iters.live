const express = require('express');
const router = express.Router();
const { authMiddleware: auth, roleMiddleware } = require('../middleware/auth');
const {
  createRecord,
  deleteRecord,
  getRecord,
  listRecords,
  updateRecord
} = require('../services/firebase-data.service');

const teacherOnly = roleMiddleware('teacher', 'admin');

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

async function getTeacherQuestions(teacherId) {
  return listRecords('question_bank', {
    filters: [{ field: 'teacher_id', value: String(teacherId) }],
    orderBy: [{ field: 'created_at', direction: 'desc' }]
  });
}

router.get('/questions', auth, teacherOnly, async (req, res) => {
  try {
    const { type, difficulty } = req.query;
    let questions = await getTeacherQuestions(req.user.id);

    if (type) {
      questions = questions.filter((item) => item.question_type === type);
    }
    if (difficulty) {
      questions = questions.filter((item) => item.difficulty === difficulty);
    }

    res.json({ success: true, questions });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/questions', auth, teacherOnly, async (req, res) => {
  try {
    const {
      questionText,
      questionType,
      options,
      correctAnswer,
      points,
      difficulty,
      tags,
      explanation
    } = req.body;

    const record = await createRecord('question_bank', {
      teacher_id: String(req.user.id),
      question_text: questionText,
      question_type: questionType,
      options: Array.isArray(options) ? options : [],
      correct_answer: correctAnswer || null,
      points: toNumber(points, 1),
      marks: toNumber(points, 1),
      difficulty: difficulty || 'medium',
      tags: Array.isArray(tags) ? tags : [],
      explanation: explanation || null
    });

    res.json({ success: true, questionId: record.id });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/questions/:id', auth, teacherOnly, async (req, res) => {
  try {
    const existing = await getRecord('question_bank', req.params.id);
    if (!existing || String(existing.teacher_id) !== String(req.user.id)) {
      return res.status(404).json({ success: false, error: 'Question not found' });
    }

    const {
      questionText,
      questionType,
      options,
      correctAnswer,
      points,
      difficulty,
      tags,
      explanation
    } = req.body;

    await updateRecord('question_bank', req.params.id, {
      question_text: questionText,
      question_type: questionType,
      options: Array.isArray(options) ? options : existing.options || [],
      correct_answer: correctAnswer || null,
      points: toNumber(points, existing.points || 1),
      marks: toNumber(points, existing.marks || existing.points || 1),
      difficulty: difficulty || existing.difficulty || 'medium',
      tags: Array.isArray(tags) ? tags : existing.tags || [],
      explanation: explanation || null
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/questions/:id', auth, teacherOnly, async (req, res) => {
  try {
    const existing = await getRecord('question_bank', req.params.id);
    if (!existing || String(existing.teacher_id) !== String(req.user.id)) {
      return res.status(404).json({ success: false, error: 'Question not found' });
    }

    await deleteRecord('question_bank', req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/quizzes', auth, teacherOnly, async (req, res) => {
  try {
    const { title, description, duration, passPercentage, questionIds } = req.body;
    const record = await createRecord('quizzes', {
      teacher_id: String(req.user.id),
      title,
      description: description || null,
      duration: toNumber(duration, 0),
      pass_percentage: toNumber(passPercentage, 0),
      question_ids: Array.isArray(questionIds) ? questionIds.map(String) : []
    });

    res.json({ success: true, quizId: record.id });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/quizzes/:id/submit', auth, async (req, res) => {
  try {
    const { answers = {}, timeTaken } = req.body;
    const quiz = await getRecord('quizzes', req.params.id);

    if (!quiz) {
      return res.status(404).json({ success: false, error: 'Quiz not found' });
    }

    const questionIds = Array.isArray(quiz.question_ids) ? quiz.question_ids.map(String) : [];
    const questions = (await listRecords('question_bank')).filter((item) => questionIds.includes(String(item.id)));

    let score = 0;
    const results = questions.map((question) => {
      const userAnswer = answers[question.id];
      const isCorrect = userAnswer === question.correct_answer;
      const points = isCorrect ? toNumber(question.points || question.marks, 1) : 0;
      score += points;

      return {
        questionId: question.id,
        userAnswer,
        correctAnswer: question.correct_answer,
        isCorrect,
        points
      };
    });

    await createRecord('quiz_submissions', {
      quiz_id: String(req.params.id),
      student_id: String(req.user.id),
      answers,
      score,
      time_taken: toNumber(timeTaken, 0)
    });

    res.json({ success: true, score, results });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

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
