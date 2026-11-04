const express = require('express');
const router = express.Router();
const { varyStudentSnapshot } = require('../services/demoData.service');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');
const cacheService = require('../services/cache.service');
const {
  getPortalSnapshotForUser,
  buildMarksRouteData
} = require('../services/soa-data.service');
const {
  findOne,
  getRecord,
  createRecord,
  updateRecord,
  deleteRecord,
  listRecords,
  isValidDocId
} = require('../services/firebase-data.service');
const { emitToUser } = require('../socket/socket');
const notificationService = require('../services/notification.service');
const { recordAudit } = require('../services/audit.service');
const { normalizeDateOnly, isFutureDateOnly } = require('../utils/date.util');

const IN_QUERY_CHUNK = 30;

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * True when the number has at most one decimal place. Shared by the upload and
 * correction endpoints so both apply exactly the same rule (rounding to 1e-6
 * absorbs floating-point noise from values that were computed, not typed).
 */
function hasAtMostOneDecimal(value) {
  return Number.isInteger(Math.round(value * 10 * 1e6) / 1e6);
}

function sortMarks(records = []) {
  return [...records].sort((left, right) => String(right.exam_date || '').localeCompare(String(left.exam_date || '')));
}

function buildMarksSummary(records = []) {
  const grouped = new Map();

  for (const record of records) {
    const key = `${record.subject || 'General'}::${record.exam_type || 'Exam'}`;
    if (!grouped.has(key)) {
      grouped.set(key, {
        subject: record.subject || 'General',
        exam_type: record.exam_type || 'Exam',
        total_marks_sum: 0,
        marks_sum: 0,
        count: 0
      });
    }

    const item = grouped.get(key);
    item.total_marks_sum += toNumber(record.total_marks, 0);
    item.marks_sum += toNumber(record.marks_obtained, 0);
    item.count += 1;
  }

  return Array.from(grouped.values()).map((item) => ({
    subject: item.subject,
    exam_type: item.exam_type,
    avg_marks: item.count ? Number((item.marks_sum / item.count).toFixed(2)) : 0,
    avg_total: item.count ? Number((item.total_marks_sum / item.count).toFixed(2)) : 0
  }));
}

function buildSemesterData(records = []) {
  const grouped = new Map();

  for (const record of records) {
    const semester = record.semester || 'Unknown';
    if (!grouped.has(semester)) {
      grouped.set(semester, {
        semester,
        scoreSum: 0,
        count: 0,
        subjects: new Set()
      });
    }

    const item = grouped.get(semester);
    const total = toNumber(record.total_marks, 0);
    if (total > 0) {
      item.scoreSum += (toNumber(record.marks_obtained, 0) / total) * 10;
      item.count += 1;
    }
    if (record.subject) {
      item.subjects.add(record.subject);
    }
  }

  return Array.from(grouped.values())
    .filter((item) => item.count > 0)
    .map((item) => ({
      semester: item.semester,
      sgpa: Number((item.scoreSum / item.count).toFixed(2)),
      credits: item.subjects.size
    }))
    .sort((left, right) => String(left.semester).localeCompare(String(right.semester), undefined, { numeric: true }));
}

function calculateCgpa(records = []) {
  const eligible = records.filter((record) => toNumber(record.total_marks, 0) > 0);
  if (eligible.length === 0) return null;

  const sum = eligible.reduce((total, record) => {
    return total + ((toNumber(record.marks_obtained, 0) / toNumber(record.total_marks, 0)) * 10);
  }, 0);

  return Number((sum / eligible.length).toFixed(2));
}

async function loadStudentMarks(studentId) {
  const marks = sortMarks(await listRecords('marks', {
    filters: [{ field: 'student_id', value: studentId }]
  }));

  if (marks.length > 0) {
    return marks;
  }

  const snapshot = await getPortalSnapshotForUser({ userId: studentId });
  const fallbackData = buildMarksRouteData(snapshot.normalizedData);
  return fallbackData.marks || [];
}

