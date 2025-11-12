/**
 * Advanced Analytics Service
 * Provides detailed analytics and insights for students, teachers, and admins
 */

const db = require('../database/db');
const cacheService = require('./cache.service');

class AdvancedAnalyticsService {
  /**
   * Get comprehensive student performance analytics
   * @param {number} studentId - Student ID
   * @returns {Object} Performance analytics
   */
  async getStudentPerformance(studentId) {
    const cacheKey = `analytics:student:${studentId}`;
    const cached = cacheService.get(cacheKey);
    if (cached) return cached;

    try {
      // Get student details
      const studentRows = await db.query(
        'SELECT id, username, full_name, department, year, section FROM users WHERE id = ? AND role = "student"',
        [studentId]
      );
      const student = studentRows[0];

      if (!student) {
        throw new Error('Student not found');
      }

      // Get marks statistics
      const marksStatsRows = await db.query(`
        SELECT 
          COUNT(*) as total_exams,
          AVG(marks_obtained / total_marks * 100) as average_percentage,
          MAX(marks_obtained / total_marks * 100) as best_percentage,
          MIN(marks_obtained / total_marks * 100) as worst_percentage,
          SUM(CASE WHEN grade IN ('A+', 'A') THEN 1 ELSE 0 END) as excellent_count,
          SUM(CASE WHEN grade = 'F' THEN 1 ELSE 0 END) as failed_count
        FROM marks
        WHERE student_id = ?
      `, [studentId]);
      const marksStats = marksStatsRows[0] || {};

      // Get subject-wise performance
      const subjectPerformance = await db.query(`
        SELECT 
          subject,
          COUNT(*) as exam_count,
          AVG(marks_obtained / total_marks * 100) as avg_percentage,
          MAX(marks_obtained / total_marks * 100) as best_percentage,
          MIN(marks_obtained / total_marks * 100) as worst_percentage,
          GROUP_CONCAT(grade ORDER BY created_at DESC) as recent_grades
        FROM marks
        WHERE student_id = ?
        GROUP BY subject
        ORDER BY avg_percentage DESC
      `, [studentId]);

      // Get class average for comparison
      const classAverages = await db.query(`
        SELECT 
          m.subject,
          AVG(m.marks_obtained / m.total_marks * 100) as class_avg,
          (SELECT AVG(marks_obtained / total_marks * 100) 
           FROM marks 
           WHERE student_id = ? AND subject = m.subject) as student_avg
        FROM marks m
        JOIN users u ON m.student_id = u.id
        WHERE u.department = ? AND u.year = ? AND u.section = ?
        GROUP BY m.subject
      `, [studentId, student.department, student.year, student.section]);

      // Identify weak subjects (below class average by 10% or more)
      const weakSubjects = classAverages
        .filter(s => s.student_avg < s.class_avg - 10)
        .map(s => ({
          subject: s.subject,
          studentAvg: parseFloat(s.student_avg).toFixed(2),
          classAvg: parseFloat(s.class_avg).toFixed(2),
          gap: parseFloat(s.class_avg - s.student_avg).toFixed(2)
        }));

      // Identify strong subjects (above class average by 10% or more)
      const strongSubjects = classAverages
        .filter(s => s.student_avg > s.class_avg + 10)
        .map(s => ({
          subject: s.subject,
          studentAvg: parseFloat(s.student_avg).toFixed(2),
          classAvg: parseFloat(s.class_avg).toFixed(2),
          advantage: parseFloat(s.student_avg - s.class_avg).toFixed(2)
        }));

      // Get attendance statistics
      const attendanceStatsRows = await db.query(`
        SELECT 
          COUNT(*) as total_classes,
          SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) as present_count,
          SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) as absent_count,
          SUM(CASE WHEN status = 'late' THEN 1 ELSE 0 END) as late_count,
          (SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) / COUNT(*) * 100) as attendance_percentage
        FROM attendance
        WHERE student_id = ?
      `, [studentId]);
      const attendanceStats = attendanceStatsRows[0] || {};

      // Get performance trend (last 6 months)
      const performanceTrend = await db.query(`
        SELECT 
          DATE_FORMAT(created_at, '%Y-%m') as month,
          AVG(marks_obtained / total_marks * 100) as avg_percentage,
          COUNT(*) as exam_count
        FROM marks
        WHERE student_id = ? 
        AND created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
        GROUP BY DATE_FORMAT(created_at, '%Y-%m')
        ORDER BY month ASC
      `, [studentId]);

      // Predict performance trend
      const prediction = this.predictPerformanceTrend(performanceTrend);

      // Get recent assignments
      const assignments = await db.query(`
        SELECT 
          id, title, subject, due_date, status,
          (SELECT COUNT(*) FROM assignment_submissions WHERE assignment_id = a.id AND student_id = ?) as submitted
        FROM assignments a
        WHERE a.status = 'active'
        ORDER BY due_date ASC
        LIMIT 5
      `, [studentId]);

      const result = {
        student: {
          id: student.id,
          name: student.full_name,
          username: student.username,
          department: student.department,
          year: student.year,
          section: student.section
        },
        marks: {
          totalExams: marksStats.total_exams || 0,
          averagePercentage: parseFloat(marksStats.average_percentage || 0).toFixed(2),
          bestPercentage: parseFloat(marksStats.best_percentage || 0).toFixed(2),
          worstPercentage: parseFloat(marksStats.worst_percentage || 0).toFixed(2),
          excellentCount: marksStats.excellent_count || 0,
          failedCount: marksStats.failed_count || 0
        },
        subjectPerformance: subjectPerformance.map(s => ({
          subject: s.subject,
          examCount: s.exam_count,
          avgPercentage: parseFloat(s.avg_percentage).toFixed(2),
          bestPercentage: parseFloat(s.best_percentage).toFixed(2),
          worstPercentage: parseFloat(s.worst_percentage).toFixed(2),
          recentGrades: s.recent_grades ? s.recent_grades.split(',').slice(0, 3) : []
        })),
        classComparison: classAverages.map(s => ({
          subject: s.subject,
          studentAvg: parseFloat(s.student_avg).toFixed(2),
          classAvg: parseFloat(s.class_avg).toFixed(2),
          difference: parseFloat(s.student_avg - s.class_avg).toFixed(2),
          status: s.student_avg > s.class_avg ? 'above' : s.student_avg < s.class_avg ? 'below' : 'equal'
        })),
        weakSubjects,
        strongSubjects,
        attendance: attendanceStats,
        performanceTrend,
        prediction,
        recentAssignments: assignments.map(a => ({
          ...a,
          isSubmitted: a.submitted > 0,
          isOverdue: new Date(a.due_date) < new Date() && a.submitted === 0
        })),
        insights: this.generateInsights(marksStats, attendanceStats, weakSubjects, strongSubjects)
      };

      cacheService.set(cacheKey, result, 1800); // Cache for 30 minutes
      return result;
    } catch (error) {
      console.error('Error in getStudentPerformance:', error);
      throw error;
    }
  }

