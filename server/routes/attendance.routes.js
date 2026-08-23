const express = require('express');
const router = express.Router();
const { authMiddleware, roleMiddleware } = require('../middleware/auth');
const { emitToClass } = require('../socket/socket');
const { varyStudentSnapshot } = require('../services/demoData.service');
const cacheService = require('../services/cache.service');
const {
  getPortalSnapshotForUser,
  buildAttendanceRouteData
} = require('../services/soa-data.service');
const {
  findOne,
  getRecord,
  createRecord,
  updateRecord,
  listRecords
} = require('../services/firebase-data.service');

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function buildAttendanceSummary(records = []) {
  const grouped = new Map();

  for (const record of records) {
    const subject = record.subject || 'General';
    if (!grouped.has(subject)) {
      grouped.set(subject, {
        subject,
        total_classes: 0,
        present_count: 0,
        percentage: 0
      });
    }

    const item = grouped.get(subject);
    item.total_classes += 1;
    if (record.status === 'present' || record.status === 'late') {
      item.present_count += 1;
    }
  }

  return Array.from(grouped.values()).map((item) => ({
    ...item,
    percentage: item.total_classes
      ? Number(((item.present_count * 100) / item.total_classes).toFixed(2))
      : 0
  }));
}

function sortAttendanceRecords(records = []) {
  return [...records].sort((left, right) => String(right.date || '').localeCompare(String(left.date || '')));
}

async function loadAttendanceData(studentId, useCache = true) {
  if (useCache) {
    const cached = await cacheService.getAttendance(studentId);
    if (cached) {
      return cached;
    }
  }

  const attendance = sortAttendanceRecords(await listRecords('attendance', {
    filters: [{ field: 'student_id', value: studentId }]
  }));

  let data;
  if (attendance.length > 0) {
    data = {
      records: attendance,
      summary: buildAttendanceSummary(attendance),
      source: 'firebase'
    };
  } else {
    const snapshot = await getPortalSnapshotForUser({ userId: studentId });
    const fallbackData = buildAttendanceRouteData(snapshot.normalizedData);
    data = fallbackData.summary.length
      ? fallbackData
      : { records: [], summary: [], source: 'none' };
  }

  await cacheService.setAttendance(studentId, data, null, 300);
  return data;
}

// Mark attendance
router.post('/mark', authMiddleware, roleMiddleware('teacher', 'admin'), async (req, res, next) => {
  try {
    const { student_id, subject, date, status, remarks } = req.body;
    const student = await getRecord('users', student_id);

    const payload = {
      student_id,
      subject,
      date,
      status,
      remarks: remarks || null,
      marked_by: req.user.id,
      department: student?.department || null,
      year: student?.year ?? null,
      section: student?.section || null
    };

    const existing = await findOne('attendance', {
      filters: [
        { field: 'student_id', value: student_id },
        { field: 'subject', value: subject },
        { field: 'date', value: date }
      ]
    });

    if (existing) {
      await updateRecord('attendance', existing.id, payload);
    } else {
      await createRecord('attendance', payload);
    }

    cacheService.invalidateAttendance(student_id);

    if (student?.department && student?.year && student?.section) {
      emitToClass(student.department, student.year, student.section, 'attendance:update', {
        student_id,
        subject,
        date,
        status
      });
    }

    res.json({ success: true, message: 'Attendance marked successfully' });
  } catch (error) {
    next(error);
  }
});

// Get student attendance
router.get('/student/:id', authMiddleware, async (req, res, next) => {
  try {
    const studentId = req.params.id;

    if (req.user.role === 'student' && studentId !== String(req.user.id) && studentId !== String(req.user.registration_number)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied - students can only view their own attendance'
      });
    }

    const data = await loadAttendanceData(studentId, !req.variationSeed);

    if (req.variationSeed) {
      const varied = varyStudentSnapshot({ summary: data.summary || [] }, req.variationSeed);
      return res.json({
        success: true,
        data: {
          records: data.records || [],
          summary: varied.summary || data.summary || [],
          source: data.source
        }
      });
    }

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// Get attendance summary for charts and visualizations
router.get('/summary', authMiddleware, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const allRecords = sortAttendanceRecords(await listRecords('attendance', {
      filters: [{ field: 'student_id', value: userId }]
    }));

    const twelveWeeksAgo = new Date();
    twelveWeeksAgo.setDate(twelveWeeksAgo.getDate() - 84);

    const heatmapData = allRecords
      .filter((record) => {
        const timestamp = Date.parse(record.date || '');
        return !Number.isNaN(timestamp) && timestamp >= twelveWeeksAgo.getTime();
      })
      .map((record) => {
        const date = new Date(record.date);
        return {
          date: record.date,
          dayOfWeek: date.getDay(),
          status: record.status
        };
      });

    const subjectWise = buildAttendanceSummary(allRecords)
      .map((item) => ({
        subject: item.subject,
        total: item.total_classes,
        present: item.present_count,
        absent: item.total_classes - item.present_count,
        percentage: item.percentage
      }))
      .sort((left, right) => left.percentage - right.percentage);

    const overall = {
      totalClasses: allRecords.length,
      present: allRecords.filter((record) => record.status === 'present' || record.status === 'late').length,
      absent: allRecords.filter((record) => record.status === 'absent').length
    };
    overall.percentage = overall.totalClasses
      ? Number(((overall.present * 100) / overall.totalClasses).toFixed(2))
      : 0;

    res.json({
      success: true,
      data: {
        heatmapData,
        subjectWise,
        overall
      }
    });
  } catch (error) {
    next(error);
  }
});

router.get('/bunk-plan', authMiddleware, async (req, res, next) => {
  try {
    const parsedThreshold = Number(req.query.threshold);
    const threshold = Number.isFinite(parsedThreshold)
      ? Math.min(100, Math.max(1, parsedThreshold))
      : 75;
    const ratio = threshold / 100;

    const data = await loadAttendanceData(String(req.user.id));
    const subjects = (data.summary || [])
      .filter((item) => item.total_classes > 0)
      .map((item) => {
        const attended = item.present_count;
        const total = item.total_classes;
        const canMiss = Math.max(0, Math.floor((attended / ratio) - total + 1e-9));
        const deficit = (ratio * total) - attended;
        const recoverNeeded = deficit <= 0
          ? 0
          : Math.ceil((deficit / (1 - ratio)) - 1e-9);

        return {
          subject: item.subject,
          attended,
          total,
          percentage: item.percentage,
          canMiss,
          recoverNeeded
        };
      });

    const totalAttended = subjects.reduce((sum, item) => sum + item.attended, 0);
    const totalClasses = subjects.reduce((sum, item) => sum + item.total, 0);
    const overallPercentage = totalClasses
      ? Number(((totalAttended * 100) / totalClasses).toFixed(2))
      : 0;

    res.json({
      success: true,
      threshold,
      subjects,
      overallPercentage
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