function gradePointOf(record) {
  const total = toNumber(record.total_marks, 0);
  if (!(total > 0)) return null;
  return (toNumber(record.marks_obtained, 0) / total) * 10;
}

function creditsOf(record) {
  const parsed = Number(record.credits);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

async function invalidateMarksCaches(studentId) {
  cacheService.invalidateMarks(studentId);
  try {
    await cacheService.invalidateAnalytics();
  } catch (error) {
    console.warn('Analytics cache invalidation failed:', error.message);
  }
}

/** Fetch documents by id in `in` chunks into a Map keyed by id. */
async function loadByIds(collection, ids) {
  const found = new Map();
  const unique = Array.from(new Set(ids.filter(Boolean).map(String)));
  for (let index = 0; index < unique.length; index += IN_QUERY_CHUNK) {
    const rows = await listRecords(collection, {
      filters: [{ field: 'id', op: 'in', value: unique.slice(index, index + IN_QUERY_CHUNK) }]
    });
    rows.forEach((row) => found.set(String(row.id), row));
  }
  return found;
}

/**
 * Marks of the student's classmates for the given subjects. Scoped by subject
 * (and department when known) instead of downloading every mark in the system.
 */
async function loadClassMarks(subjects, user) {
  const uniqueSubjects = Array.from(new Set(subjects.filter(Boolean)));
  const marks = [];

  for (let index = 0; index < uniqueSubjects.length; index += IN_QUERY_CHUNK) {
    const filters = [{ field: 'subject', op: 'in', value: uniqueSubjects.slice(index, index + IN_QUERY_CHUNK) }];
    if (user.department) filters.push({ field: 'department', value: user.department });
    marks.push(...await listRecords('marks', { filters }));
  }

  return marks;
}

router.get('/projection', authMiddleware, async (req, res, next) => {
  try {
    const targetCgpa = Number(req.query.target);
    if (!Number.isFinite(targetCgpa) || targetCgpa < 0 || targetCgpa > 10) {
      return res.status(400).json({ success: false, message: 'target must be a number between 0 and 10' });
    }

    const completedCreditsOverride = Number(req.query.completedCredits);
    const totalCreditsOverride = Number(req.query.totalCredits);

    const records = await loadStudentMarks(String(req.user.id));
    const withPoints = records.filter((record) => gradePointOf(record) !== null);
    if (withPoints.length === 0) {
      return res.json({ success: false, message: 'Credit information unavailable for projection' });
    }

    const creditRecords = withPoints.filter((record) => creditsOf(record) !== null);
    let currentCgpa;
    let completedCredits;
    let creditWeighted = false;
    let averageSemesterCredits = null;

    if (creditRecords.length > 0) {
      const semesters = new Map();
      for (const record of creditRecords) {
        const semester = record.semester || 'Unknown';
        if (!semesters.has(semester)) {
          semesters.set(semester, { qualityPoints: 0, credits: 0 });
        }
        const item = semesters.get(semester);
        const credits = creditsOf(record);
        item.qualityPoints += gradePointOf(record) * credits;
        item.credits += credits;
      }

      const items = Array.from(semesters.values());
      const qualityPoints = items.reduce((sum, item) => sum + item.qualityPoints, 0);
      completedCredits = items.reduce((sum, item) => sum + item.credits, 0);
      currentCgpa = Number((qualityPoints / completedCredits).toFixed(2));
      creditWeighted = true;
      averageSemesterCredits = completedCredits / items.length;
    } else {
      currentCgpa = calculateCgpa(withPoints);
      completedCredits = Number.isFinite(completedCreditsOverride) && completedCreditsOverride > 0
        ? completedCreditsOverride
        : null;
    }

    if (Number.isFinite(completedCreditsOverride) && completedCreditsOverride > 0) {
      completedCredits = completedCreditsOverride;
    }
    if (!creditWeighted && completedCredits === null) {
      return res.json({ success: false, message: 'Credit information unavailable for projection' });
    }

    const response = {
      success: true,
      currentCgpa,
      targetCgpa,
      feasible: true,
      creditWeighted,
      completedCredits,
      creditBasis: creditWeighted ? 'payload_credits' : 'query_override'
    };

    let futureCredits;
    if (Number.isFinite(totalCreditsOverride) && totalCreditsOverride > completedCredits) {
      futureCredits = totalCreditsOverride - completedCredits;
      response.totalCreditsProjected = completedCredits + futureCredits;
      if (creditWeighted && averageSemesterCredits > 0) {
        response.semestersRemaining = Math.ceil(futureCredits / averageSemesterCredits);
      }
    } else if (creditWeighted && averageSemesterCredits > 0) {
      futureCredits = averageSemesterCredits;
      response.semestersRemaining = 1;
      response.assumedFutureCredits = Number(futureCredits.toFixed(2));
    } else {
      return res.json({ success: false, message: 'Credit information unavailable for projection' });
    }

    const projectedTotal = completedCredits + futureCredits;
    const requiredRaw = ((projectedTotal * targetCgpa) - (currentCgpa * completedCredits)) / futureCredits;
    response.requiredAverageSgpa = Number(Math.max(0, requiredRaw).toFixed(2));
    response.feasible = requiredRaw <= 10;

    res.json(response);
  } catch (error) {
    next(error);
  }
});

// Upload marks
router.post('/upload', authMiddleware, roleMiddleware('teacher', 'admin'), async (req, res, next) => {
  try {
    const {
      student_id,
      subject,
      exam_type,
      marks_obtained,
      total_marks,
      exam_date,
      remarks,
      semester
    } = req.body;

    // --- Validation ---
    if (!student_id || !subject || !exam_type) {
      return res.status(400).json({
        success: false,
        message: 'student_id, subject, and exam_type are required'
      });
    }

    const parsedMarks = toNumber(marks_obtained, NaN);
    const parsedTotal = toNumber(total_marks, NaN);

    if (!Number.isFinite(parsedTotal) || !Number.isInteger(parsedTotal) || parsedTotal < 1) {
      return res.status(400).json({
        success: false,
        message: 'total_marks must be an integer greater than or equal to 1'
      });
    }

    const marksIsValid = Number.isFinite(parsedMarks)
      && parsedMarks >= 0
      && parsedMarks <= parsedTotal
      && hasAtMostOneDecimal(parsedMarks);
    if (!marksIsValid) {
      return res.status(400).json({
        success: false,
        message: 'marks_obtained must be a number between 0 and total_marks, with at most one decimal place'
      });
    }

    const normalizedDate = exam_date !== undefined ? normalizeDateOnly(exam_date) : normalizeDateOnly(new Date());
    if (!normalizedDate) {
      return res.status(400).json({
        success: false,
        message: 'exam_date must be a valid date'
      });
    }
    if (isFutureDateOnly(normalizedDate)) {
      return res.status(400).json({
        success: false,
        message: 'exam_date cannot be in the future'
      });
    }

    if (!isValidDocId(student_id)) {
      return res.status(400).json({ success: false, message: 'student_id is invalid' });
    }

    const student = await getRecord('users', student_id);
    if (!student || student.role !== 'student') {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }
    const duplicate = await findOne('marks', {
      filters: [
        { field: 'student_id', value: student_id },
        { field: 'subject', value: subject },
        { field: 'exam_type', value: exam_type },
        { field: 'exam_date', value: normalizedDate }
      ]
    });
    if (duplicate) {
      return res.status(409).json({
        success: false,
        message: `A record for this student already exists for ${subject} (${exam_type}) on ${normalizedDate}`
      });
    }

    const record = await createRecord('marks', {
      student_id: student.id,
      subject,
      exam_type,
      marks_obtained: parsedMarks,
      total_marks: parsedTotal,
      exam_date: normalizedDate,
      semester: semester ?? student?.semester ?? null,
      uploaded_by: req.user.id,
      remarks: remarks || null,
      department: student?.department || null,
      year: student?.year ?? null,
      section: student?.section || null
    });

    await invalidateMarksCaches(student.id);
    emitToUser(student.id, 'marks:update', { student_id: student.id, id: record.id });
    await recordAudit(req, {
      action: 'marks_upload',
      entityType: 'marks',
      entityId: record.id,
      summary: `${subject} ${exam_type}: ${parsedMarks}/${parsedTotal} for ${student.registration_number || student.id}`,
      metadata: { student_id: student.id, subject, exam_type, marks_obtained: parsedMarks, total_marks: parsedTotal }
    });

    await notificationService.create({
      userId: student.id,
      title: 'Marks Updated',
      message: `${subject} ${exam_type} marks were uploaded.`,
      type: 'marks',
      link: '/dashboard/student-marks.html',
      metadata: {
        subject,
        exam_type,
        marks_obtained: record.marks_obtained,
        total_marks: record.total_marks
      }
    });

    res.json({
      success: true,
      message: 'Marks uploaded successfully',
      data: { id: record.id }
    });
  } catch (error) {
    next(error);
  }
});

// Bulk upload marks for an entire class
router.post('/upload-bulk', authMiddleware, roleMiddleware('teacher', 'admin'), async (req, res, next) => {
  try {
    const {
      subject,
      exam_type,
      total_marks,
      exam_date,
      semester,
      records
    } = req.body || {};

    if (!subject || typeof subject !== 'string' || !subject.trim()) {
      return res.status(400).json({ success: false, message: 'subject is required' });
    }
    if (!exam_type || typeof exam_type !== 'string' || !exam_type.trim()) {
      return res.status(400).json({ success: false, message: 'exam_type is required' });
    }

    const parsedTotal = toNumber(total_marks, NaN);
    if (!Number.isFinite(parsedTotal) || !Number.isInteger(parsedTotal) || parsedTotal < 1) {
      return res.status(400).json({
        success: false,
        message: 'total_marks must be an integer greater than or equal to 1'
      });
    }

    const normalizedDate = exam_date !== undefined ? normalizeDateOnly(exam_date) : normalizeDateOnly(new Date());
    if (!normalizedDate) {
      return res.status(400).json({ success: false, message: 'exam_date must be a valid date' });
    }
    if (isFutureDateOnly(normalizedDate)) {
      return res.status(400).json({ success: false, message: 'exam_date cannot be in the future' });
    }

    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ success: false, message: 'records array is required' });
    }
    if (records.length > 200) {
      return res.status(400).json({ success: false, message: 'A single bulk upload cannot exceed 200 records' });
    }

    let marked = 0;
    const rejected = [];
    const affectedStudents = new Set();

    // Pre-fetch the batch's students and their existing marks for this exam so
    // the loop below does Map lookups instead of two reads per record.
    const studentIds = Array.from(new Set(records
      .filter((item) => item && isValidDocId(item.student_id))
      .map((item) => String(item.student_id))));
    const studentsById = await loadByIds('users', studentIds);

    const existingByStudentId = new Map();
    for (let index = 0; index < studentIds.length; index += IN_QUERY_CHUNK) {
      const rows = await listRecords('marks', {
        filters: [
          { field: 'student_id', op: 'in', value: studentIds.slice(index, index + IN_QUERY_CHUNK) },
          { field: 'subject', value: subject.trim() },
          { field: 'exam_type', value: exam_type.trim() },
          { field: 'exam_date', value: normalizedDate }
        ]
      });
      rows.forEach((row) => existingByStudentId.set(String(row.student_id), row));
    }

    for (const item of records) {
      if (!item || !isValidDocId(item.student_id)) {
        rejected.push({ student_id: item?.student_id, error: 'invalid student_id' });
        continue;
      }

      const parsedMarks = toNumber(item.marks_obtained, NaN);
      const marksIsValid = Number.isFinite(parsedMarks)
        && parsedMarks >= 0
        && parsedMarks <= parsedTotal
        && hasAtMostOneDecimal(parsedMarks);
      if (!marksIsValid) {
        rejected.push({ student_id: item.student_id, error: 'invalid marks_obtained' });
        continue;
      }

      const student = studentsById.get(String(item.student_id));
      if (!student || student.role !== 'student') {
        rejected.push({ student_id: item.student_id, error: 'student not found' });
        continue;
      }

      const existing = existingByStudentId.get(student.id);

      const payload = {
        student_id: student.id,
        subject: subject.trim(),
        exam_type: exam_type.trim(),
        marks_obtained: parsedMarks,
        total_marks: parsedTotal,
        exam_date: normalizedDate,
        semester: semester ?? student?.semester ?? null,
        remarks: item.remarks || null,
        department: student?.department || null,
        year: student?.year ?? null,
        section: student?.section || null
      };

      if (existing) {
        const updated = await updateRecord('marks', existing.id, {
          ...payload,
          updated_by: req.user.id
        });
        // Duplicate rows for the same student in one payload must keep
        // updating that record instead of creating a second one.
        existingByStudentId.set(student.id, updated);
      } else {
        const created = await createRecord('marks', {
          ...payload,
          uploaded_by: req.user.id
        });
        existingByStudentId.set(student.id, created);
      }

      affectedStudents.add(student.id);
      marked++;
    }

    for (const studentId of affectedStudents) {
      await invalidateMarksCaches(studentId);
      emitToUser(studentId, 'marks:update', { student_id: studentId });
      await notificationService.create({
        userId: studentId,
        title: 'Marks Updated',
        message: `${subject.trim()} ${exam_type.trim()} marks were uploaded.`,
        type: 'marks',
        link: '/dashboard/student-marks.html',
        metadata: { subject: subject.trim(), exam_type: exam_type.trim() }
      }).catch(() => {});
    }

    await recordAudit(req, {
      action: 'marks_upload_bulk',
      entityType: 'marks',
      summary: `${subject} (${exam_type}): ${marked} marked, ${rejected.length} rejected`,
      metadata: { subject, exam_type, total_marks: parsedTotal, exam_date: normalizedDate, marked, rejectedCount: rejected.length }
    });

    res.json({
      success: true,
      message: `Uploaded marks for ${marked} student${marked === 1 ? '' : 's'}`,
      data: { marked, rejected }
    });
  } catch (error) {
    next(error);
  }
});

