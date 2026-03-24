/**
 * Advanced Analytics Service
 * Provides detailed analytics and insights for students, teachers, and admins
 */

const { getRecord, listRecords } = require('./firebase-data.service');
const cacheService = require('./cache.service');

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toPercent(record) {
  const total = toNumber(record.total_marks, 0);
  if (!total) return 0;
  return (toNumber(record.marks_obtained, 0) / total) * 100;
}

function average(values = []) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function startOfMonthString(dateValue) {
  return String(dateValue || '').slice(0, 7);
}

class AdvancedAnalyticsService {
  async getStudentPerformance(studentId) {
    const cacheKey = `analytics:student:${studentId}`;
    const cached = cacheService.get(cacheKey);
    if (cached) return cached;

    const student = await getRecord('users', String(studentId));
    if (!student || student.role !== 'student') {
      throw new Error('Student not found');
    }

    const [marks, attendance, allUsers, assignments, submissions] = await Promise.all([
      listRecords('marks', { filters: [{ field: 'student_id', value: String(studentId) }] }),
      listRecords('attendance', { filters: [{ field: 'student_id', value: String(studentId) }] }),
      listRecords('users'),
      listRecords('assignments'),
      listRecords('assignment_submissions', { filters: [{ field: 'student_id', value: String(studentId) }] })
    ]);

    const markPercentages = marks.map(toPercent);
    const marksStats = {
      total_exams: marks.length,
      average_percentage: average(markPercentages),
      best_percentage: Math.max(...markPercentages, 0),
      worst_percentage: markPercentages.length ? Math.min(...markPercentages) : 0,
      excellent_count: marks.filter((mark) => ['A+', 'A'].includes(mark.grade)).length,
      failed_count: marks.filter((mark) => mark.grade === 'F').length
    };

    const subjectGroups = new Map();
    marks.forEach((mark) => {
      const key = mark.subject || 'Subject';
      if (!subjectGroups.has(key)) {
        subjectGroups.set(key, []);
      }
      subjectGroups.get(key).push(mark);
    });

    const subjectPerformance = Array.from(subjectGroups.entries())
      .map(([subject, records]) => {
        const percentages = records.map(toPercent);
        const recentGrades = records
          .sort((left, right) => String(right.created_at || '').localeCompare(String(left.created_at || '')))
          .map((item) => item.grade)
          .filter(Boolean)
          .slice(0, 3);

        return {
          subject,
          examCount: records.length,
          avgPercentage: average(percentages).toFixed(2),
          bestPercentage: Math.max(...percentages, 0).toFixed(2),
          worstPercentage: (percentages.length ? Math.min(...percentages) : 0).toFixed(2),
          recentGrades
        };
      })
      .sort((left, right) => Number(right.avgPercentage) - Number(left.avgPercentage));

    const classmateIds = new Set(
      allUsers
        .filter((user) =>
          user.role === 'student'
          && user.department === student.department
          && Number(user.year) === Number(student.year)
          && user.section === student.section)
        .map((user) => String(user.id))
    );

    const classMarks = await listRecords('marks');
    const classComparisonMap = new Map();
    classMarks.forEach((mark) => {
      if (!classmateIds.has(String(mark.student_id))) {
        return;
      }
      const subject = mark.subject || 'Subject';
      if (!classComparisonMap.has(subject)) {
        classComparisonMap.set(subject, { classPercentages: [], studentPercentages: [] });
      }
      const entry = classComparisonMap.get(subject);
      entry.classPercentages.push(toPercent(mark));
      if (String(mark.student_id) === String(studentId)) {
        entry.studentPercentages.push(toPercent(mark));
      }
    });

    const classComparison = Array.from(classComparisonMap.entries()).map(([subject, values]) => {
      const studentAvg = average(values.studentPercentages);
      const classAvg = average(values.classPercentages);
      return {
        subject,
        studentAvg: studentAvg.toFixed(2),
        classAvg: classAvg.toFixed(2),
        difference: (studentAvg - classAvg).toFixed(2),
        status: studentAvg > classAvg ? 'above' : studentAvg < classAvg ? 'below' : 'equal'
      };
    });

    const weakSubjects = classComparison
      .filter((item) => Number(item.studentAvg) < Number(item.classAvg) - 10)
      .map((item) => ({
        subject: item.subject,
        studentAvg: item.studentAvg,
        classAvg: item.classAvg,
        gap: (Number(item.classAvg) - Number(item.studentAvg)).toFixed(2)
      }));

    const strongSubjects = classComparison
      .filter((item) => Number(item.studentAvg) > Number(item.classAvg) + 10)
      .map((item) => ({
        subject: item.subject,
        studentAvg: item.studentAvg,
        classAvg: item.classAvg,
        advantage: (Number(item.studentAvg) - Number(item.classAvg)).toFixed(2)
      }));

    const attendanceStats = {
      total_classes: attendance.length,
      present_count: attendance.filter((item) => item.status === 'present').length,
      absent_count: attendance.filter((item) => item.status === 'absent').length,
      late_count: attendance.filter((item) => item.status === 'late').length,
      attendance_percentage: attendance.length
        ? (attendance.filter((item) => item.status === 'present').length / attendance.length) * 100
        : 0
    };

    const trendMap = new Map();
    marks.forEach((mark) => {
      const month = startOfMonthString(mark.exam_date || mark.created_at);
      if (!month) return;
      if (!trendMap.has(month)) {
        trendMap.set(month, []);
      }
      trendMap.get(month).push(toPercent(mark));
    });

    const performanceTrend = Array.from(trendMap.entries())
      .sort(([left], [right]) => left.localeCompare(right))
      .slice(-6)
      .map(([month, values]) => ({
        month,
        avg_percentage: Number(average(values).toFixed(2)),
        exam_count: values.length
      }));

    const prediction = this.predictPerformanceTrend(performanceTrend);
    const submittedAssignments = new Map(submissions.map((item) => [String(item.assignment_id), item]));
    const recentAssignments = assignments
      .filter((assignment) => assignment.department === student.department && Number(assignment.year) === Number(student.year))
      .filter((assignment) => assignment.is_active !== false)
      .sort((left, right) => String(left.deadline || '').localeCompare(String(right.deadline || '')))
      .slice(0, 5)
      .map((assignment) => {
        const submission = submittedAssignments.get(String(assignment.id));
        return {
          ...assignment,
          isSubmitted: Boolean(submission),
          isOverdue: Boolean(assignment.deadline) && new Date(assignment.deadline) < new Date() && !submission
        };
      });

    const result = {
      student: {
        id: student.id,
        name: student.name || student.full_name,
        username: student.username || student.registration_number || student.id,
        department: student.department,
        year: student.year,
        section: student.section
      },
      marks: {
        totalExams: marksStats.total_exams || 0,
        averagePercentage: toNumber(marksStats.average_percentage).toFixed(2),
        bestPercentage: toNumber(marksStats.best_percentage).toFixed(2),
        worstPercentage: toNumber(marksStats.worst_percentage).toFixed(2),
        excellentCount: marksStats.excellent_count || 0,
        failedCount: marksStats.failed_count || 0
      },
      subjectPerformance,
      classComparison,
      weakSubjects,
      strongSubjects,
      attendance: {
        ...attendanceStats,
        attendance_percentage: toNumber(attendanceStats.attendance_percentage).toFixed(2)
      },
      performanceTrend,
      prediction,
      recentAssignments,
      insights: this.generateInsights(marksStats, attendanceStats, weakSubjects, strongSubjects)
    };

    cacheService.set(cacheKey, result, 1800);
    return result;
  }

