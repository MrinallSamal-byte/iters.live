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
  getRecord,
  createRecord,
  listRecords
} = require('../services/firebase-data.service');
const { emitToUser } = require('../socket/socket');
const notificationService = require('../services/notification.service');

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
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

module.exports = router;

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

    const student = await getRecord('users', student_id);
    const record = await createRecord('marks', {
      student_id,
      subject,
      exam_type,
      marks_obtained: toNumber(marks_obtained, 0),
      total_marks: toNumber(total_marks, 0),
      exam_date,
      semester: semester ?? student?.semester ?? null,
      uploaded_by: req.user.id,
      remarks: remarks || null,
      department: student?.department || null,
      year: student?.year ?? null,
      section: student?.section || null
    });

    cacheService.invalidateMarks(student_id);
    emitToUser(student_id, 'marks:update', { student_id, id: record.id });

    await notificationService.create({
      userId: student_id,
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
    const [studentRecords, allMarks] = await Promise.all([
      listRecords('marks', {
        filters: [{ field: 'student_id', value: userId }]
      }),
      listRecords('marks')
    ]);
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

module.exports = router;
