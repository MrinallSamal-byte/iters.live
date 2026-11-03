const express = require('express');
const router = express.Router();
const { authMiddleware, roleMiddleware, optionalAuth } = require('../middleware/auth');
const { broadcast } = require('../socket/socket');
const {
  createRecord,
  listRecords,
  getRecord,
  updateRecord,
  isValidDocId
} = require('../services/firebase-data.service');
const { registerForEvent, cancelRegistration } = require('../services/event-registration.service');
const notificationService = require('../services/notification.service');
const { recordAudit } = require('../services/audit.service');
const { normalizeDateOnly } = require('../utils/date.util');

const IN_QUERY_CHUNK = 30;
const TIME_PATTERN = /^([01]?\d|2[0-3]):[0-5]\d/;

function toNumber(value, fallback = null) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * Validate and normalise the writable event fields. Returns { error } or { fields }.
 * With `partial`, only fields present in the body are validated.
 */
function validateEventFields(body, { partial = false } = {}) {
  const fields = {};
  const has = (key) => body[key] !== undefined;

  if (!partial || has('title')) {
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    if (title.length < 3 || title.length > 200) return { error: 'title must be 3-200 characters' };
    fields.title = title;
  }

  if (!partial || has('event_date')) {
    const eventDate = normalizeDateOnly(body.event_date);
    if (!eventDate) return { error: 'event_date must be a valid date' };
    fields.event_date = eventDate;
  }

  if (has('event_time') && body.event_time) {
    if (!TIME_PATTERN.test(String(body.event_time))) return { error: 'event_time must look like HH:MM' };
    fields.event_time = String(body.event_time);
  } else if (has('event_time')) {
    fields.event_time = null;
  }

  if (has('max_participants')) {
    if (body.max_participants === null || body.max_participants === '') {
      fields.max_participants = null;
    } else {
      const capacity = toNumber(body.max_participants);
      if (!Number.isInteger(capacity) || capacity < 1) return { error: 'max_participants must be a whole number of at least 1' };
      fields.max_participants = capacity;
    }
  }

  if (has('registration_deadline')) {
    if (!body.registration_deadline) {
      fields.registration_deadline = null;
    } else {
      const timestamp = Date.parse(body.registration_deadline);
      if (Number.isNaN(timestamp)) return { error: 'registration_deadline must be a valid date' };
      fields.registration_deadline = new Date(timestamp).toISOString();
    }
  }

  for (const key of ['description', 'location', 'category']) {
    if (has(key)) fields[key] = body[key] ? String(body[key]).trim() : null;
  }
  if (has('image_url')) {
    const url = body.image_url ? String(body.image_url).trim() : null;
    if (url && !/^https?:\/\//i.test(url) && !(url.startsWith('/') && !url.startsWith('//'))) {
      return { error: 'image_url must be an http(s) URL or a /path' };
    }
    fields.image_url = url;
  }

  return { fields };
}

function canManage(user, event) {
  return user.role === 'admin' || String(event.created_by) === String(user.id);
}

async function registrantIds(eventId) {
  const rows = await listRecords('event_registrations', {
    filters: [{ field: 'event_id', value: String(eventId) }]
  });
  return Array.from(new Set(rows.map((row) => String(row.user_id))));
}

async function notifyRegistrants(eventId, payload) {
  try {
    const ids = await registrantIds(eventId);
    for (let index = 0; index < ids.length; index += IN_QUERY_CHUNK) {
      await notificationService.createBulk(ids.slice(index, index + IN_QUERY_CHUNK), payload);
    }
  } catch (error) {
    console.error('Event notification fan-out failed:', error.message);
  }
}

