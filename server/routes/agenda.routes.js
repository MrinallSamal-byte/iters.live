const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const { listRecords } = require('../services/firebase-data.service');

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseTimestamp(value) {
  if (value === null || value === undefined || value === '') return null;
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? null : timestamp;
}

function resolveAssignmentDueAt(assignment) {
  return parseTimestamp(assignment.deadline);
}

function resolveEventDueAt(event) {
  const deadlineTimestamp = parseTimestamp(event.registration_deadline);
  if (deadlineTimestamp !== null) {
    return deadlineTimestamp;
  }

  const time = String(event.event_time || '');
  if (/^\d{1,2}:\d{2}/.test(time)) {
    const combinedTimestamp = parseTimestamp(`${String(event.event_date)}T${time.slice(0, 5)}:00`);
    if (combinedTimestamp !== null) {
      return combinedTimestamp;
    }
  }

  return parseTimestamp(event.event_date);
}

async function fetchAgendaItems(req) {
  const now = Date.now();
  const graceWindow = 12 * 60 * 60 * 1000;
  const items = [];

  try {
    const filters = req.user.role === 'student'
      ? [
        { field: 'department', value: req.user.department },
        { field: 'year', value: req.user.year }
      ]
      : [];
    const assignments = await listRecords('assignments', { filters });

    for (const assignment of assignments) {
      if (assignment.is_active === false) continue;
      const dueAt = resolveAssignmentDueAt(assignment);
      if (dueAt === null || dueAt < now - graceWindow) continue;
      items.push({
        id: assignment.id,
        type: 'assignment',
        title: assignment.title || 'Assignment',
        dueAt: new Date(dueAt).toISOString()
      });
    }
  } catch (_) {
    void 0;
  }

  try {
    const events = await listRecords('events');
    for (const event of events) {
      if (event.is_active === false) continue;
      const dueAt = resolveEventDueAt(event);
      if (dueAt === null || dueAt < now - graceWindow) continue;
      items.push({
        id: event.id,
        type: 'event',
        title: event.title || 'Event',
        dueAt: new Date(dueAt).toISOString()
      });
    }
  } catch (_) {
    void 0;
  }

  items.sort((left, right) => left.dueAt.localeCompare(right.dueAt));
  return items;
}

async function getAgenda(req, res, next) {
  try {
    const limit = toNumber(req.query.limit, 50);
    const cappedLimit = Math.min(50, Math.max(1, Math.floor(limit)));

    let items = await fetchAgendaItems(req);
    items = items.slice(0, cappedLimit);

    res.json({ success: true, items });
  } catch (error) {
    next(error);
  }
}

router.get('/', authMiddleware, getAgenda);
router.get('/upcoming', authMiddleware, getAgenda);

module.exports = router;