  /**
   * Detect attendance patterns and anomalies
   * @param {Object} filters - Filter criteria
   * @returns {Object} Attendance patterns
   */
  async getAttendancePatterns(filters = {}) {
    try {
      // Detect chronic absenteeism (attendance < 75%)
      const [chronicAbsentees] = await db.query(`
        SELECT 
          u.id, u.username, u.full_name, u.department, u.year, u.section,
          COUNT(*) as total_classes,
          SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) as present_count,
          (SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) / COUNT(*) * 100) as attendance_percentage
        FROM users u
        JOIN attendance a ON u.id = a.student_id
        WHERE u.role = 'student'
        ${filters.department ? 'AND u.department = ?' : ''}
        ${filters.year ? 'AND u.year = ?' : ''}
        ${filters.section ? 'AND u.section = ?' : ''}
        GROUP BY u.id
        HAVING attendance_percentage < 75
        ORDER BY attendance_percentage ASC
      `, Object.values(filters).filter(Boolean));

      // Detect proxy attendance patterns (suspicious patterns)
      const [suspiciousPatterns] = await db.query(`
        SELECT 
          student_id,
          u.username,
          u.full_name,
          DATE(date) as attendance_date,
          COUNT(*) as attendance_count,
          GROUP_CONCAT(DISTINCT marked_by) as marked_by_users
        FROM attendance a
        JOIN users u ON a.student_id = u.id
        WHERE a.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        GROUP BY student_id, DATE(date)
        HAVING attendance_count > 1
        ORDER BY attendance_count DESC
      `);

      // Find students with perfect attendance
      const [perfectAttendance] = await db.query(`
        SELECT 
          u.id, u.username, u.full_name, u.department, u.year, u.section,
          COUNT(*) as total_classes,
          SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) as present_count
        FROM users u
        JOIN attendance a ON u.id = a.student_id
        WHERE u.role = 'student'
        AND a.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        GROUP BY u.id
        HAVING present_count = total_classes AND total_classes > 10
        ORDER BY total_classes DESC
      `);

      // Attendance trends by day of week
      const [dayOfWeekTrends] = await db.query(`
        SELECT 
          DAYNAME(date) as day_of_week,
          COUNT(*) as total_classes,
          SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) as present_count,
          (SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) / COUNT(*) * 100) as attendance_rate
        FROM attendance
        WHERE date >= DATE_SUB(NOW(), INTERVAL 60 DAY)
        GROUP BY DAYNAME(date), DAYOFWEEK(date)
        ORDER BY DAYOFWEEK(date)
      `);

      // Subject-wise attendance
      const [subjectAttendance] = await db.query(`
        SELECT 
          subject,
          COUNT(*) as total_classes,
          SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) as present_count,
          (SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) / COUNT(*) * 100) as attendance_rate
        FROM attendance
        WHERE date >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        GROUP BY subject
        ORDER BY attendance_rate ASC
      `);

      return {
        chronicAbsentees: chronicAbsentees.map(s => ({
          ...s,
          attendance_percentage: parseFloat(s.attendance_percentage).toFixed(2)
        })),
        suspiciousPatterns,
        perfectAttendance,
        dayOfWeekTrends: dayOfWeekTrends.map(d => ({
          ...d,
          attendance_rate: parseFloat(d.attendance_rate).toFixed(2)
        })),
        subjectAttendance: subjectAttendance.map(s => ({
          ...s,
          attendance_rate: parseFloat(s.attendance_rate).toFixed(2)
        })),
        summary: {
          totalChronicAbsentees: chronicAbsentees.length,
          totalSuspiciousPatterns: suspiciousPatterns.length,
          totalPerfectAttendance: perfectAttendance.length,
          lowestAttendanceDay: dayOfWeekTrends.reduce((min, d) => 
            parseFloat(d.attendance_rate) < parseFloat(min.attendance_rate) ? d : min, 
            dayOfWeekTrends[0] || {}
          )?.day_of_week,
          lowestAttendanceSubject: subjectAttendance[0]?.subject
        }
      };
    } catch (error) {
      console.error('Error in getAttendancePatterns:', error);
      throw error;
      }
  }