// Get all events (public). Signed-in viewers also get their own registration state.
router.get('/', optionalAuth, async (req, res, next) => {
  try {
    const events = (await listRecords('events', {
      orderBy: [
        { field: 'event_date', direction: 'desc' },
        { field: 'created_at', direction: 'desc' }
      ]
    })).filter((event) => event.is_active !== false);

    // Events written before the counter existed are counted once from the rows.
    let legacyCounts = null;
    if (events.some((event) => !Number.isFinite(Number(event.registration_count)))) {
      const registrations = await listRecords('event_registrations');
      legacyCounts = registrations.reduce((map, item) => {
        map.set(item.event_id, (map.get(item.event_id) || 0) + 1);
        return map;
      }, new Map());
    }

    let mine = new Set();
    if (req.user) {
      const mineRows = await listRecords('event_registrations', {
        filters: [{ field: 'user_id', value: String(req.user.id) }]
      });
      mine = new Set(mineRows.map((row) => row.event_id));
    }

    const data = events.map((event) => ({
      ...event,
      registration_count: Number.isFinite(Number(event.registration_count))
        ? Number(event.registration_count)
        : (legacyCounts?.get(event.id) || 0),
      is_registered: req.user ? mine.has(event.id) : undefined
    }));

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// Events the signed-in user is registered for
router.get('/registrations/mine', authMiddleware, async (req, res, next) => {
  try {
    const registrations = await listRecords('event_registrations', {
      filters: [{ field: 'user_id', value: String(req.user.id) }]
    });

    const ids = Array.from(new Set(registrations.map((row) => row.event_id)));
    const events = [];
    for (let index = 0; index < ids.length; index += IN_QUERY_CHUNK) {
      events.push(...await listRecords('events', {
        filters: [{ field: 'id', op: 'in', value: ids.slice(index, index + IN_QUERY_CHUNK) }]
      }));
    }

    const registeredAt = new Map(registrations.map((row) => [row.event_id, row.registered_at || row.created_at || null]));
    const data = events
      .filter((event) => event.is_active !== false)
      .map((event) => ({ ...event, registered_at: registeredAt.get(event.id) || null }))
      .sort((left, right) => String(left.event_date || '').localeCompare(String(right.event_date || '')));

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// Create event
router.post('/', authMiddleware, roleMiddleware('teacher', 'admin'), async (req, res, next) => {
  try {
    const validated = validateEventFields(req.body || {});
    if (validated.error) {
      return res.status(400).json({ success: false, message: validated.error });
    }

    const event = await createRecord('events', {
      description: null,
      event_time: null,
      location: null,
      category: null,
      max_participants: null,
      registration_deadline: null,
      image_url: null,
      ...validated.fields,
      registration_count: 0,
      created_by: req.user.id,
      created_by_name: req.user.name || null,
      is_active: true
    });

    broadcast('events:update', { eventId: event.id, title: event.title, category: event.category });

    await recordAudit(req, {
      action: 'event_create',
      entityType: 'event',
      entityId: event.id,
      summary: event.title
    });

    res.status(201).json({
      success: true,
      message: 'Event created successfully',
      data: { id: event.id }
    });
  } catch (error) {
    next(error);
  }
});

// Edit event (organizer or admin)
router.put('/:id', authMiddleware, roleMiddleware('teacher', 'admin'), async (req, res, next) => {
  try {
    const event = isValidDocId(req.params.id) ? await getRecord('events', req.params.id) : null;
    if (!event || event.is_active === false) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }
    if (!canManage(req.user, event)) {
      return res.status(403).json({ success: false, message: 'Only the organizer can edit this event' });
    }

    const validated = validateEventFields(req.body || {}, { partial: true });
    if (validated.error) {
      return res.status(400).json({ success: false, message: validated.error });
    }
    const updates = validated.fields;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, message: 'No valid fields to update' });
    }

    // Capacity can grow or be removed, but never drop below the people already in.
    if (updates.max_participants !== undefined && updates.max_participants !== null
      && Number(event.registration_count) > updates.max_participants) {
      return res.status(409).json({
        success: false,
        message: `${event.registration_count} people are already registered; capacity cannot be lower than that`
      });
    }

    await updateRecord('events', event.id, { ...updates, updated_by: req.user.id });

    const whenOrWhereChanged = ['event_date', 'event_time', 'location'].some(
      (key) => updates[key] !== undefined && updates[key] !== event[key]
    );
    if (whenOrWhereChanged) {
      await notifyRegistrants(event.id, {
        title: 'Event updated',
        message: `"${updates.title || event.title}" has new details — check the date, time and location.`,
        type: 'event',
        link: '/dashboard/student-events.html',
        metadata: { eventId: event.id }
      });
    }

    broadcast('events:update', { eventId: event.id });
    await recordAudit(req, {
      action: 'event_update',
      entityType: 'event',
      entityId: event.id,
      summary: updates.title || event.title,
      metadata: { fields: Object.keys(updates) }
    });

    res.json({ success: true, message: 'Event updated', data: { id: event.id } });
  } catch (error) {
    next(error);
  }
});

// Cancel event (organizer or admin). Registered attendees are told.
router.delete('/:id', authMiddleware, roleMiddleware('teacher', 'admin'), async (req, res, next) => {
  try {
    const event = isValidDocId(req.params.id) ? await getRecord('events', req.params.id) : null;
    if (!event || event.is_active === false) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }
    if (!canManage(req.user, event)) {
      return res.status(403).json({ success: false, message: 'Only the organizer can cancel this event' });
    }

    await updateRecord('events', event.id, {
      is_active: false,
      cancelled_at: new Date().toISOString(),
      cancelled_by: req.user.id
    });

    await notifyRegistrants(event.id, {
      title: 'Event cancelled',
      message: `"${event.title}" has been cancelled.`,
      type: 'event',
      link: '/dashboard/student-events.html',
      metadata: { eventId: event.id, cancelled: true }
    });

    broadcast('events:update', { eventId: event.id, cancelled: true });
    await recordAudit(req, {
      action: 'event_cancel',
      entityType: 'event',
      entityId: event.id,
      summary: event.title
    });

    res.json({ success: true, message: 'Event cancelled' });
  } catch (error) {
    next(error);
  }
});

// Register for event
router.post('/:id/register', authMiddleware, async (req, res, next) => {
  try {
    const result = await registerForEvent(req.params.id, String(req.user.id));

    switch (result.status) {
      case 'not_found':
        return res.status(404).json({ success: false, message: 'Event not found' });
      case 'closed':
        return res.status(400).json({ success: false, message: 'Registration deadline has passed' });
      case 'full':
        return res.status(409).json({ success: false, message: 'Event is full' });
      case 'already':
        return res.json({ success: true, message: 'Already registered', data: { registration_count: result.count } });
      default:
        broadcast('events:update', { eventId: req.params.id, count: result.count });
        return res.json({
          success: true,
          message: 'Registered successfully',
          data: { registration_count: result.count }
        });
    }
  } catch (error) {
    next(error);
  }
});

// Cancel my registration
router.delete('/:id/register', authMiddleware, async (req, res, next) => {
  try {
    const result = await cancelRegistration(req.params.id, String(req.user.id));

    switch (result.status) {
      case 'not_found':
        return res.status(404).json({ success: false, message: 'Event not found' });
      case 'not_registered':
        return res.status(404).json({ success: false, message: 'You are not registered for this event' });
      default:
        broadcast('events:update', { eventId: req.params.id, count: result.count });
        return res.json({
          success: true,
          message: 'Registration cancelled',
          data: { registration_count: result.count }
        });
    }
  } catch (error) {
    next(error);
  }
});

module.exports = router;
