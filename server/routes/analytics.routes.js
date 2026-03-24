const express = require('express');
const router = express.Router();
const { authMiddleware, roleMiddleware } = require('../middleware/auth');
const { analyticsCacheMiddleware } = require('../middleware/cache.middleware');
const { listRecords } = require('../services/firebase-data.service');

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getAnalyticsTargetUserId(req, paramKey = 'studentId') {
  if (req.user.role === 'student') return req.user.id;
  return req.params[paramKey] || req.query.studentId || req.user.id;
}

function getMonthKey(dateString) {
  return String(dateString || '').slice(0, 7);
}

function getGradeLabel(percentage) {
  if (percentage >= 90) return 'A+';
  if (percentage >= 80) return 'A';
  if (percentage >= 70) return 'B+';
  if (percentage >= 60) return 'B';
  if (percentage >= 50) return 'C';
  return 'F';
}

router.get('/overview', authMiddleware, roleMiddleware('admin'), analyticsCacheMiddleware(600), async (req, res, next) => {
  try {
    const [users, files, events, activityLog] = await Promise.all([
      listRecords('users'),
      listRecords('files'),
      listRecords('events'),
      listRecords('activity_log', {
        orderBy: [{ field: 'created_at', direction: 'desc' }],
        limit: 20
      })
    ]);

    const stats = {
      total_students: users.filter((user) => user.role === 'student').length,
      total_teachers: users.filter((user) => user.role === 'teacher').length,
      approved_files: files.filter((file) => file.approved === true).length,
      pending_files: files.filter((file) => file.approved === false).length,
      active_events: events.filter((event) => event.is_active !== false).length,
      total_storage: files.reduce((sum, file) => sum + toNumber(file.file_size, 0), 0)
    };

    res.json({ success: true, data: { stats, recentActivity: activityLog } });
  } catch (error) {
    next(error);
  }
});

router.get('/attendance-stats', authMiddleware, roleMiddleware('admin', 'teacher'), analyticsCacheMiddleware(600), async (req, res, next) => {
  try {
    const attendance = await listRecords('attendance');
    const cutoff = Date.now() - (30 * 24 * 60 * 60 * 1000);
    const grouped = new Map();

    for (const record of attendance) {
      const timestamp = Date.parse(record.date || '');
      if (Number.isNaN(timestamp) || timestamp < cutoff) continue;
      if (!grouped.has(record.date)) {
        grouped.set(record.date, {
          date: record.date,
          total_marked: 0,
          present_count: 0,
          absent_count: 0
        });
      }

      const item = grouped.get(record.date);
      item.total_marked += 1;
      if (record.status === 'present' || record.status === 'late') item.present_count += 1;
      if (record.status === 'absent') item.absent_count += 1;
    }

    res.json({
      success: true,
      data: Array.from(grouped.values()).sort((left, right) => String(right.date).localeCompare(String(left.date)))
    });
  } catch (error) {
    next(error);
  }
});