  async getAttendancePatterns(filters = {}) {
    const [users, attendance] = await Promise.all([
      listRecords('users'),
      listRecords('attendance')
    ]);

    const filteredStudents = users.filter((user) => {
      if (user.role !== 'student') return false;
      if (filters.department && user.department !== filters.department) return false;
      if (filters.year && Number(user.year) !== Number(filters.year)) return false;
      if (filters.section && user.section !== filters.section) return false;
      return true;
    });

    const studentById = new Map(filteredStudents.map((user) => [String(user.id), user]));
    const attendanceByStudent = new Map();
    attendance.forEach((record) => {
      const studentId = String(record.student_id || '');
      if (!studentById.has(studentId)) return;
      if (!attendanceByStudent.has(studentId)) {
        attendanceByStudent.set(studentId, []);
      }
      attendanceByStudent.get(studentId).push(record);
    });

    const chronicAbsentees = filteredStudents
      .map((student) => {
        const records = attendanceByStudent.get(String(student.id)) || [];
        const present = records.filter((item) => item.status === 'present').length;
        const attendancePercentage = records.length ? (present / records.length) * 100 : 0;
        return {
          id: student.id,
          username: student.username || student.registration_number || student.id,
          full_name: student.name || student.full_name || 'Student',
          department: student.department,
          year: student.year,
          section: student.section,
          total_classes: records.length,
          present_count: present,
          attendance_percentage: attendancePercentage.toFixed(2)
        };
      })
      .filter((item) => Number(item.attendance_percentage) < 75)
      .sort((left, right) => Number(left.attendance_percentage) - Number(right.attendance_percentage));

    const suspiciousMap = new Map();
    attendance
      .filter((record) => Date.parse(record.created_at || '') >= Date.now() - (30 * 24 * 60 * 60 * 1000))
      .forEach((record) => {
        const key = `${record.student_id}::${record.date}`;
        if (!suspiciousMap.has(key)) {
          suspiciousMap.set(key, []);
        }
        suspiciousMap.get(key).push(record);
      });

    const suspiciousPatterns = Array.from(suspiciousMap.entries())
      .filter(([, records]) => records.length > 1)
      .map(([key, records]) => {
        const [studentId, attendanceDate] = key.split('::');
        const student = studentById.get(studentId) || {};
        return {
          student_id: studentId,
          username: student.username || student.registration_number || studentId,
          full_name: student.name || student.full_name || 'Student',
          attendance_date: attendanceDate,
          attendance_count: records.length,
          marked_by_users: records.map((record) => record.marked_by).filter(Boolean).join(',')
        };
      })
      .sort((left, right) => right.attendance_count - left.attendance_count);

    const perfectAttendance = filteredStudents
      .map((student) => {
        const records = (attendanceByStudent.get(String(student.id)) || []).filter((record) =>
          Date.parse(record.created_at || record.date || '') >= Date.now() - (30 * 24 * 60 * 60 * 1000));
        const present = records.filter((item) => item.status === 'present').length;
        return {
          id: student.id,
          username: student.username || student.registration_number || student.id,
          full_name: student.name || student.full_name || 'Student',
          department: student.department,
          year: student.year,
          section: student.section,
          total_classes: records.length,
          present_count: present
        };
      })
      .filter((item) => item.total_classes > 10 && item.present_count === item.total_classes)
      .sort((left, right) => right.total_classes - left.total_classes);

    const recentAttendance = attendance.filter((record) =>
      Date.parse(record.date || record.created_at || '') >= Date.now() - (60 * 24 * 60 * 60 * 1000));

    const dayOfWeekMap = new Map();
    recentAttendance.forEach((record) => {
      const date = new Date(record.date || record.created_at);
      if (Number.isNaN(date.getTime())) return;
      const label = date.toLocaleDateString('en-US', { weekday: 'long' });
      if (!dayOfWeekMap.has(label)) {
        dayOfWeekMap.set(label, { day_of_week: label, total_classes: 0, present_count: 0, dayIndex: date.getDay() });
      }
      const entry = dayOfWeekMap.get(label);
      entry.total_classes += 1;
      if (record.status === 'present') {
        entry.present_count += 1;
      }
    });

    const dayOfWeekTrends = Array.from(dayOfWeekMap.values())
      .sort((left, right) => left.dayIndex - right.dayIndex)
      .map((entry) => ({
        day_of_week: entry.day_of_week,
        total_classes: entry.total_classes,
        present_count: entry.present_count,
        attendance_rate: entry.total_classes
          ? ((entry.present_count / entry.total_classes) * 100).toFixed(2)
          : '0.00'
      }));

    const subjectMap = new Map();
    attendance
      .filter((record) => Date.parse(record.date || record.created_at || '') >= Date.now() - (30 * 24 * 60 * 60 * 1000))
      .forEach((record) => {
        const subject = record.subject || 'Subject';
        if (!subjectMap.has(subject)) {
          subjectMap.set(subject, { subject, total_classes: 0, present_count: 0 });
        }
        const entry = subjectMap.get(subject);
        entry.total_classes += 1;
        if (record.status === 'present') {
          entry.present_count += 1;
        }
      });

    const subjectAttendance = Array.from(subjectMap.values())
      .map((entry) => ({
        subject: entry.subject,
        total_classes: entry.total_classes,
        present_count: entry.present_count,
        attendance_rate: entry.total_classes
          ? ((entry.present_count / entry.total_classes) * 100).toFixed(2)
          : '0.00'
      }))
      .sort((left, right) => Number(left.attendance_rate) - Number(right.attendance_rate));

    return {
      chronicAbsentees,
      suspiciousPatterns,
      perfectAttendance,
      dayOfWeekTrends,
      subjectAttendance,
      summary: {
        totalChronicAbsentees: chronicAbsentees.length,
        totalSuspiciousPatterns: suspiciousPatterns.length,
        totalPerfectAttendance: perfectAttendance.length,
        lowestAttendanceDay: dayOfWeekTrends[0]?.day_of_week,
        lowestAttendanceSubject: subjectAttendance[0]?.subject
      }
    };
  }

