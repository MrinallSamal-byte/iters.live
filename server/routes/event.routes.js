const express = require('express');
const router = express.Router();
const { query } = require('../database/db');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');
const { emitToRole, broadcast } = require('../socket/socket');

// Get all events
router.get('/', async (req, res, next) => {
  try {
    const events = await query(
      `SELECT e.*, u.name as created_by_name, 
       (SELECT COUNT(*) FROM event_registrations WHERE event_id = e.id) as registration_count
       FROM events e LEFT JOIN users u ON e.created_by = u.id
       WHERE e.is_active = TRUE ORDER BY e.event_date DESC`
    );
    res.json({ success: true, data: events });
  } catch (error) {
    next(error);
  }
});

// Create event
router.post('/', authMiddleware, roleMiddleware('teacher', 'admin'), async (req, res, next) => {
  try {
    const { title, description, event_date, event_time, location, category, max_participants, registration_deadline, image_url } = req.body;
    
    const result = await query('INSERT INTO events (title, description, event_date, event_time, location, category, max_participants, registration_deadline, image_url, created_by) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id', [title, description, event_date, event_time, location, category, max_participants, registration_deadline, image_url, req.user.id]
    );

    broadcast('event:created', { eventId: result[0].id, title, category });
    res.status(201).json({ success: true, message: 'Event created successfully', data: { id: result[0].id } });
  } catch (error) {
    next(error);
  }
});

// Register for event
router.post('/:id/register', authMiddleware, async (req, res, next) => {
  try {
    await query('INSERT INTO event_registrations (event_id, user_id) VALUES ($1, $2) RETURNING id', [req.params.id, req.user.id]
    );

    const count = await query('SELECT COUNT(*) as count FROM event_registrations WHERE event_id = $1', [req.params.id]
    );

    broadcast('event:count', { eventId: req.params.id, count: count[0].count });
    res.json({ success: true, message: 'Registered successfully' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