// Get student marks
router.get('/student/:id', authMiddleware, async (req, res, next) => {
  try {
    const studentId = req.params.id;

    if (req.user.role === 'student' && studentId !== String(req.user.id) && studentId !== String(req.user.registration_number)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied - students can only view their own marks'
      });
    }

    if (!isValidDocId(studentId)) {
      return res.status(400).json({ success: false, message: 'Invalid student id' });
    }

    const cached = await cacheService.getMarks(studentId);
    if (cached && !req.variationSeed) {
      return res.json({ success: true, data: cached });
    }

    const marks = sortMarks(await listRecords('marks', {
      filters: [{ field: 'student_id', value: studentId }]
    }));

    let data;
    if (marks.length > 0) {
      data = {
        marks,
        summary: buildMarksSummary(marks),
        semesterResults: buildSemesterData(marks),
        cgpa: calculateCgpa(marks),
        source: 'firebase'
      };
    } else {
      const snapshot = await getPortalSnapshotForUser({ userId: studentId });
      const fallbackData = buildMarksRouteData(snapshot.normalizedData);
      data = fallbackData.summary.length
        ? fallbackData
        : { marks: [], summary: [], cgpa: null, semesterResults: [], source: 'none' };
    }

    await cacheService.setMarks(studentId, data, null, 300);

    if (req.variationSeed) {
      const varied = varyStudentSnapshot({
        marks: data.marks || [],
        summary: data.summary || []
      }, req.variationSeed);
      return res.json({
        success: true,
        data: {
          marks: varied.marks || data.marks || [],
          summary: varied.summary || data.summary || [],
          cgpa: data.cgpa ?? null,
          semesterResults: data.semesterResults || [],
          source: data.source
        }
      });
    }

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// Get marks summary for charts and visualizations
router.get('/summary', authMiddleware, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const studentRecords = await listRecords('marks', {
      filters: [{ field: 'student_id', value: userId }]
    });
    const allMarks = await loadClassMarks(studentRecords.map((record) => record.subject), req.user);
    const records = sortMarks(studentRecords);

    const trendData = records.slice(0, 10).map((record) => {
      const similar = allMarks.filter((item) => item.exam_type === record.exam_type && item.subject === record.subject);
      const classAverage = similar.length
        ? similar.reduce((sum, item) => sum + toNumber(item.marks_obtained, 0), 0) / similar.length
        : toNumber(record.marks_obtained, 0);

      return {
        examName: `${record.exam_type} - ${record.subject}`,
        marksObtained: toNumber(record.marks_obtained, 0),
        classAverage: Number(classAverage.toFixed(2)),
        exam_date: record.exam_date
      };
    });

    const groupedBySubject = new Map();
    for (const record of records) {
      const subject = record.subject || 'General';
      if (!groupedBySubject.has(subject)) {
        groupedBySubject.set(subject, []);
      }
      groupedBySubject.get(subject).push(record);
    }

    const subjectMarks = Array.from(groupedBySubject.entries()).map(([subject, items]) => ({
      subject,
      marks: Number((items.reduce((sum, item) => {
        const total = toNumber(item.total_marks, 0);
        return sum + (total ? ((toNumber(item.marks_obtained, 0) / total) * 100) : 0);
      }, 0) / items.length).toFixed(2))
    }));

    const classAverage = subjectMarks.map((own) => {
      const similar = allMarks.filter((item) => item.subject === own.subject);
      const average = similar.length
        ? Number((similar.reduce((sum, item) => {
          const total = toNumber(item.total_marks, 0);
          return sum + (total ? ((toNumber(item.marks_obtained, 0) / total) * 100) : 0);
        }, 0) / similar.length).toFixed(2))
        : own.marks;

      return {
        subject: own.subject,
        marks: average
      };
    });

    const studentPercentages = records
      .filter((record) => toNumber(record.total_marks, 0) > 0)
      .map((record) => ({
        percentage: (toNumber(record.marks_obtained, 0) / toNumber(record.total_marks, 0)) * 100
      }));

    const gradeDistribution = [
      { grade: 'A (90-100)', count: studentPercentages.filter((item) => item.percentage >= 90).length },
      { grade: 'B (80-89)', count: studentPercentages.filter((item) => item.percentage >= 80 && item.percentage < 90).length },
      { grade: 'C (70-79)', count: studentPercentages.filter((item) => item.percentage >= 70 && item.percentage < 80).length },
      { grade: 'D (60-69)', count: studentPercentages.filter((item) => item.percentage >= 60 && item.percentage < 70).length },
      { grade: 'F (<60)', count: studentPercentages.filter((item) => item.percentage < 60).length }
    ];

    res.json({
      success: true,
      data: {
        trendData,
        subjectMarks,
        classAverage,
        gradeDistribution,
        semesterData: buildSemesterData(records),
        cgpa: calculateCgpa(records) || 0
      }
    });
  } catch (error) {
    next(error);
  }
});