  async getTeacherAnalytics(teacherId) {
    const [attendance, marks] = await Promise.all([
      listRecords('attendance', { filters: [{ field: 'marked_by', value: String(teacherId) }] }),
      listRecords('marks', { filters: [{ field: 'uploaded_by', value: String(teacherId) }] })
    ]);

    const classMap = new Map();
    attendance.forEach((record) => {
      const subject = record.subject || 'Subject';
      if (!classMap.has(subject)) {
        classMap.set(subject, {
          subject,
          classes: new Set(),
          students: new Set(),
          total_sessions: 0
        });
      }
      const entry = classMap.get(subject);
      entry.classes.add(`${record.department || ''}-${record.year || ''}-${record.section || ''}`);
      entry.students.add(String(record.student_id));
      entry.total_sessions += 1;
    });

    const classesTaught = Array.from(classMap.values()).map((entry) => ({
      subject: entry.subject,
      class_count: entry.classes.size,
      student_count: entry.students.size,
      total_sessions: entry.total_sessions
    }));

    const attendanceStats = {
      total_marked: attendance.length,
      days_active: new Set(attendance.map((record) => String(record.date || '').slice(0, 10)).filter(Boolean)).size,
      avg_attendance_rate: attendance.length
        ? average(attendance.map((record) => record.status === 'present' ? 100 : 0))
        : 0
    };

    const marksStats = {
      total_marks_uploaded: marks.length,
      subjects_taught: new Set(marks.map((record) => record.subject).filter(Boolean)).size,
      class_average: marks.length ? average(marks.map(toPercent)) : 0
    };

    const recentActivityMap = new Map();
    [...attendance.map((item) => ({ type: 'attendance', ...item })), ...marks.map((item) => ({ type: 'marks', ...item }))]
      .forEach((record) => {
        const key = `${record.type}::${record.subject || 'Subject'}`;
        if (!recentActivityMap.has(key)) {
          recentActivityMap.set(key, {
            type: record.type,
            subject: record.subject || 'Subject',
            count: 0,
            last_activity: record.created_at || record.date || null
          });
        }
        const entry = recentActivityMap.get(key);
        entry.count += 1;
        const candidate = String(record.created_at || record.date || '');
        if (candidate > String(entry.last_activity || '')) {
          entry.last_activity = candidate;
        }
      });

    const recentActivity = Array.from(recentActivityMap.values())
      .sort((left, right) => String(right.last_activity || '').localeCompare(String(left.last_activity || '')))
      .slice(0, 10);

    return {
      classesTaught,
      attendanceStats,
      marksStats,
      recentActivity
    };
  }