router.get('/student-performance/:studentId', authMiddleware, analyticsCacheMiddleware(600), async (req, res, next) => {
  try {
    const studentId = req.params.studentId;
    if (req.user.role === 'student' && req.user.id !== studentId) {
      return res.status(403).json({ success: false, message: 'You can only view your own performance analytics' });
    }

    const [marks, attendance] = await Promise.all([
      listRecords('marks', { filters: [{ field: 'student_id', value: studentId }] }),
      listRecords('attendance', { filters: [{ field: 'student_id', value: studentId }] })
    ]);

    const marksBySubject = new Map();
    for (const mark of marks) {
      const subject = mark.subject || 'General';
      if (!marksBySubject.has(subject)) {
        marksBySubject.set(subject, { subject, sum: 0, total: 0, count: 0 });
      }
      const item = marksBySubject.get(subject);
      item.sum += toNumber(mark.marks_obtained, 0);
      item.total += toNumber(mark.total_marks, 0);
      item.count += 1;
    }

    const attendanceBySubject = new Map();
    for (const record of attendance) {
      const subject = record.subject || 'General';
      if (!attendanceBySubject.has(subject)) {
        attendanceBySubject.set(subject, { subject, total: 0, present: 0 });
      }
      const item = attendanceBySubject.get(subject);
      item.total += 1;
      if (record.status === 'present' || record.status === 'late') item.present += 1;
    }

    const weakSubjects = Array.from(new Set([
      ...marksBySubject.keys(),
      ...attendanceBySubject.keys()
    ])).map((subject) => {
      const markData = marksBySubject.get(subject);
      const attendanceData = attendanceBySubject.get(subject);
      const averageScore = markData && markData.total > 0 ? (markData.sum / markData.total) * 100 : null;
      const attendanceRate = attendanceData && attendanceData.total > 0 ? (attendanceData.present / attendanceData.total) * 100 : null;
      const priority = averageScore != null && averageScore < 70
        ? 'high'
        : attendanceRate != null && attendanceRate < 75
          ? 'medium'
          : 'low';

      return {
        subject,
        averageScore: averageScore != null ? Number(averageScore.toFixed(2)) : null,
        attendanceRate: attendanceRate != null ? Number(attendanceRate.toFixed(2)) : null,
        priority
      };
    }).filter((item) => (item.averageScore != null && item.averageScore < 75) || (item.attendanceRate != null && item.attendanceRate < 80))
      .sort((left, right) => {
        const leftScore = Math.min(left.averageScore ?? 100, left.attendanceRate ?? 100);
        const rightScore = Math.min(right.averageScore ?? 100, right.attendanceRate ?? 100);
        return leftScore - rightScore;
      });

    const overallScore = marks.length
      ? Number((marks.reduce((sum, mark) => {
        const total = toNumber(mark.total_marks, 0);
        return sum + (total ? ((toNumber(mark.marks_obtained, 0) / total) * 100) : 0);
      }, 0) / marks.length).toFixed(2))
      : 0;
    const overallAttendance = attendance.length
      ? Number(((attendance.filter((record) => record.status === 'present' || record.status === 'late').length * 100) / attendance.length).toFixed(2))
      : 0;

    res.json({
      success: true,
      data: {
        weakSubjects,
        summary: {
          overallScore,
          overallAttendance,
          totalExams: marks.length,
          totalClasses: attendance.length
        }
      }
    });
  } catch (error) {
    console.error('Student performance analytics error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/attendance-patterns', authMiddleware, roleMiddleware('admin', 'teacher'), analyticsCacheMiddleware(600), async (req, res, next) => {
  try {
    const { department, year, section } = req.query;
    const [users, attendance] = await Promise.all([
      listRecords('users'),
      listRecords('attendance')
    ]);

    const filteredUsers = users.filter((user) => {
      if (user.role !== 'student') return false;
      if (department && user.department !== department) return false;
      if (year && String(user.year) !== String(year)) return false;
      if (section && user.section !== section) return false;
      return true;
    });
    const userSet = new Set(filteredUsers.map((user) => user.id));

    const grouped = new Map();
    for (const record of attendance) {
      if (!userSet.has(record.student_id)) continue;
      if (!grouped.has(record.student_id)) {
        const user = filteredUsers.find((item) => item.id === record.student_id);
        grouped.set(record.student_id, {
          studentId: record.student_id,
          name: user?.name || record.student_id,
          totalClasses: 0,
          present: 0
        });
      }
      const item = grouped.get(record.student_id);
      item.totalClasses += 1;
      if (record.status === 'present' || record.status === 'late') item.present += 1;
    }

    const patterns = Array.from(grouped.values()).map((item) => ({
      ...item,
      attendanceRate: item.totalClasses ? Number(((item.present * 100) / item.totalClasses).toFixed(2)) : 0
    })).sort((left, right) => left.attendanceRate - right.attendanceRate);

    res.json({ success: true, data: patterns });
  } catch (error) {
    console.error('Attendance patterns error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/teacher/:teacherId', authMiddleware, roleMiddleware('admin', 'teacher'), analyticsCacheMiddleware(600), async (req, res, next) => {
  try {
    const teacherId = req.params.teacherId;
    if (req.user.role === 'teacher' && req.user.id !== teacherId) {
      return res.status(403).json({ success: false, message: 'You can only view your own analytics' });
    }

    const [assignments, timetable, marks] = await Promise.all([
      listRecords('assignments', { filters: [{ field: 'created_by', value: teacherId }] }),
      listRecords('timetable', { filters: [{ field: 'teacher_id', value: teacherId }] }),
      listRecords('marks', { filters: [{ field: 'uploaded_by', value: teacherId }] })
    ]);

    res.json({
      success: true,
      data: {
        assignmentsCreated: assignments.length,
        timetableSlots: timetable.length,
        marksUploaded: marks.length
      }
    });
  } catch (error) {
    console.error('Teacher analytics error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/performance-trend', authMiddleware, analyticsCacheMiddleware(600), async (req, res) => {
  try {
    const userId = getAnalyticsTargetUserId(req);
    const months = toNumber(req.query.months, 6);
    const [marks, allMarks] = await Promise.all([
      listRecords('marks', { filters: [{ field: 'student_id', value: userId }] }),
      listRecords('marks')
    ]);
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - months);

    const grouped = new Map();
    for (const mark of marks) {
      const key = getMonthKey(mark.exam_date || mark.created_at);
      if (!key || key < cutoff.toISOString().slice(0, 7)) continue;
      if (!grouped.has(key)) {
        grouped.set(key, { student: [], class: [] });
      }

      const entry = grouped.get(key);
      const total = toNumber(mark.total_marks, 0);
      if (total > 0) entry.student.push((toNumber(mark.marks_obtained, 0) / total) * 100);

      const related = allMarks.filter((item) => getMonthKey(item.exam_date || item.created_at) === key);
      entry.class = related
        .map((item) => {
          const itemTotal = toNumber(item.total_marks, 0);
          return itemTotal > 0 ? ((toNumber(item.marks_obtained, 0) / itemTotal) * 100) : null;
        })
        .filter((value) => value != null);
    }

    const labels = Array.from(grouped.keys()).sort();
    res.json({
      success: true,
      data: {
        labels,
        studentMarks: labels.map((label) => {
          const values = grouped.get(label)?.student || [];
          return values.length ? Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2)) : 0;
        }),
        classAverage: labels.map((label) => {
          const values = grouped.get(label)?.class || [];
          return values.length ? Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2)) : 0;
        }),
        target: labels.map(() => 85)
      }
    });
  } catch (error) {
    console.error('Performance trend error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch performance trends' });
  }
});

router.get('/attendance-calendar', authMiddleware, analyticsCacheMiddleware(300), async (req, res) => {
  try {
    const userId = getAnalyticsTargetUserId(req);
    const weeks = toNumber(req.query.weeks, 12);
    const attendance = await listRecords('attendance', {
      filters: [{ field: 'student_id', value: userId }]
    });
    const cutoff = Date.now() - (weeks * 7 * 24 * 60 * 60 * 1000);
    const grouped = new Map();

    for (const record of attendance) {
      const timestamp = Date.parse(record.date || '');
      if (Number.isNaN(timestamp) || timestamp < cutoff) continue;
      if (!grouped.has(record.date)) {
        grouped.set(record.date, { date: record.date, total: 0, present: 0 });
      }
      const item = grouped.get(record.date);
      item.total += 1;
      if (record.status === 'present' || record.status === 'late') item.present += 1;
    }

    res.json({
      success: true,
      data: Array.from(grouped.values()).sort((left, right) => String(left.date).localeCompare(String(right.date)))
    });
  } catch (error) {
    console.error('Attendance calendar error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch attendance data' });
  }
});

router.get('/subject-comparison', authMiddleware, analyticsCacheMiddleware(600), async (req, res) => {
  try {
    const userId = getAnalyticsTargetUserId(req);
    const [marks, allMarks] = await Promise.all([
      listRecords('marks', { filters: [{ field: 'student_id', value: userId }] }),
      listRecords('marks')
    ]);

    const grouped = new Map();
    for (const mark of marks) {
      const subject = mark.subject || 'General';
      if (!grouped.has(subject)) grouped.set(subject, []);
      const total = toNumber(mark.total_marks, 0);
      if (total > 0) grouped.get(subject).push((toNumber(mark.marks_obtained, 0) / total) * 100);
    }

    const subjects = Array.from(grouped.keys());
    res.json({
      success: true,
      data: {
        subjects,
        studentScores: subjects.map((subject) => {
          const values = grouped.get(subject) || [];
          return values.length ? Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2)) : 0;
        }),
        classAverage: subjects.map((subject) => {
          const values = allMarks
            .filter((item) => item.subject === subject)
            .map((item) => {
              const total = toNumber(item.total_marks, 0);
              return total > 0 ? ((toNumber(item.marks_obtained, 0) / total) * 100) : null;
            })
            .filter((value) => value != null);
          return values.length ? Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2)) : 0;
        })
      }
    });
  } catch (error) {
    console.error('Subject comparison error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch subject comparison' });
  }
});

