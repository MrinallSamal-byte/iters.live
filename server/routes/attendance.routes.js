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
  listRecords,
  isValidDocId
} = require('../services/firebase-data.service');
const { normalizeDateOnly, isFutureDateOnly } = require('../utils/date.util');
const { alertThreshold, notifyIfBelowThreshold } = require('../services/attendance-alerts.service');

const VALID_STATUSES = ['present', 'absent', 'late'];
const MAX_BULK_RECORDS = 300;
const USER_LOOKUP_CHUNK = 30;

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

function normalizeStatus(status) {
  const value = typeof status === 'string' ? status.trim().toLowerCase() : '';
  return VALID_STATUSES.includes(value) ? value : null;
}

/**
 * Validate the fields shared by single and bulk marking.
 * Returns { error } or { subject, date }.
 */
function validateSessionFields(body) {
  const subject = typeof body.subject === 'string' ? body.subject.trim() : '';
  if (!subject || subject.length > 120) {
    return { error: 'subject is required (max 120 characters)' };
  }

  const date = normalizeDateOnly(body.date);
  if (!date) {
    return { error: 'date must be a valid date' };
  }
  if (isFutureDateOnly(date)) {
    return { error: 'date cannot be in the future' };
  }

  return { subject, date };
}

/**
 * Create or update one attendance row; returns the previous status (or null).
 */
async function upsertAttendance(student, subject, date, status, remarks, markedBy, existing) {
  const payload = {
    student_id: student.id,
    subject,
    date,
    status,
    remarks: remarks || null,
    marked_by: markedBy,
    department: student.department || null,
    year: student.year ?? null,
    section: student.section || null
  };

  if (existing) {
    await updateRecord('attendance', existing.id, payload);
    return existing.status || null;
  }

  await createRecord('attendance', payload);
  return null;
}

async function afterAttendanceChange(student, { subject, date, status, previousStatus }) {
  cacheService.invalidateAttendance(student.id);

  await notifyIfBelowThreshold({
    studentId: student.id,
    subject,
    date,
    status,
    previousStatus
  });
}

async function invalidateAnalyticsQuietly() {
  try {
    await cacheService.invalidateAnalytics();
  } catch (error) {
    console.warn('Analytics cache invalidation failed:', error.message);
  }
}

