const express = require('express');
const router = express.Router();
const { authMiddleware: auth, roleMiddleware } = require('../middleware/auth');
const teacherOnly = roleMiddleware('teacher', 'admin');

// Question Bank Routes
router.get('/questions', auth, teacherOnly, async (req, res) => {
    try {
        const { type, difficulty, tags } = req.query;
        let query = 'SELECT * FROM question_bank WHERE teacher_id = ?';
        const params = [req.user.id];

        if (type) {
            query += ' AND question_type = ?';
            params.push(type);
        }
        if (difficulty) {
            query += ' AND difficulty = ?';
            params.push(difficulty);
        }

        const [questions] = await req.db.query(query, params);
        res.json({ success: true, questions });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/questions', auth, teacherOnly, async (req, res) => {
    try {
        const { questionText, questionType, options, correctAnswer, points, difficulty, tags, explanation } = req.body;

        const [result] = await req.db.query(`INSERT INTO question_bank (teacher_id, question_text, question_type, options, correct_answer, points, difficulty, tags, explanation)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`, [req.user.id, questionText, questionType, JSON.stringify(options), correctAnswer, points, difficulty, JSON.stringify(tags), explanation]
        );

        res.json({ success: true, questionId: result[0].id });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.put('/questions/:id', auth, teacherOnly, async (req, res) => {
    try {
        const { questionText, questionType, options, correctAnswer, points, difficulty, tags, explanation } = req.body;

        await req.db.query(`UPDATE question_bank 
             SET question_text = $1, question_type = $2, options = $3, correct_answer = $4, 
                 points = $5, difficulty = $6, tags = $7, explanation = $8
             WHERE id = $9 AND teacher_id = $10`, [questionText, questionType, JSON.stringify(options), correctAnswer, points, difficulty, JSON.stringify(tags), explanation, req.params.id, req.user.id]
        );

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.delete('/questions/:id', auth, teacherOnly, async (req, res) => {
    try {
        await req.db.query('DELETE FROM question_bank WHERE id = $1 AND teacher_id = $2', [req.params.id, req.user.id]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Quiz Routes
router.post('/quizzes', auth, teacherOnly, async (req, res) => {
    try {
        const { title, description, duration, passPercentage, questionIds } = req.body;

        const [result] = await req.db.query(`INSERT INTO quizzes (teacher_id, title, description, duration, pass_percentage, question_ids)
             VALUES ($1, $2, $3, $4, $5, $6)`, [req.user.id, title, description, duration, passPercentage, JSON.stringify(questionIds)]
        );

        res.json({ success: true, quizId: result[0].id });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/quizzes/:id/submit', auth, async (req, res) => {
    try {
        const { answers, timeTaken } = req.body;
        
        // Get quiz and questions
        const [quiz] = await req.db.query('SELECT * FROM quizzes WHERE id = $1', [req.params.id]);
        if (!quiz[0]) {
            return res.status(404).json({ success: false, error: 'Quiz not found' });
        }

        const questionIds = JSON.parse(quiz[0].question_ids);
        const [questions] = await req.db.query('SELECT * FROM question_bank WHERE id IN ($1)', [questionIds]);

        // Grade submission
        let score = 0;
        const results = [];

        questions.forEach(q => {
            const userAnswer = answers[q.id];
            const isCorrect = userAnswer === q.correct_answer;
            
            if (isCorrect) {
                score += q.points;
            }
            
            results.push({
                questionId: q.id,
                userAnswer,
                correctAnswer: q.correct_answer,
                isCorrect,
                points: isCorrect ? q.points : 0
            });
        });

        // Save submission
        await req.db.query(`INSERT INTO quiz_submissions (quiz_id, student_id, answers, score, time_taken)
             VALUES ($1, $2, $3, $4, $5)`, [req.params.id, req.user.id, JSON.stringify(answers), score, timeTaken]
        );

        res.json({ success: true, score, results });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Rubric Routes
router.get('/rubrics', auth, teacherOnly, async (req, res) => {
    try {
        const [rubrics] = await req.db.query('SELECT * FROM rubrics WHERE teacher_id = $1', [req.user.id]);
        res.json({ success: true, rubrics });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/rubrics', auth, teacherOnly, async (req, res) => {
    try {
        const { name, description, criteria } = req.body;
        const totalPoints = criteria.reduce((sum, c) => sum + Math.max(...c.levels.map(l => l.points)), 0);

        const [result] = await req.db.query(`INSERT INTO rubrics (teacher_id, name, description, criteria, total_points)
             VALUES ($1, $2, $3, $4, $5)`, [req.user.id, name, description, JSON.stringify(criteria), totalPoints]
        );

        res.json({ success: true, rubricId: result[0].id });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
