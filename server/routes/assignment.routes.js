const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { authMiddleware, roleMiddleware } = require('../middleware/auth');
const {
  createRecord,
  findOne,
  getRecord,
  listRecords,
  updateRecord,
  isValidDocId
} = require('../services/firebase-data.service');
const { emitToClass, emitToUser } = require('../socket/socket');
const notificationService = require('../services/notification.service');
const { recordAudit } = require('../services/audit.service');
const {
  loadClassStudents,
  yearVariants,
  runDueSoonReminders
} = require('../services/assignment-reminders.service');

const IN_QUERY_CHUNK = 30;
const KNOWN_SECTIONS = ['A', 'B', 'C', 'D'];

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

/** Whole-number year between 1 and 6, or null. */
function parseYear(value) {
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric >= 1 && numeric <= 6 ? numeric : null;
}

/** ISO timestamp for any parseable date value, or null. */
function parseDeadline(value) {
  if (value === undefined || value === null || value === '') return null;
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? null : new Date(timestamp).toISOString();
}

function isPastDeadline(assignment, now = Date.now()) {
  const deadline = Date.parse(assignment.deadline || '');
  return Number.isFinite(deadline) && now > deadline;
}

async function getStudentAssignments(req) {
  const year = parseYear(req.user.year);
  if (!req.user.department || year === null) {
    return [];
  }

  const assignments = await listRecords('assignments', {
    filters: [
      { field: 'department', value: req.user.department },
      { field: 'year', op: 'in', value: yearVariants(year) }
    ]
  });

  const submissions = await listRecords('assignment_submissions', {
    filters: [{ field: 'student_id', value: req.user.id }]
  });

  const submissionByAssignmentId = new Map(submissions.map((item) => [item.assignment_id, item]));

  return sortAssignments(assignments.filter((assignment) => assignment.is_active !== false)).map((assignment) => {
    const submission = submissionByAssignmentId.get(assignment.id);
    return {
      ...assignment,
      submission_status: submission ? (submission.status || 'submitted') : null,
      submission_is_late: submission ? Boolean(submission.is_late) : null,
      is_overdue: !submission && isPastDeadline(assignment)
    };
  });
}

async function notifyStudents(students, payload) {
  if (students.length === 0) return;
  try {
    for (let index = 0; index < students.length; index += IN_QUERY_CHUNK) {
      const chunk = students.slice(index, index + IN_QUERY_CHUNK);
      await notificationService.createBulk(chunk.map((student) => student.id), payload);
    }
  } catch (error) {
    // The assignment itself is saved; a notification failure is not the caller's problem.
    console.error('Assignment notification fan-out failed:', error.message);
  }
}

async function loadAssignmentOr404(req, res) {
  if (!isValidDocId(req.params.id)) {
    res.status(404).json({ success: false, message: 'Assignment not found' });
    return null;
  }

  const assignment = await getRecord('assignments', req.params.id);
  if (!assignment) {
    res.status(404).json({ success: false, message: 'Assignment not found' });
    return null;
  }
  return assignment;
}

function canManage(user, assignment) {
  return user.role === 'admin' || String(assignment.created_by) === String(user.id);
}

/**
 * Admin cron endpoints may also be called by an external scheduler that holds
 * CRON_SECRET (Vercel cron cannot send a user token).
 */
