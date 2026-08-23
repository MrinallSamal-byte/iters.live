const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { authMiddleware } = require('../middleware/auth');
const { listRecords } = require('../services/firebase-data.service');
const { getPortalSnapshotForUser } = require('../services/soa-data.service');

const WEEKDAY_OFFSETS = {
  monday: 0,
  tuesday: 1,
  wednesday: 2,
  thursday: 3,
  friday: 4,
  saturday: 5,
  sunday: 6
};

const PERIOD_STARTS = ['09:00', '10:00', '11:00', '14:00', '15:00'];
const PERIOD_DURATION_MINUTES = 60;
const RRULE_COUNT = 16;

function parseClockTime(value) {
  const match = /^(\d{1,2}):(\d{2})/.exec(String(value || ''));
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return { hours, minutes };
}

function resolveClassTimes(row, periodIndex) {
  const start = parseClockTime(row.start_time);
  const end = parseClockTime(row.end_time);
  if (start) {
    const endMinutes = end
      ? end.hours * 60 + end.minutes
      : start.hours * 60 + start.minutes + PERIOD_DURATION_MINUTES;
    return { startMinutes: start.hours * 60 + start.minutes, endMinutes };
  }

  const fallbackStart = PERIOD_STARTS[periodIndex % PERIOD_STARTS.length];
  const [hours, minutes] = fallbackStart.split(':').map(Number);
  return {
    startMinutes: hours * 60 + minutes,
    endMinutes: hours * 60 + minutes + PERIOD_DURATION_MINUTES
  };
}

function weekdayOffset(dayName) {
  return WEEKDAY_OFFSETS[String(dayName || '').trim().toLowerCase()] ?? null;
}

function currentWeekMonday() {
  const now = new Date();
  const offset = now.getDay() === 0 ? -6 : 1 - now.getDay();
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
  return monday;
}

function pad(value) {
  return String(value).padStart(2, '0');
}

function formatLocal(minutesFromMidnight, dayOffsetFromMonday) {
  const base = currentWeekMonday();
  base.setDate(base.getDate() + dayOffsetFromMonday);
  base.setMinutes(base.getMinutes() + minutesFromMidnight);
  return `${base.getFullYear()}${pad(base.getMonth() + 1)}${pad(base.getDate())}T${pad(base.getHours())}${pad(base.getMinutes())}00`;
}