// Mark attendance
router.post('/mark', authMiddleware, roleMiddleware('teacher', 'admin'), async (req, res, next) => {
  try {
    const { student_id, remarks } = req.body;

    const status = normalizeStatus(req.body.status);
    if (!status) {
      return res.status(400).json({
        success: false,
        message: `Invalid attendance status. Valid values are: ${VALID_STATUSES.join(', ')}`
      });
    }

    const session = validateSessionFields(req.body);
    if (session.error) {
      return res.status(400).json({ success: false, message: session.error });
    }
    const { subject, date } = session;

    if (!student_id || !isValidDocId(student_id)) {
      return res.status(400).json({
        success: false,
        message: 'student_id is required'
      });
    }

    const student = await getRecord('users', student_id);
    if (!student || student.role !== 'student') {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    const existing = await findOne('attendance', {
      filters: [
        { field: 'student_id', value: student.id },
        { field: 'subject', value: subject },
        { field: 'date', value: date }
      ]
    });

    const previousStatus = await upsertAttendance(student, subject, date, status, remarks, req.user.id, existing);
    await afterAttendanceChange(student, { subject, date, status, previousStatus });
    await invalidateAnalyticsQuietly();

    if (student.department && student.year && student.section) {
      emitToClass(student.department, student.year, student.section, 'attendance:update', {
        student_id: student.id,
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

// Mark a whole class session in one request
router.post('/mark-bulk', authMiddleware, roleMiddleware('teacher', 'admin'), async (req, res, next) => {
  try {
    const session = validateSessionFields(req.body);
    if (session.error) {
      return res.status(400).json({ success: false, message: session.error });
    }
    const { subject, date } = session;

    const records = req.body.records;
    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ success: false, message: 'records must be a non-empty array' });
    }
    if (records.length > MAX_BULK_RECORDS) {
      return res.status(400).json({
        success: false,
        message: `A single request can mark at most ${MAX_BULK_RECORDS} students`
      });
    }

    const defaultStatus = req.body.defaultStatus === undefined ? null : normalizeStatus(req.body.defaultStatus);
    if (req.body.defaultStatus !== undefined && !defaultStatus) {
      return res.status(400).json({
        success: false,
        message: `Invalid defaultStatus. Valid values are: ${VALID_STATUSES.join(', ')}`
      });
    }

    // Last entry wins if a student is listed twice.
    const requested = new Map();
    const rejected = [];
    for (const entry of records) {
      const studentId = entry && entry.student_id !== undefined ? String(entry.student_id) : '';
      const status = normalizeStatus(entry?.status) || defaultStatus;
      if (!isValidDocId(studentId)) {
        rejected.push({ student_id: studentId || null, error: 'student_id is required' });
      } else if (!status) {
        rejected.push({ student_id: studentId, error: `status must be one of ${VALID_STATUSES.join(', ')}` });
      } else {
        requested.set(studentId, { status, remarks: entry.remarks });
      }
    }

    const ids = Array.from(requested.keys());
    const students = new Map();
    for (let index = 0; index < ids.length; index += USER_LOOKUP_CHUNK) {
      const chunk = ids.slice(index, index + USER_LOOKUP_CHUNK);
      const found = await listRecords('users', { filters: [{ field: 'id', op: 'in', value: chunk }] });
      found.forEach((user) => students.set(user.id, user));
    }

    // One query for the whole session instead of one per student.
    const existingRows = await listRecords('attendance', {
      filters: [
        { field: 'subject', value: subject },
        { field: 'date', value: date }
      ]
    });
    const existingByStudent = new Map(existingRows.map((row) => [row.student_id, row]));

    let marked = 0;
    for (const [studentId, { status, remarks }] of requested) {
      const student = students.get(studentId);
      if (!student || student.role !== 'student') {
        rejected.push({ student_id: studentId, error: 'Student not found' });
        continue;
      }

      try {
        const previousStatus = await upsertAttendance(
          student, subject, date, status, remarks, req.user.id, existingByStudent.get(student.id)
        );
        await afterAttendanceChange(student, { subject, date, status, previousStatus });
        if (student.department && student.year && student.section) {
          emitToClass(student.department, student.year, student.section, 'attendance:update', {
            student_id: student.id,
            subject,
            date,
            status
          });
        }
        marked += 1;
      } catch (error) {
        rejected.push({ student_id: studentId, error: error.message });
      }
    }

    await invalidateAnalyticsQuietly();

    const httpStatus = marked === 0 ? 400 : 200;
    res.status(httpStatus).json({
      success: marked > 0,
      message: `Marked ${marked} of ${marked + rejected.length} students`,
      data: { subject, date, marked, rejected }
    });
  } catch (error) {
    next(error);
  }
});

// Students below the attendance requirement (teacher / admin)
router.get('/at-risk', authMiddleware, roleMiddleware('teacher', 'admin'), async (req, res, next) => {
  try {
    const parsedThreshold = Number(req.query.threshold);
    const threshold = req.query.threshold !== undefined && Number.isFinite(parsedThreshold)
      ? Math.min(100, Math.max(1, parsedThreshold))
      : alertThreshold();

    const department = req.query.department || req.user.department;
    if (!department) {
      return res.status(400).json({
        success: false,
        message: 'department is required (your account has no default department)'
      });
    }

    const filters = [{ field: 'department', value: String(department) }];
    if (req.query.year !== undefined && req.query.year !== '') {
      const year = Number(req.query.year);
      if (!Number.isInteger(year)) {
        return res.status(400).json({ success: false, message: 'year must be a whole number' });
      }
      filters.push({ field: 'year', value: year });
    }
    if (req.query.section) filters.push({ field: 'section', value: String(req.query.section) });
    if (req.query.subject) filters.push({ field: 'subject', value: String(req.query.subject) });

    const records = await listRecords('attendance', { filters });

    const byStudent = new Map();
    for (const record of records) {
      if (!record.student_id) continue;
      const subjects = byStudent.get(record.student_id) || new Map();
      const item = subjects.get(record.subject || 'General') || { attended: 0, total: 0 };
      item.total += 1;
      if (record.status === 'present' || record.status === 'late') item.attended += 1;
      subjects.set(record.subject || 'General', item);
      byStudent.set(record.student_id, subjects);
    }

    const flagged = [];
    for (const [studentId, subjects] of byStudent) {
      const lowSubjects = [];
      let attended = 0;
      let total = 0;
      for (const [subject, item] of subjects) {
        attended += item.attended;
        total += item.total;
        const percent = (item.attended * 100) / item.total;
        if (percent < threshold) {
          lowSubjects.push({
            subject,
            attended: item.attended,
            total: item.total,
            percentage: Number(percent.toFixed(2))
          });
        }
      }
      if (lowSubjects.length > 0) {
        flagged.push({
          student_id: studentId,
          overallPercentage: Number(((attended * 100) / total).toFixed(2)),
          subjects: lowSubjects.sort((left, right) => left.percentage - right.percentage)
        });
      }
    }

    // Attach names with chunked `in` lookups instead of reading every user.
    const names = new Map();
    const flaggedIds = flagged.map((item) => item.student_id);
    for (let index = 0; index < flaggedIds.length; index += USER_LOOKUP_CHUNK) {
      const chunk = flaggedIds.slice(index, index + USER_LOOKUP_CHUNK);
      const users = await listRecords('users', { filters: [{ field: 'id', op: 'in', value: chunk }] });
      users.forEach((user) => names.set(user.id, user));
    }

    const students = flagged
      .map((item) => ({
        ...item,
        name: names.get(item.student_id)?.name || null,
        registration_number: names.get(item.student_id)?.registration_number || item.student_id
      }))
      .sort((left, right) => left.overallPercentage - right.overallPercentage);

    res.json({ success: true, threshold, count: students.length, students });
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

    if (!isValidDocId(studentId)) {
      return res.status(400).json({ success: false, message: 'Invalid student id' });
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
          // Dates are calendar days (UTC midnight): read the weekday in UTC too
          dayOfWeek: date.getUTCDay(),
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
        // At a 100% requirement a missed class can never be recovered
        // (the 1 / (1 - ratio) term would be infinite), so report null.
        let recoverNeeded;
        if (deficit <= 1e-9) {
          recoverNeeded = 0;
        } else if (ratio >= 1) {
          recoverNeeded = null;
        } else {
          recoverNeeded = Math.ceil((deficit / (1 - ratio)) - 1e-9);
        }

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
