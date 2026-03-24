const express = require('express');
const router = express.Router();
const { authMiddleware, roleMiddleware } = require('../middleware/auth');
const {
  createRecord,
  findOne,
  listRecords,
  updateRecord
} = require('../services/firebase-data.service');
const { emitToClass, emitToUser } = require('../socket/socket');
const notificationService = require('../services/notification.service');

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeSubmissionAnswers(value) {
  if (!value) return null;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch (_) {
      return null;
    }
  }
  return value;
}

function sortAssignments(items = []) {
  return [...items].sort((left, right) => String(left.deadline || '').localeCompare(String(right.deadline || '')));
}

async function getStudentAssignments(req) {
  const assignments = await listRecords('assignments', {
    filters: [
      { field: 'department', value: req.user.department },
      { field: 'year', value: req.user.year }
    ]
  });

  const submissions = await listRecords('assignment_submissions', {
    filters: [{ field: 'student_id', value: req.user.id }]
  });

  const statusByAssignmentId = new Map(submissions.map((item) => [item.assignment_id, item.status || 'submitted']));

  return sortAssignments(assignments.filter((assignment) => assignment.is_active !== false)).map((assignment) => ({
    ...assignment,
    submission_status: statusByAssignmentId.get(assignment.id) || null
  }));
}

// Create assignment
router.post('/', authMiddleware, roleMiddleware('teacher', 'admin'), async (req, res, next) => {
  try {
    const {
      title,
      description,
      subject,
      department,
      year,
      total_marks,
      deadline,
      attachment_id
    } = req.body;

    const assignment = await createRecord('assignments', {
      title,
      description,
      subject,
      department,
      year,
      total_marks: toNumber(total_marks, 0),
      deadline,
      created_by: req.user.id,
      attachment_id: attachment_id || null,
      is_active: true
    });

    if (department && year) {
      emitToClass(department, year, 'A', 'assignments:update', { id: assignment.id });
      emitToClass(department, year, 'B', 'assignments:update', { id: assignment.id });
      emitToClass(department, year, 'C', 'assignments:update', { id: assignment.id });
      emitToClass(department, year, 'D', 'assignments:update', { id: assignment.id });
    }

    res.status(201).json({
      success: true,
      message: 'Assignment created successfully',
      data: { id: assignment.id }
    });
  } catch (error) {
    next(error);
  }
});

// Get assignments for student
router.get('/student', authMiddleware, roleMiddleware('student'), async (req, res, next) => {
  try {
    const assignments = await getStudentAssignments(req);
    res.json({ success: true, data: assignments });
  } catch (error) {
    next(error);
  }
});

router.get('/my-assignments', authMiddleware, roleMiddleware('student'), async (req, res, next) => {
  try {
    const assignments = await getStudentAssignments(req);
    res.json({ success: true, data: assignments });
  } catch (error) {
    next(error);
  }
});

// Submit assignment
router.post('/:id/submit', authMiddleware, roleMiddleware('student'), async (req, res, next) => {
  try {
    const { submission_text, file_id, submission_answers } = req.body;
    const assignmentId = req.params.id;

    const existing = await findOne('assignment_submissions', {
      filters: [
        { field: 'assignment_id', value: assignmentId },
        { field: 'student_id', value: req.user.id }
      ]
    });

    const payload = {
      assignment_id: assignmentId,
      student_id: req.user.id,
      submission_text: submission_text || null,
      file_id: file_id || null,
      submission_answers: normalizeSubmissionAnswers(submission_answers),
      status: 'submitted',
      submitted_at: new Date().toISOString()
    };

    if (existing) {
      await updateRecord('assignment_submissions', existing.id, payload);
    } else {
      await createRecord('assignment_submissions', payload);
    }

    res.json({ success: true, message: 'Assignment submitted successfully' });
  } catch (error) {
    next(error);
  }
});

// Grade submission
router.post('/:id/grade', authMiddleware, roleMiddleware('teacher', 'admin'), async (req, res, next) => {
  try {
    const { student_id, marks_obtained, feedback } = req.body;
    const assignmentId = req.params.id;

    const submission = await findOne('assignment_submissions', {
      filters: [
        { field: 'assignment_id', value: assignmentId },
        { field: 'student_id', value: student_id }
      ]
    });

    if (!submission) {
      return res.status(404).json({ success: false, message: 'Submission not found' });
    }

    await updateRecord('assignment_submissions', submission.id, {
      marks_obtained: toNumber(marks_obtained, 0),
      feedback: feedback || null,
      graded_by: req.user.id,
      graded_at: new Date().toISOString(),
      status: 'graded'
    });

    emitToUser(student_id, 'assignments:update', { assignmentId });

    await notificationService.create({
      userId: student_id,
      title: 'Assignment Graded',
      message: 'A graded assignment is now available in your dashboard.',
      type: 'assignment',
      link: '/dashboard/student.html',
      metadata: {
        assignmentId,
        marks_obtained: toNumber(marks_obtained, 0)
      }
    });

    res.json({ success: true, message: 'Assignment graded successfully' });
  } catch (error) {
    next(error);
  }
});