function hasValidCronSecret(req) {
  const expected = process.env.CRON_SECRET;
  const provided = req.headers['x-cron-secret'];
  if (!expected || typeof provided !== 'string') return false;

  const left = Buffer.from(expected);
  const right = Buffer.from(provided);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

// Create assignment
router.post('/', authMiddleware, roleMiddleware('teacher', 'admin'), async (req, res, next) => {
  try {
    const body = req.body || {};
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const department = typeof body.department === 'string' ? body.department.trim() : '';
    const year = parseYear(body.year);
    const deadline = parseDeadline(body.deadline);
    const totalMarks = toNumber(body.total_marks, NaN);

    if (title.length < 3 || title.length > 200) {
      return res.status(400).json({ success: false, message: 'title must be 3-200 characters' });
    }
    if (!department) {
      return res.status(400).json({ success: false, message: 'department is required' });
    }
    if (year === null) {
      return res.status(400).json({ success: false, message: 'year must be a whole number between 1 and 6' });
    }
    if (!deadline) {
      return res.status(400).json({ success: false, message: 'deadline must be a valid date and time' });
    }
    if (Date.parse(deadline) <= Date.now()) {
      return res.status(400).json({ success: false, message: 'deadline must be in the future' });
    }
    if (!Number.isFinite(totalMarks) || totalMarks < 0) {
      return res.status(400).json({ success: false, message: 'total_marks must be a number greater than or equal to 0' });
    }

    const assignment = await createRecord('assignments', {
      title,
      description: body.description ? String(body.description) : null,
      subject: body.subject ? String(body.subject).trim() : null,
      department,
      year,
      total_marks: totalMarks,
      deadline,
      allow_late: body.allow_late === true,
      created_by: req.user.id,
      attachment_id: body.attachment_id || null,
      is_active: true
    });

    for (const section of KNOWN_SECTIONS) {
      emitToClass(department, year, section, 'assignments:update', { id: assignment.id });
    }

    // Persisted notifications: a student who is offline now still sees it later.
    const students = await loadClassStudents(assignment);
    await notifyStudents(students, {
      title: 'New assignment',
      message: `${title}${assignment.subject ? ` (${assignment.subject})` : ''} — due ${new Date(deadline).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`,
      type: 'assignment',
      link: '/dashboard/student-assignments.html',
      metadata: { assignmentId: assignment.id, deadline }
    });

    await recordAudit(req, {
      action: 'assignment_create',
      entityType: 'assignment',
      entityId: assignment.id,
      summary: title,
      metadata: { department, year, deadline }
    });

    res.status(201).json({
      success: true,
      message: 'Assignment created successfully',
      data: { id: assignment.id, notified: students.length }
    });
  } catch (error) {
    next(error);
  }
});

// Assignments created by the signed-in teacher (all of them for an admin)
router.get('/mine', authMiddleware, roleMiddleware('teacher', 'admin'), async (req, res, next) => {
  try {
    const filters = req.user.role === 'admin' ? [] : [{ field: 'created_by', value: String(req.user.id) }];
    const assignments = (await listRecords('assignments', {
      filters,
      orderBy: [{ field: 'deadline', direction: 'desc' }]
    })).filter((assignment) => assignment.is_active !== false);

    const submissionsByAssignment = new Map();
    const ids = assignments.map((assignment) => assignment.id);
    for (let index = 0; index < ids.length; index += IN_QUERY_CHUNK) {
      const chunk = ids.slice(index, index + IN_QUERY_CHUNK);
      const rows = await listRecords('assignment_submissions', {
        filters: [{ field: 'assignment_id', op: 'in', value: chunk }]
      });
      for (const row of rows) {
        const list = submissionsByAssignment.get(row.assignment_id) || [];
        list.push(row);
        submissionsByAssignment.set(row.assignment_id, list);
      }
    }

    // Class size per (department, year), computed once per distinct class.
    const classSizes = new Map();
    for (const assignment of assignments) {
      const key = `${assignment.department}|${assignment.year}`;
      if (!classSizes.has(key)) {
        classSizes.set(key, (await loadClassStudents(assignment)).length);
      }
    }

    const now = Date.now();
    let totalSubmitted = 0;
    let totalExpected = 0;
    let pendingGrading = 0;

    const data = assignments.map((assignment) => {
      const submissions = submissionsByAssignment.get(assignment.id) || [];
      const graded = submissions.filter((item) => item.status === 'graded').length;
      const expected = classSizes.get(`${assignment.department}|${assignment.year}`) || 0;

      totalSubmitted += submissions.length;
      totalExpected += expected;
      pendingGrading += submissions.length - graded;

      return {
        ...assignment,
        counts: {
          submitted: submissions.length,
          graded,
          pending: submissions.length - graded,
          late: submissions.filter((item) => item.is_late).length,
          expected
        },
        is_open: !isPastDeadline(assignment, now)
      };
    });

    res.json({
      success: true,
      data,
      stats: {
        totalAssignments: data.length,
        activeAssignments: data.filter((item) => item.is_open).length,
        pendingSubmissions: pendingGrading,
        avgSubmissionRate: totalExpected > 0 ? Number(((totalSubmitted * 100) / totalExpected).toFixed(1)) : null
      }
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

// Send "due soon" reminders now (admin, or an external scheduler with CRON_SECRET)
router.post('/reminders/run', (req, res, next) => {
  if (hasValidCronSecret(req)) return next();
  return authMiddleware(req, res, (authError) => {
    if (authError) return next(authError);
    return roleMiddleware('admin')(req, res, next);
  });
}, async (req, res, next) => {
  try {
    const windowHours = req.body && req.body.windowHours !== undefined ? Number(req.body.windowHours) : undefined;
    if (windowHours !== undefined && (!Number.isFinite(windowHours) || windowHours <= 0 || windowHours > 24 * 14)) {
      return res.status(400).json({ success: false, message: 'windowHours must be between 0 and 336' });
    }

    const summary = await runDueSoonReminders({ windowHours });
    res.json({ success: true, data: summary });
  } catch (error) {
    next(error);
  }
});

// Statistics for charts
router.get('/statistics', authMiddleware, roleMiddleware('student'), async (req, res, next) => {
  try {
    const userId = req.user.id;
    const year = parseYear(req.user.year);
    const assignments = (!req.user.department || year === null) ? [] : await listRecords('assignments', {
      filters: [
        { field: 'department', value: req.user.department },
        { field: 'year', op: 'in', value: yearVariants(year) }
      ]
    });
    const allSubmissions = await listRecords('assignment_submissions', {
      filters: [{ field: 'student_id', value: userId }]
    });

    // Only count work that belongs to this student's current assignments.
    const assignmentIds = new Set(assignments.map((assignment) => assignment.id));
    const submissions = allSubmissions.filter((item) => assignmentIds.has(item.assignment_id));

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

    const gradedSubmissions = submissions.filter((item) => item.status === 'graded');
    const overall = {
      totalAssignments: assignments.length,
      submitted: submissions.length,
      graded: gradedSubmissions.length,
      // Average over graded work only: an ungraded submission is not a zero.
      averageMarks: gradedSubmissions.length
        ? Number((gradedSubmissions.reduce((sum, item) => sum + toNumber(item.marks_obtained, 0), 0) / gradedSubmissions.length).toFixed(2))
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

// The signed-in student's own submission for one assignment
router.get('/:id/my-submission', authMiddleware, roleMiddleware('student'), async (req, res, next) => {
  try {
    if (!isValidDocId(req.params.id)) {
      return res.status(404).json({ success: false, message: 'Assignment not found' });
    }

    const submission = await findOne('assignment_submissions', {
      filters: [
        { field: 'assignment_id', value: req.params.id },
        { field: 'student_id', value: req.user.id }
      ]
    });

    if (!submission) {
      return res.status(404).json({ success: false, message: 'You have not submitted this assignment' });
    }

    res.json({ success: true, data: submission });
  } catch (error) {
    next(error);
  }
});

// Edit an assignment (owner or admin)
router.put('/:id', authMiddleware, roleMiddleware('teacher', 'admin'), async (req, res, next) => {
  try {
    const assignment = await loadAssignmentOr404(req, res);
    if (!assignment) return;

    if (!canManage(req.user, assignment)) {
      return res.status(403).json({ success: false, message: 'Only the teacher who created this assignment can edit it' });
    }

    const body = req.body || {};
    const updates = {};

    if (body.title !== undefined) {
      const title = typeof body.title === 'string' ? body.title.trim() : '';
      if (title.length < 3 || title.length > 200) {
        return res.status(400).json({ success: false, message: 'title must be 3-200 characters' });
      }
      updates.title = title;
    }
    if (body.description !== undefined) updates.description = body.description ? String(body.description) : null;
    if (body.subject !== undefined) updates.subject = body.subject ? String(body.subject).trim() : null;
    if (body.attachment_id !== undefined) updates.attachment_id = body.attachment_id || null;
    if (body.allow_late !== undefined) updates.allow_late = body.allow_late === true;

    if (body.total_marks !== undefined) {
      const totalMarks = toNumber(body.total_marks, NaN);
      if (!Number.isFinite(totalMarks) || totalMarks < 0) {
        return res.status(400).json({ success: false, message: 'total_marks must be a number greater than or equal to 0' });
      }
      updates.total_marks = totalMarks;
    }

    let deadlineChanged = false;
    if (body.deadline !== undefined) {
      const deadline = parseDeadline(body.deadline);
      if (!deadline) {
        return res.status(400).json({ success: false, message: 'deadline must be a valid date and time' });
      }
      deadlineChanged = deadline !== assignment.deadline;
      updates.deadline = deadline;
      // A moved deadline deserves a fresh reminder.
      if (deadlineChanged) updates.reminder_sent_at = null;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, message: 'No valid fields to update' });
    }

    updates.updated_by = req.user.id;
    await updateRecord('assignments', assignment.id, updates);

    if (deadlineChanged) {
      const [students, submissions] = await Promise.all([
        loadClassStudents(assignment),
        listRecords('assignment_submissions', { filters: [{ field: 'assignment_id', value: assignment.id }] })
      ]);
      const submitted = new Set(submissions.map((item) => String(item.student_id)));
      await notifyStudents(students.filter((student) => !submitted.has(String(student.id))), {
        title: 'Assignment deadline changed',
        message: `"${updates.title || assignment.title}" is now due ${new Date(updates.deadline).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}.`,
        type: 'assignment',
        link: '/dashboard/student-assignments.html',
        metadata: { assignmentId: assignment.id, deadline: updates.deadline }
      });
    }

    for (const section of KNOWN_SECTIONS) {
      emitToClass(assignment.department, assignment.year, section, 'assignments:update', { id: assignment.id });
    }

    await recordAudit(req, {
      action: 'assignment_update',
      entityType: 'assignment',
      entityId: assignment.id,
      summary: updates.title || assignment.title,
      metadata: { fields: Object.keys(updates) }
    });

    res.json({ success: true, message: 'Assignment updated', data: { id: assignment.id } });
  } catch (error) {
    next(error);
  }
});

// Close an assignment (soft delete; existing submissions and grades are kept)
router.delete('/:id', authMiddleware, roleMiddleware('teacher', 'admin'), async (req, res, next) => {
  try {
    const assignment = await loadAssignmentOr404(req, res);
    if (!assignment) return;

    if (!canManage(req.user, assignment)) {
      return res.status(403).json({ success: false, message: 'Only the teacher who created this assignment can delete it' });
    }

    await updateRecord('assignments', assignment.id, {
      is_active: false,
      closed_at: new Date().toISOString(),
      closed_by: req.user.id
    });

    for (const section of KNOWN_SECTIONS) {
      emitToClass(assignment.department, assignment.year, section, 'assignments:update', { id: assignment.id });
    }

    await recordAudit(req, {
      action: 'assignment_delete',
      entityType: 'assignment',
      entityId: assignment.id,
      summary: assignment.title
    });

    res.json({ success: true, message: 'Assignment removed' });
  } catch (error) {
    next(error);
  }
});

// Submit assignment
router.post('/:id/submit', authMiddleware, roleMiddleware('student'), async (req, res, next) => {
  try {
    const assignment = await loadAssignmentOr404(req, res);
    if (!assignment) return;

    if (assignment.is_active === false) {
      return res.status(404).json({ success: false, message: 'Assignment not found' });
    }

    // Students may only submit to their own class's assignments.
    const sameClass = assignment.department === req.user.department
      && parseYear(assignment.year) !== null
      && parseYear(assignment.year) === parseYear(req.user.year);
    if (!sameClass) {
      return res.status(403).json({ success: false, message: 'This assignment is not assigned to your class' });
    }

    const { submission_text, file_id, submission_answers } = req.body || {};
    if (!submission_text && !file_id && !submission_answers) {
      return res.status(400).json({ success: false, message: 'Provide an answer, a file, or both' });
    }

    const late = isPastDeadline(assignment);
    if (late && assignment.allow_late === false) {
      return res.status(403).json({
        success: false,
        message: 'The deadline for this assignment has passed and late submissions are not accepted',
        code: 'DEADLINE_PASSED'
      });
    }

    const existing = await findOne('assignment_submissions', {
      filters: [
        { field: 'assignment_id', value: assignment.id },
        { field: 'student_id', value: req.user.id }
      ]
    });

    if (existing && existing.status === 'graded') {
      return res.status(409).json({
        success: false,
        message: 'This submission has already been graded and can no longer be changed',
        code: 'ALREADY_GRADED'
      });
    }

    const payload = {
      assignment_id: assignment.id,
      student_id: req.user.id,
      submission_text: submission_text || null,
      file_id: file_id || null,
      submission_answers: normalizeSubmissionAnswers(submission_answers),
      status: 'submitted',
      is_late: late,
      submitted_at: new Date().toISOString()
    };

    if (existing) {
      await updateRecord('assignment_submissions', existing.id, payload);
    } else {
      await createRecord('assignment_submissions', payload);
    }

    res.json({
      success: true,
      message: late ? 'Assignment submitted (marked as late)' : 'Assignment submitted successfully',
      data: { is_late: late }
    });
  } catch (error) {
    next(error);
  }
});

// List submissions for one assignment (teacher grading context)
router.get('/:id/submissions', authMiddleware, roleMiddleware('teacher', 'admin'), async (req, res, next) => {
  try {
    const assignment = await loadAssignmentOr404(req, res);
    if (!assignment) return;

    if (!canManage(req.user, assignment)) {
      return res.status(403).json({ success: false, message: 'Only the teacher who created this assignment can view its submissions' });
    }

    const submissions = await listRecords('assignment_submissions', {
      filters: [{ field: 'assignment_id', value: assignment.id }]
    });

    // Show names instead of opaque ids.
    const students = new Map();
    const studentIds = Array.from(new Set(submissions.map((item) => String(item.student_id))));
    for (let index = 0; index < studentIds.length; index += IN_QUERY_CHUNK) {
      const found = await listRecords('users', {
        filters: [{ field: 'id', op: 'in', value: studentIds.slice(index, index + IN_QUERY_CHUNK) }]
      });
      found.forEach((user) => students.set(String(user.id), user));
    }

    res.json({
      success: true,
      data: submissions.map((submission) => {
        const student = students.get(String(submission.student_id));
        return {
          id: submission.id,
          student_id: submission.student_id,
          student_name: student?.name || null,
          registration_number: student?.registration_number || null,
          status: submission.status || 'submitted',
          is_late: Boolean(submission.is_late),
          submitted_at: submission.submitted_at || null,
          submission_text: submission.submission_text || null,
          file_id: submission.file_id || null,
          marks_obtained: submission.marks_obtained ?? null,
          feedback: submission.feedback || null
        };
      })
    });
  } catch (error) {
    next(error);
  }
});

// Grade submission
router.post('/:id/grade', authMiddleware, roleMiddleware('teacher', 'admin'), async (req, res, next) => {
  try {
    const assignment = await loadAssignmentOr404(req, res);
    if (!assignment) return;

    if (!canManage(req.user, assignment)) {
      return res.status(403).json({ success: false, message: 'Only the teacher who created this assignment can grade it' });
    }

    const { student_id, marks_obtained, feedback } = req.body || {};

    if (!student_id || !isValidDocId(student_id)) {
      return res.status(400).json({ success: false, message: 'student_id is required' });
    }

    const marks = marks_obtained === '' || marks_obtained === null || marks_obtained === undefined
      ? NaN
      : Number(marks_obtained);
    if (!Number.isFinite(marks) || marks < 0) {
      return res.status(400).json({ success: false, message: 'marks_obtained must be a number greater than or equal to 0' });
    }
    if (toNumber(assignment.total_marks, 0) > 0 && marks > Number(assignment.total_marks)) {
      return res.status(400).json({
        success: false,
        message: `marks_obtained cannot exceed the assignment's total marks (${assignment.total_marks})`
      });
    }

    const submission = await findOne('assignment_submissions', {
      filters: [
        { field: 'assignment_id', value: assignment.id },
        { field: 'student_id', value: String(student_id) }
      ]
    });

    if (!submission) {
      return res.status(404).json({ success: false, message: 'Submission not found' });
    }

    await updateRecord('assignment_submissions', submission.id, {
      marks_obtained: marks,
      feedback: feedback || null,
      graded_by: req.user.id,
      graded_at: new Date().toISOString(),
      status: 'graded'
    });

    emitToUser(student_id, 'assignments:update', { assignmentId: assignment.id });

    await notificationService.create({
      userId: student_id,
      title: 'Assignment Graded',
      message: `"${assignment.title}" was graded: ${marks}/${assignment.total_marks ?? '—'}.`,
      type: 'assignment',
      link: '/dashboard/student-assignments.html',
      metadata: {
        assignmentId: assignment.id,
        marks_obtained: marks
      }
    });

    await recordAudit(req, {
      action: 'assignment_grade',
      entityType: 'assignment',
      entityId: assignment.id,
      summary: `${assignment.title}: ${marks}/${assignment.total_marks ?? '—'} for ${student_id}`,
      metadata: { student_id, marks_obtained: marks }
    });

    res.json({ success: true, message: 'Assignment graded successfully' });
  } catch (error) {
    next(error);
  }
});

// Save or update MCQ answer key for an assignment
router.post('/:id/answer-key', authMiddleware, roleMiddleware('teacher', 'admin'), async (req, res, next) => {
  try {
    const assignment = await loadAssignmentOr404(req, res);
    if (!assignment) return;

    if (!canManage(req.user, assignment)) {
      return res.status(403).json({ success: false, message: 'Only the teacher who created this assignment can save its answer key' });
    }

    const { answerKey, totalPoints = 0, passPercentage = 40 } = req.body || {};

    if (!Array.isArray(answerKey) || answerKey.length === 0) {
      return res.status(400).json({ success: false, message: 'answerKey array is required' });
    }

    await updateRecord('assignment_answer_keys', assignment.id, {
      assignment_id: assignment.id,
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
    const assignment = await loadAssignmentOr404(req, res);
    if (!assignment) return;

    if (!canManage(req.user, assignment)) {
      return res.status(403).json({ success: false, message: 'Only the teacher who created this assignment can auto-grade it' });
    }

    const key = await findOne('assignment_answer_keys', {
      filters: [{ field: 'assignment_id', value: assignment.id }]
    });

    if (!key) {
      return res.status(404).json({ success: false, message: 'Answer key not configured' });
    }

    const submissions = await listRecords('assignment_submissions', {
      filters: [{ field: 'assignment_id', value: assignment.id }]
    });

    // Re-running after fixing the key may regrade earlier auto-grades, but a
    // grade a teacher entered by hand is only replaced on explicit request.
    const overwriteManual = req.body && req.body.overwrite === true;

    let graded = 0;
    let skippedManual = 0;
    for (const submission of submissions) {
      const manuallyGraded = submission.status === 'graded' && !(submission.feedback && submission.feedback.auto);
      if (manuallyGraded && !overwriteManual) {
        skippedManual += 1;
        continue;
      }

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

      emitToUser(submission.student_id, 'assignments:update', { assignmentId: assignment.id });
      await notificationService.create({
        userId: submission.student_id,
        title: 'Assignment Graded',
        message: `"${assignment.title}" was auto-graded: ${score}/${assignment.total_marks ?? '—'}.`,
        type: 'assignment',
        link: '/dashboard/student-assignments.html',
        metadata: { assignmentId: assignment.id, marks_obtained: score, auto: true }
      });
      graded += 1;
    }

    await recordAudit(req, {
      action: 'assignment_auto_grade',
      entityType: 'assignment',
      entityId: assignment.id,
      summary: `${assignment.title}: ${graded} graded, ${skippedManual} manual grades kept`,
      metadata: { graded, skippedManual, overwriteManual }
    });

    res.json({ success: true, message: 'Auto-grading complete', data: { graded, skippedManual } });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