function formatUtc(date) {
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`;
}

function escapeText(value) {
  return String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

function foldLine(line) {
  if (line.length <= 73) return line;
  const parts = [];
  let rest = line;
  let first = true;
  while (rest.length > 0) {
    const size = first ? 73 : 72;
    parts.push((first ? '' : ' ') + rest.slice(0, size));
    rest = rest.slice(size);
    first = false;
  }
  return parts.join('\r\n');
}

function stableUid(seed) {
  return `${crypto.createHash('md5').update(seed).digest('hex')}@iterasn-hub`;
}

async function loadTimetable(user) {
  if (user.role === 'student') {
    let timetable = await listRecords('timetable', {
      filters: [
        { field: 'department', value: user.department },
        { field: 'year', value: user.year },
        { field: 'section', value: user.section }
      ]
    });

    if (timetable.length === 0) {
      const snapshot = await getPortalSnapshotForUser({
        userId: user.id,
        registrationNumber: user.registration_number
      });
      timetable = snapshot.normalizedData?.timetable || [];
    }

    return timetable;
  }

  if (user.role === 'teacher') {
    return listRecords('timetable', {
      filters: [{ field: 'teacher_id', value: user.id }]
    });
  }

  return [];
}

async function loadAssignments(user) {
  const filters = user.role === 'student'
    ? [
      { field: 'department', value: user.department },
      { field: 'year', value: user.year }
    ]
    : [];
  const assignments = await listRecords('assignments', { filters });
  return assignments.filter((assignment) => assignment.is_active !== false);
}

async function loadEvents() {
  const events = await listRecords('events');
  return events.filter((event) => event.is_active !== false);
}

function buildTimetableEvents(timetableRows, stampUtc) {
  const lines = [];
  const rowsByDay = new Map();

  for (const row of timetableRows || []) {
    const offset = weekdayOffset(row.day_of_week || row.day);
    if (offset === null) continue;
    if (!rowsByDay.has(offset)) {
      rowsByDay.set(offset, []);
    }
    rowsByDay.get(offset).push(row);
  }

  for (const [dayOffset, rows] of Array.from(rowsByDay.entries()).sort(([a], [b]) => a - b)) {
    let periodIndex = 0;
    for (const row of rows) {
      const times = resolveClassTimes(row, periodIndex);
      periodIndex += 1;
      lines.push(
        'BEGIN:VEVENT',
        foldLine(`UID:${stableUid(`timetable:${row.id || `${row.subject}-${dayOffset}-${times.startMinutes}`}`)}`),
        `DTSTAMP:${stampUtc}`,
        `DTSTART:${formatLocal(times.startMinutes, dayOffset)}`,
        `DTEND:${formatLocal(times.endMinutes, dayOffset)}`,
        'RRULE:FREQ=WEEKLY;COUNT=16',
        foldLine(`SUMMARY:${escapeText(row.subject || 'Class')}`),
        foldLine(`LOCATION:${escapeText(row.room || row.room_number || '')}`),
        foldLine(`DESCRIPTION:${escapeText(row.teacher_name || row.teacher || row.faculty || '')}`),
        'END:VEVENT'
      );
    }
  }

  return lines;
}

function buildSingleEvent(uidSeed, summary, dueAtIso, location) {
  const dueAt = new Date(dueAtIso);
  const endAt = new Date(dueAt.getTime() + 30 * 60 * 1000);
  return [
    'BEGIN:VEVENT',
    foldLine(`UID:${stableUid(uidSeed)}`),
    `DTSTAMP:${formatUtc(new Date())}`,
    `DTSTART:${formatUtc(dueAt)}`,
    `DTEND:${formatUtc(endAt)}`,
    foldLine(`SUMMARY:${escapeText(summary)}`),
    foldLine(`LOCATION:${escapeText(location || '')}`),
    'END:VEVENT'
  ];
}

router.get('/', authMiddleware, async (req, res, next) => {
  try {
    const stampUtc = formatUtc(new Date());
    const eventLines = [];

    try {
      const timetableRows = await loadTimetable(req.user);
      eventLines.push(...buildTimetableEvents(timetableRows, stampUtc));
    } catch (_) {
      void 0;
    }

    try {
      const assignments = await loadAssignments(req.user);
      for (const assignment of assignments) {
        const timestamp = Date.parse(assignment.deadline || '');
        if (Number.isNaN(timestamp)) continue;
        eventLines.push(...buildSingleEvent(
          `assignment:${assignment.id}`,
          `Due: ${assignment.title || 'Assignment'}`,
          new Date(timestamp).toISOString(),
          ''
        ));
      }
    } catch (_) {
      void 0;
    }

    try {
      const events = await loadEvents();
      for (const event of events) {
        const timeMatch = /^(\d{1,2}:\d{2})/.exec(String(event.event_time || ''));
        const timestamp = Date.parse(timeMatch && event.event_date
          ? `${event.event_date}T${timeMatch[1]}:00`
          : event.event_date || '');
        if (Number.isNaN(timestamp)) continue;
        eventLines.push(...buildSingleEvent(
          `event:${event.id}`,
          event.title || 'Event',
          new Date(timestamp).toISOString(),
          event.location
        ));
      }
    } catch (_) {
      void 0;
    }

    const calendarLines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//ITERasn hub//Timetable//EN',
      'CALSCALE:GREGORIAN',
      ...eventLines,
      'END:VCALENDAR'
    ];

    res.set('Content-Type', 'text/calendar; charset=utf-8');
    res.set('Content-Disposition', 'attachment; filename="iterasn-timetable.ics"');
    res.send(`${calendarLines.join('\r\n')}\r\n`);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