  predictPerformanceTrend(data) {
    if (!data || data.length < 2) {
      return { trend: 'insufficient_data', prediction: null };
    }

    const n = data.length;
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumX2 = 0;

    data.forEach((point, index) => {
      const x = index;
      const y = parseFloat(point.avg_percentage);
      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumX2 += x * x;
    });

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    const nextValue = slope * n + intercept;

    return {
      trend: slope > 0.5 ? 'improving' : slope < -0.5 ? 'declining' : 'stable',
      prediction: parseFloat(nextValue).toFixed(2),
      slope: parseFloat(slope).toFixed(2),
      confidence: Math.min(n / 6, 1) * 100
    };
  }

  generateInsights(marksStats, attendanceStats, weakSubjects, strongSubjects) {
    const insights = [];
    const avgPercentage = parseFloat(marksStats.average_percentage || 0);
    if (avgPercentage >= 80) {
      insights.push({ type: 'success', message: 'Excellent overall performance! Keep up the great work.' });
    } else if (avgPercentage >= 60) {
      insights.push({ type: 'info', message: 'Good performance. Focus on weak subjects to improve further.' });
    } else {
      insights.push({ type: 'warning', message: 'Performance needs improvement. Consider seeking help from teachers.' });
    }

    const attendancePercentage = parseFloat(attendanceStats.attendance_percentage || 0);
    if (attendancePercentage < 75) {
      insights.push({
        type: 'danger',
        message: `Low attendance (${attendancePercentage.toFixed(1)}%). Risk of not meeting minimum attendance requirement.`
      });
    } else if (attendancePercentage < 85) {
      insights.push({
        type: 'warning',
        message: `Attendance is below recommended level (${attendancePercentage.toFixed(1)}%). Try to attend more classes.`
      });
    }

    if (weakSubjects.length > 0) {
      insights.push({
        type: 'warning',
        message: `Need improvement in: ${weakSubjects.map((subject) => subject.subject).join(', ')}`
      });
    }

    if (strongSubjects.length > 0) {
      insights.push({
        type: 'success',
        message: `Performing well in: ${strongSubjects.map((subject) => subject.subject).join(', ')}`
      });
    }

    return insights;
  }
}

module.exports = new AdvancedAnalyticsService();
