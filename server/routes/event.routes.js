const express = require('express');
const router = express.Router();
const { authMiddleware, roleMiddleware } = require('../middleware/auth');
const { broadcast } = require('../socket/socket');
const {
  createRecord,
  findOne,
  listRecords,
  getRecord,
  updateRecord
} = require('../services/firebase-data.service');

function toNumber(value, fallback = null) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

// Get all events
router.get('/', async (req, res, next) => {
  try {
    const events = await listRecords('events', {
      orderBy: [
        { field: 'event_date', direction: 'desc' },
        { field: 'created_at', direction: 'desc' }
      ]
    });

    const registrations = await listRecords('event_registrations');
    const counts = registrations.reduce((map, item) => {
      map.set(item.event_id, (map.get(item.event_id) || 0) + 1);
      return map;
    }, new Map());

    const data = events
      .filter((event) => event.is_active !== false)
      .map((event) => ({
        ...event,
        registration_count: counts.get(event.id) || 0
      }));

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// Create event
router.post('/', authMiddleware, roleMiddleware('teacher', 'admin'), async (req, res, next) => {
  try {
    const {
      title,
      description,
      event_date,
      event_time,
      location,
      category,
      max_participants,
      registration_deadline,
      image_url
    } = req.body;

    const event = await createRecord('events', {
      title,
      description,
      event_date,
      event_time,
      location,
      category,
      max_participants: toNumber(max_participants, null),
      registration_deadline: registration_deadline || null,
      image_url: image_url || null,
      created_by: req.user.id,
      created_by_name: req.user.name || null,
      is_active: true
    });

    broadcast('events:update', { eventId: event.id, title, category });

    res.status(201).json({
      success: true,
      message: 'Event created successfully',
      data: { id: event.id }
    });
  } catch (error) {
    next(error);
  }
});

// Register for event
router.post('/:id/register', authMiddleware, async (req, res, next) => {
  try {
    const eventId = req.params.id;
    const event = await getRecord('events', eventId);
    if (!event || event.is_active === false) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    if (event.registration_deadline && new Date(event.registration_deadline).getTime() < Date.now()) {
      return res.status(400).json({ success: false, message: 'Registration deadline has passed' });
    }

    const existing = await findOne('event_registrations', {
      filters: [
        { field: 'event_id', value: eventId },
        { field: 'user_id', value: req.user.id }
      ]
    });

    if (existing) {
      return res.json({ success: true, message: 'Already registered' });
    }

    if (event.max_participants != null) {
      const registrations = await listRecords('event_registrations', {
        filters: [{ field: 'event_id', value: eventId }]
      });
      if (registrations.length >= Number(event.max_participants)) {
        return res.status(409).json({ success: false, message: 'Event is full' });
      }
    }

    // ponytail: check-then-create race -> Firestore transaction if double-registration ever matters
    await createRecord('event_registrations', {
      event_id: eventId,
      user_id: req.user.id,
      registered_at: new Date().toISOString()
    });

    if (event.max_participants != null) {
      const registrations = await listRecords('event_registrations', {
        filters: [{ field: 'event_id', value: eventId }]
      });
      await updateRecord('events', eventId, {
        registration_count: registrations.length
      });
      broadcast('events:update', { eventId, count: registrations.length });
    } else {
      broadcast('events:update', { eventId });
    }

    res.json({ success: true, message: 'Registered successfully' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