// Get assignment statistics for charts
router.get('/statistics', authMiddleware, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const assignments = await listRecords('assignments', {
      filters: [
        { field: 'department', value: req.user.department },
        { field: 'year', value: req.user.year }
      ]
    });
    const submissions = await listRecords('assignment_submissions', {
      filters: [{ field: 'student_id', value: userId }]
    });

    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    const submissionTimelineMap = new Map();
    for (const submission of submissions) {
      const timestamp = Date.parse(submission.submitted_at || '');
      if (Number.isNaN(timestamp) || timestamp < thirtyDaysAgo) continue;
      const date = String(submission.submitted_at).slice(0, 10);
      submissionTimelineMap.set(date, (submissionTimelineMap.get(date) || 0) + 1);
    }

    const submissionTimeline = Array.from(submissionTimelineMap.entries())
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([date, count]) => ({ date, count }));

    const submissionByAssignmentId = new Map(submissions.map((item) => [item.assignment_id, item]));

    const overall = {
      totalAssignments: assignments.length,
      submitted: submissions.length,
      graded: submissions.filter((item) => item.status === 'graded').length,
      averageMarks: submissions.length
        ? Number((submissions.reduce((sum, item) => sum + toNumber(item.marks_obtained, 0), 0) / submissions.length).toFixed(2))
        : 0
    };

    const subjectPerformanceMap = new Map();
    for (const assignment of assignments) {
      const subject = assignment.subject || 'General';
      if (!subjectPerformanceMap.has(subject)) {
        subjectPerformanceMap.set(subject, {
          subject,
          totalAssignments: 0,
          submitted: 0,
          marksSum: 0,
          markedCount: 0
        });
      }

      const item = subjectPerformanceMap.get(subject);
      item.totalAssignments += 1;

      const submission = submissionByAssignmentId.get(assignment.id);
      if (submission) {
        item.submitted += 1;
        if (submission.marks_obtained !== undefined && submission.marks_obtained !== null) {
          item.marksSum += toNumber(submission.marks_obtained, 0);
          item.markedCount += 1;
        }
      }
    }

    const subjectPerformance = Array.from(subjectPerformanceMap.values()).map((item) => ({
      subject: item.subject,
      totalAssignments: item.totalAssignments,
      submitted: item.submitted,
      averageMarks: item.markedCount ? Number((item.marksSum / item.markedCount).toFixed(2)) : 0
    }));

    res.json({
      success: true,
      data: {
        submissionTimeline,
        overall,
        subjectPerformance
      }
    });
  } catch (error) {
    next(error);
  }
});

// Save or update MCQ answer key for an assignment
router.post('/:id/answer-key', authMiddleware, roleMiddleware('teacher', 'admin'), async (req, res, next) => {
  try {
    const assignmentId = req.params.id;
    const { answerKey, totalPoints = 0, passPercentage = 40 } = req.body;

    if (!Array.isArray(answerKey) || answerKey.length === 0) {
      return res.status(400).json({ success: false, message: 'answerKey array is required' });
    }

    await updateRecord('assignment_answer_keys', assignmentId, {
      assignment_id: assignmentId,
      answer_key: answerKey,
      total_points: toNumber(totalPoints, 0),
      pass_percentage: toNumber(passPercentage, 40)
    });

    res.json({ success: true, message: 'Answer key saved' });
  } catch (error) {
    next(error);
  }
});

// Auto-grade all MCQ submissions for an assignment
router.post('/:id/auto-grade', authMiddleware, roleMiddleware('teacher', 'admin'), async (req, res, next) => {
  try {
    const assignmentId = req.params.id;
    const key = await findOne('assignment_answer_keys', {
      filters: [{ field: 'assignment_id', value: assignmentId }]
    });

    if (!key) {
      return res.status(404).json({ success: false, message: 'Answer key not configured' });
    }

    const submissions = await listRecords('assignment_submissions', {
      filters: [{ field: 'assignment_id', value: assignmentId }]
    });

    let graded = 0;
    for (const submission of submissions) {
      const answers = normalizeSubmissionAnswers(submission.submission_answers) || {};
      let score = 0;
      const results = [];

      for (const question of key.answer_key || []) {
        const correct = String(answers[question.questionId]) === String(question.correctAnswer);
        if (correct) {
          score += toNumber(question.points, 0);
        }
        results.push({ id: question.questionId, correct });
      }

      await updateRecord('assignment_submissions', submission.id, {
        marks_obtained: score,
        feedback: { auto: true, results },
        graded_by: req.user.id,
        graded_at: new Date().toISOString(),
        status: 'graded'
      });

      emitToUser(submission.student_id, 'assignments:update', { assignmentId });
      graded += 1;
    }

    res.json({ success: true, message: 'Auto-grading complete', data: { graded } });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