router.get('/grade-distribution', authMiddleware, analyticsCacheMiddleware(600), async (req, res) => {
  try {
    const userId = getAnalyticsTargetUserId(req);
    const marks = await listRecords('marks', { filters: [{ field: 'student_id', value: userId }] });
    const gradeOrder = ['A+', 'A', 'B+', 'B', 'C', 'F'];
    const counts = new Map(gradeOrder.map((grade) => [grade, 0]));

    for (const mark of marks) {
      const total = toNumber(mark.total_marks, 0);
      if (total <= 0) continue;
      const grade = getGradeLabel((toNumber(mark.marks_obtained, 0) / total) * 100);
      counts.set(grade, (counts.get(grade) || 0) + 1);
    }

    res.json({
      success: true,
      data: {
        grades: gradeOrder,
        counts: gradeOrder.map((grade) => counts.get(grade) || 0)
      }
    });
  } catch (error) {
    console.error('Grade distribution error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch grade distribution' });
  }
});

router.get('/monthly-progress', authMiddleware, analyticsCacheMiddleware(300), async (req, res) => {
  try {
    const userId = getAnalyticsTargetUserId(req);
    const currentMonth = new Date().toISOString().slice(0, 7);
    const [assignments, submissions, attendance] = await Promise.all([
      listRecords('assignments', {
        filters: [
          { field: 'department', value: req.user.department },
          { field: 'year', value: req.user.year }
        ]
      }),
      listRecords('assignment_submissions', { filters: [{ field: 'student_id', value: userId }] }),
      listRecords('attendance', { filters: [{ field: 'student_id', value: userId }] })
    ]);

    const currentAssignments = assignments.filter((assignment) => String(assignment.deadline || '').slice(0, 7) === currentMonth);
    const submissionIds = new Set(submissions.map((item) => item.assignment_id));
    const completed = currentAssignments.filter((assignment) => submissionIds.has(assignment.id)).length;
    const pending = Math.max(currentAssignments.length - completed, 0);

    const currentAttendance = attendance.filter((record) => String(record.date || '').slice(0, 7) === currentMonth);
    const present = currentAttendance.filter((record) => record.status === 'present' || record.status === 'late').length;
    const absent = currentAttendance.filter((record) => record.status === 'absent').length;

    res.json({
      success: true,
      data: {
        labels: ['Assignments Completed', 'Assignments Pending', 'Days Present', 'Days Absent'],
        values: [completed, pending, present, absent]
      }
    });
  } catch (error) {
    console.error('Monthly progress error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch monthly progress' });
  }
});

module.exports = router;
