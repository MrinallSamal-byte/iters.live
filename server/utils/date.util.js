/**
 * Calendar-date helpers for records keyed by day (attendance, exam dates).
 *
 * Dates are stored as plain "YYYY-MM-DD" strings so the same day always
 * compares equal regardless of the time component or time zone the client
 * happened to send.
 */

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})/;

// India (UTC+5:30) is ahead of UTC by up to 14h in the widest case we serve;
// "today" for the user may already be "tomorrow" in UTC.
const FUTURE_TOLERANCE_HOURS = 14;

function isRealCalendarDate(year, month, day) {
  const probe = new Date(Date.UTC(year, month - 1, day));
  return probe.getUTCFullYear() === year
    && probe.getUTCMonth() === month - 1
    && probe.getUTCDate() === day;
}

/**
 * @returns {string|null} "YYYY-MM-DD", or null when the value is not a real date
 */
function normalizeDateOnly(value) {
  if (value === undefined || value === null || value === '') return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString().slice(0, 10);
  }

  const text = String(value).trim();
  const match = DATE_ONLY_PATTERN.exec(text);
  if (match) {
    const [, year, month, day] = match;
    return isRealCalendarDate(Number(year), Number(month), Number(day))
      ? `${year}-${month}-${day}`
      : null;
  }

  const parsed = Date.parse(text);
  if (Number.isNaN(parsed)) return null;
  return new Date(parsed).toISOString().slice(0, 10);
}

/**
 * True when the calendar day has not started anywhere on earth yet
 * (tolerates the user being ahead of UTC).
 */
function isFutureDateOnly(dateOnly, toleranceHours = FUTURE_TOLERANCE_HOURS) {
  const startOfDay = Date.parse(`${dateOnly}T00:00:00.000Z`);
  if (Number.isNaN(startOfDay)) return false;
  return startOfDay > Date.now() + toleranceHours * 60 * 60 * 1000;
}

module.exports = {
  normalizeDateOnly,
  isFutureDateOnly,
  FUTURE_TOLERANCE_HOURS
};