// Correct a marks entry
router.put('/:id', authMiddleware, roleMiddleware('teacher', 'admin'), async (req, res, next) => {
  try {
    const existing = await getRecord('marks', req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Marks record not found' });
    }

    const updates = {};
    const body = req.body || {};

    const subject = body.subject !== undefined ? String(body.subject).trim() : existing.subject;
    const examType = body.exam_type !== undefined ? String(body.exam_type).trim() : existing.exam_type;
    if (!subject || !examType) {
      return res.status(400).json({ success: false, message: 'subject and exam_type cannot be empty' });
    }
    updates.subject = subject;
    updates.exam_type = examType;

    const totalMarks = body.total_marks !== undefined ? toNumber(body.total_marks, NaN) : toNumber(existing.total_marks, NaN);
    if (!Number.isInteger(totalMarks) || totalMarks < 1) {
      return res.status(400).json({ success: false, message: 'total_marks must be an integer greater than or equal to 1' });
    }
    updates.total_marks = totalMarks;

    const marksObtained = body.marks_obtained !== undefined ? toNumber(body.marks_obtained, NaN) : toNumber(existing.marks_obtained, NaN);
    const marksAreValid = Number.isFinite(marksObtained)
      && marksObtained >= 0
      && marksObtained <= totalMarks
      && hasAtMostOneDecimal(marksObtained);
    if (!marksAreValid) {
      return res.status(400).json({
        success: false,
        message: 'marks_obtained must be a number between 0 and total_marks, with at most one decimal place'
      });
    }
    updates.marks_obtained = marksObtained;

    let examDate = existing.exam_date;
    if (body.exam_date !== undefined) {
      examDate = normalizeDateOnly(body.exam_date);
      if (!examDate) {
        return res.status(400).json({ success: false, message: 'exam_date must be a valid date' });
      }
      if (isFutureDateOnly(examDate)) {
        return res.status(400).json({ success: false, message: 'exam_date cannot be in the future' });
      }
    }
    updates.exam_date = examDate;

    if (body.remarks !== undefined) updates.remarks = body.remarks ? String(body.remarks) : null;
    if (body.semester !== undefined) updates.semester = body.semester || null;

    // The (student, subject, exam type, date) combination must stay unique.
    const duplicate = await findOne('marks', {
      filters: [
        { field: 'student_id', value: existing.student_id },
        { field: 'subject', value: subject },
        { field: 'exam_type', value: examType },
        { field: 'exam_date', value: examDate }
      ]
    });
    if (duplicate && duplicate.id !== existing.id) {
      return res.status(409).json({
        success: false,
        message: `A record for this student already exists for ${subject} (${examType}) on ${examDate}`
      });
    }

    updates.updated_by = req.user.id;
    await updateRecord('marks', existing.id, updates);
    await invalidateMarksCaches(existing.student_id);
    emitToUser(existing.student_id, 'marks:update', { student_id: existing.student_id, id: existing.id });

    await recordAudit(req, {
      action: 'marks_update',
      entityType: 'marks',
      entityId: existing.id,
      summary: `${subject} ${examType}: ${existing.marks_obtained}/${existing.total_marks} -> ${marksObtained}/${totalMarks}`,
      metadata: {
        student_id: existing.student_id,
        before: { marks_obtained: existing.marks_obtained, total_marks: existing.total_marks },
        after: { marks_obtained: marksObtained, total_marks: totalMarks }
      }
    });

    await notificationService.create({
      userId: existing.student_id,
      title: 'Marks Corrected',
      message: `${subject} ${examType} marks were corrected.`,
      type: 'marks',
      link: '/dashboard/student-marks.html',
      metadata: { subject, exam_type: examType, marks_obtained: marksObtained, total_marks: totalMarks }
    });

    res.json({ success: true, message: 'Marks updated successfully', data: { id: existing.id } });
  } catch (error) {
    next(error);
  }
});

// Remove a marks entry entered by mistake
router.delete('/:id', authMiddleware, roleMiddleware('teacher', 'admin'), async (req, res, next) => {
  try {
    const existing = await getRecord('marks', req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Marks record not found' });
    }

    await deleteRecord('marks', existing.id);
    await invalidateMarksCaches(existing.student_id);
    emitToUser(existing.student_id, 'marks:update', { student_id: existing.student_id, id: existing.id });

    await recordAudit(req, {
      action: 'marks_delete',
      entityType: 'marks',
      entityId: existing.id,
      summary: `${existing.subject} ${existing.exam_type}: ${existing.marks_obtained}/${existing.total_marks} removed`,
      metadata: { student_id: existing.student_id, removed: existing }
    });

    res.json({ success: true, message: 'Marks record deleted' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
