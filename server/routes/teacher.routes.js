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

function round1(value) {
  return Number(value.toFixed(1));
}

function gradeLabel(percentage) {
  if (percentage >= 90) return 'A+';
  if (percentage >= 80) return 'A';
  if (percentage >= 70) return 'B+';
  if (percentage >= 60) return 'B';
  if (percentage >= 50) return 'C';
  if (percentage >= 40) return 'D';
  return 'F';
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

// 'pending' = submitted but not yet graded (stored status is 'submitted')
router.get('/stats', auth, teacherOnly, async (req, res) => {
  try {
    const [students, attendance, submissions, marks] = await Promise.all([
      listRecords('users', { filters: [{ field: 'role', value: 'student' }] }),
      listRecords('attendance'),
      listRecords('assignment_submissions', { filters: [{ field: 'status', value: 'submitted' }] }),
      listRecords('marks')
    ]);

    const attendanceByStudent = new Map();
    for (const record of attendance) {
      const item = attendanceByStudent.get(record.student_id) || { total: 0, present: 0 };
      item.total += 1;
      if (record.status === 'present' || record.status === 'late') item.present += 1;
      attendanceByStudent.set(record.student_id, item);
    }
    const studentRates = Array.from(attendanceByStudent.values())
      .map((item) => (item.total ? (item.present * 100) / item.total : 0));
    const avgAttendance = studentRates.length ? round1(studentRates.reduce((sum, rate) => sum + rate, 0) / studentRates.length) : 0;

    let marksPercentSum = 0;
    let marksPercentCount = 0;
    const marksByStudent = new Map();
    for (const mark of marks) {
      const total = toNumber(mark.total_marks, 0);
      if (total <= 0) continue;
      const percent = (toNumber(mark.marks_obtained, 0) / total) * 100;
      marksPercentSum += percent;
      marksPercentCount += 1;
      const list = marksByStudent.get(mark.student_id) || [];
      list.push(percent);
      marksByStudent.set(mark.student_id, list);
    }
    const classAverage = marksPercentCount ? round1(marksPercentSum / marksPercentCount) : 0;

    const byDate = new Map();
    for (const record of attendance) {
      const day = String(record.date || '').slice(0, 10);
      if (!day) continue;
      const item = byDate.get(day) || { total: 0, present: 0 };
      item.total += 1;
      if (record.status === 'present' || record.status === 'late') item.present += 1;
      byDate.set(day, item);
    }
    const attendanceTrend = Array.from(byDate.entries())
      .sort(([left], [right]) => left.localeCompare(right))
      .slice(-7)
      .map(([date, item]) => ({ date, percent: item.total ? round1((item.present * 100) / item.total) : 0 }));

    const gradeCounts = new Map();
    for (const percents of marksByStudent.values()) {
      const label = gradeLabel(percents.reduce((sum, pct) => sum + pct, 0) / percents.length);
      gradeCounts.set(label, (gradeCounts.get(label) || 0) + 1);
    }
    const gradeDistribution = ['A+', 'A', 'B+', 'B', 'C', 'D', 'F']
      .map((grade) => ({ grade, count: gradeCounts.get(grade) || 0 }));

    res.json({
      success: true,
      stats: {
        totalStudents: students.length,
        avgAttendance,
        pendingSubmissions: submissions.length,
        classAverage,
        attendanceTrend,
        gradeDistribution
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/submissions', auth, teacherOnly, async (req, res) => {
  try {
    const status = req.query.status;
    const filters = [];
    if (status) filters.push({ field: 'status', value: status === 'pending' ? 'submitted' : String(status) });

    const [submissions, assignments, users] = await Promise.all([
      listRecords('assignment_submissions', {
        filters,
        orderBy: [{ field: 'submitted_at', direction: 'desc' }]
      }),
      listRecords('assignments'),
      listRecords('users')
    ]);

    const assignmentById = new Map(assignments.map((item) => [item.id, item]));
    const userById = new Map(users.map((item) => [String(item.id), item]));

    const data = submissions.map((submission) => {
      const assignment = assignmentById.get(submission.assignment_id) || {};
      const student = userById.get(String(submission.student_id)) || {};
      return {
        id: submission.id,
        assignment_title: assignment.title || 'Assignment',
        subject: assignment.subject || null,
        student_name: student.name || submission.student_id,
        student_reg: student.registration_number || '',
        submitted_at: submission.submitted_at || null,
        status: submission.status
      };
    });

    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
