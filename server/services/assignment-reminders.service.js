/**
 * Assignment deadline reminders.
 *
 * Students who have not submitted get one in-app notification when an
 * assignment's deadline is inside the reminder window (default 24 hours).
 * Each assignment is reminded exactly once: `reminder_sent_at` is written on
 * the assignment after the notifications go out, so the job is idempotent and
 * safe to run from an interval timer, an external cron, or both.
 */

const { listRecords, updateRecord } = require('./firebase-data.service');
const notificationService = require('./notification.service');

const DEFAULT_WINDOW_HOURS = 24;
const IN_QUERY_CHUNK = 30;

function yearVariants(year) {
  const numeric = Number(year);
  if (!Number.isFinite(numeric)) return [year];
  // Legacy rows may hold the year as text.
  return [numeric, String(numeric)];
}

/**
 * Students in the assignment's class (department + year).
 */
async function loadClassStudents(assignment) {
  if (!assignment.department || assignment.year === undefined || assignment.year === null) return [];

  return listRecords('users', {
    filters: [
      { field: 'role', value: 'student' },
      { field: 'department', value: assignment.department },
      { field: 'year', op: 'in', value: yearVariants(assignment.year) }
    ]
  });
}

async function loadSubmitterIds(assignmentId) {
  const submissions = await listRecords('assignment_submissions', {
    filters: [{ field: 'assignment_id', value: assignmentId }]
  });
  return new Set(submissions.map((submission) => String(submission.student_id)));
}

/**
 * Pure: which assignments are inside the reminder window and not yet reminded?
 */
function selectDueSoon(assignments, { now = Date.now(), windowHours = DEFAULT_WINDOW_HOURS } = {}) {
  const horizon = now + windowHours * 60 * 60 * 1000;

  return assignments.filter((assignment) => {
    if (assignment.is_active === false || assignment.reminder_sent_at) return false;
    const deadline = Date.parse(assignment.deadline || '');
    return Number.isFinite(deadline) && deadline > now && deadline <= horizon;
  });
}

/**
 * Send due-soon reminders. Returns a summary; individual notification failures
 * are logged and do not abort the run.
 */
async function runDueSoonReminders(options = {}) {
  const windowHours = options.windowHours || DEFAULT_WINDOW_HOURS;
  const now = options.now || Date.now();

  const active = await listRecords('assignments', {
    filters: [{ field: 'is_active', value: true }]
  });
  const due = selectDueSoon(active, { now, windowHours });

  const summary = { assignments: due.length, notified: 0, skipped: 0 };

  for (const assignment of due) {
    try {
      const [students, submitted] = await Promise.all([
        loadClassStudents(assignment),
        loadSubmitterIds(assignment.id)
      ]);

      const pending = students.filter((student) => !submitted.has(String(student.id)));
      const hoursLeft = Math.max(1, Math.round((Date.parse(assignment.deadline) - now) / (60 * 60 * 1000)));

      for (let index = 0; index < pending.length; index += IN_QUERY_CHUNK) {
        const chunk = pending.slice(index, index + IN_QUERY_CHUNK);
        await notificationService.createBulk(chunk.map((student) => student.id), {
          title: 'Assignment due soon',
          message: `"${assignment.title || 'Assignment'}" is due in about ${hoursLeft} hour${hoursLeft === 1 ? '' : 's'}.`,
          type: 'assignment',
          link: '/dashboard/student-assignments.html',
          metadata: { assignmentId: assignment.id, deadline: assignment.deadline, reminder: true }
        });
      }

      summary.notified += pending.length;
      summary.skipped += students.length - pending.length;

      // Mark after sending: a crash in between means a repeat reminder, which
      // is preferable to a student silently never being told.
      await updateRecord('assignments', assignment.id, { reminder_sent_at: new Date(now).toISOString() });
    } catch (error) {
      console.error(`Reminder run failed for assignment ${assignment.id}:`, error.message);
    }
  }

  return summary;
}

/**
 * Start the in-process timer (non-serverless deployments). Returns a stop
 * function. A zero/invalid interval disables the timer.
 */
function startReminderScheduler() {
  const minutes = Number(process.env.ASSIGNMENT_REMINDER_INTERVAL_MINUTES);
  const intervalMinutes = Number.isFinite(minutes) ? minutes : 30;
  if (intervalMinutes <= 0) return () => {};

  const timer = setInterval(() => {
    runDueSoonReminders().catch((error) => {
      console.error('Scheduled assignment reminders failed:', error.message);
    });
  }, intervalMinutes * 60 * 1000);

  // Never keep the process alive just for this timer.
  if (typeof timer.unref === 'function') timer.unref();

  return () => clearInterval(timer);
}

module.exports = {
  DEFAULT_WINDOW_HOURS,
  selectDueSoon,
  loadClassStudents,
  yearVariants,
  runDueSoonReminders,
  startReminderScheduler
};
