/**
 * Low-attendance alerts.
 *
 * Students only find out they are short of the attendance requirement when it
 * is too late to recover. This notifies a student the moment a newly recorded
 * absence takes a subject below the threshold — once per crossing, not on
 * every further absence.
 */

const notificationService = require('./notification.service');
const { listRecords } = require('./firebase-data.service');

const DEFAULT_THRESHOLD = 75;
const COUNTED_AS_PRESENT = new Set(['present', 'late']);

function alertThreshold() {
  const configured = Number(process.env.ATTENDANCE_ALERT_THRESHOLD);
  return Number.isFinite(configured) && configured > 0 && configured <= 100
    ? configured
    : DEFAULT_THRESHOLD;
}

function percentage(present, total) {
  return total > 0 ? (present * 100) / total : null;
}

/**
 * Pure: did marking `newStatus` for (subject, date) move the student from at/above
 * the threshold to below it?
 *
 * @param {Array} records  all of the student's attendance records AFTER the write
 * @param {{subject:string,date:string,previousStatus:?string,threshold:number}} change
 */
function crossedBelowThreshold(records, change) {
  const { subject, date, previousStatus = null, threshold } = change;
  const subjectRecords = records.filter((record) => record.subject === subject);

  const total = subjectRecords.length;
  const present = subjectRecords.filter((record) => COUNTED_AS_PRESENT.has(record.status)).length;
  const after = percentage(present, total);
  if (after === null) {
    return { crossed: false, before: null, after: null };
  }

  // Reconstruct the state just before this write.
  let beforeTotal = total;
  let beforePresent = present;
  const current = subjectRecords.find((record) => record.date === date);
  if (current) {
    if (COUNTED_AS_PRESENT.has(current.status)) beforePresent -= 1;
    if (previousStatus) {
      if (COUNTED_AS_PRESENT.has(previousStatus)) beforePresent += 1;
    } else {
      beforeTotal -= 1; // the day was not recorded before
    }
  }
  const before = percentage(beforePresent, beforeTotal);

  return {
    crossed: after < threshold && (before === null || before >= threshold),
    before,
    after
  };
}

/**
 * Notify the student if this absence crossed the threshold. Never throws: an
 * alert failure must not fail the attendance write that triggered it.
 */
async function notifyIfBelowThreshold({ studentId, subject, date, status, previousStatus = null }) {
  if (status !== 'absent') return { notified: false };

  try {
    const threshold = alertThreshold();
    const records = await listRecords('attendance', {
      filters: [{ field: 'student_id', value: studentId }]
    });
    const result = crossedBelowThreshold(records, { subject, date, previousStatus, threshold });
    if (!result.crossed) return { notified: false, ...result };

    await notificationService.create({
      userId: studentId,
      title: 'Attendance below requirement',
      message: `Your attendance in ${subject} is now ${result.after.toFixed(1)}%, below the ${threshold}% requirement.`,
      type: 'attendance',
      link: '/dashboard/student-attendance.html',
      metadata: { subject, date, percentage: Number(result.after.toFixed(2)), threshold }
    });
    return { notified: true, ...result };
  } catch (error) {
    console.error('Attendance alert failed:', error.message);
    return { notified: false, error: error.message };
  }
}

module.exports = {
  DEFAULT_THRESHOLD,
  alertThreshold,
  crossedBelowThreshold,
  notifyIfBelowThreshold
};