  /**
   * Get teacher performance analytics
   * @param {number} teacherId - Teacher ID
   * @returns {Object} Teacher analytics
   */
  async getTeacherAnalytics(teacherId) {
    try {
      // Classes taught
  const classesTaught = await db.query(`
        SELECT 
          subject,
          COUNT(DISTINCT CONCAT(department, year, section)) as class_count,
          COUNT(DISTINCT student_id) as student_count,
          COUNT(*) as total_sessions
        FROM attendance
        WHERE marked_by = ?
        GROUP BY subject
      `, [teacherId]);

      // Attendance marking stats
  const attendanceStatsRows2 = await db.query(`
        SELECT 
          COUNT(*) as total_marked,
          COUNT(DISTINCT DATE(date)) as days_active,
          AVG(CASE WHEN status = 'present' THEN 1 ELSE 0 END) * 100 as avg_attendance_rate
        FROM attendance
        WHERE marked_by = ?
  `, [teacherId]);
  const attendanceStats = attendanceStatsRows2[0] || {};

      // Marks uploaded stats
  const marksStatsRows2 = await db.query(`
        SELECT 
          COUNT(*) as total_marks_uploaded,
          COUNT(DISTINCT subject) as subjects_taught,
          AVG(marks_obtained / total_marks * 100) as class_average
        FROM marks
        WHERE uploaded_by = ?
  `, [teacherId]);
  const marksStats = marksStatsRows2[0] || {};

      // Recent activity
  const recentActivity = await db.query(`
        (SELECT 'attendance' as type, subject, COUNT(*) as count, MAX(created_at) as last_activity
         FROM attendance WHERE marked_by = ? GROUP BY subject)
        UNION ALL
        (SELECT 'marks' as type, subject, COUNT(*) as count, MAX(created_at) as last_activity
         FROM marks WHERE uploaded_by = ? GROUP BY subject)
        ORDER BY last_activity DESC
        LIMIT 10
      `, [teacherId, teacherId]);

      return {
        classesTaught,
        attendanceStats,
        marksStats,
        recentActivity
      };
    } catch (error) {
      console.error('Error in getTeacherAnalytics:', error);
      throw error;
    }
  }

  /**
   * Predict performance trend using linear regression
   * @private
   */
  predictPerformanceTrend(data) {
    if (!data || data.length < 2) {
      return { trend: 'insufficient_data', prediction: null };
    }

    const n = data.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;

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

    // Predict next month
    const nextValue = slope * n + intercept;

    return {
      trend: slope > 0.5 ? 'improving' : slope < -0.5 ? 'declining' : 'stable',
      prediction: parseFloat(nextValue).toFixed(2),
      slope: parseFloat(slope).toFixed(2),
      confidence: Math.min(n / 6, 1) * 100 // Confidence increases with more data points
    };
  }

  /**
   * Generate insights based on analytics
   * @private
   */
  generateInsights(marksStats, attendanceStats, weakSubjects, strongSubjects) {
    const insights = [];

    // Performance insights
    const avgPercentage = parseFloat(marksStats.average_percentage || 0);
    if (avgPercentage >= 80) {
      insights.push({
        type: 'success',
        message: 'Excellent overall performance! Keep up the great work.'
      });
    } else if (avgPercentage >= 60) {
      insights.push({
        type: 'info',
        message: 'Good performance. Focus on weak subjects to improve further.'
      });
    } else {
      insights.push({
        type: 'warning',
        message: 'Performance needs improvement. Consider seeking help from teachers.'
      });
    }

    // Attendance insights
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

    // Weak subjects
    if (weakSubjects.length > 0) {
      insights.push({
        type: 'warning',
        message: `Need improvement in: ${weakSubjects.map(s => s.subject).join(', ')}`
      });
    }

    // Strong subjects
    if (strongSubjects.length > 0) {
      insights.push({
        type: 'success',
        message: `Performing well in: ${strongSubjects.map(s => s.subject).join(', ')}`
      });
    }

    return insights;
  }
}

module.exports = new AdvancedAnalyticsService();
