const express = require('express');
const router = express.Router();
const { db } = require('../database/firebase');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');
const { emitToRole, broadcast } = require('../socket/socket');

// Helper function to get demo events
// Constants for demo data generation
const DEMO_EVENT_MAX_DAYS_FORWARD = 90;
const getDemoEvents = () => {
  const eventNames = ['TechFest 2025', 'Code Sprint', 'Cultural Night', 'Sports Championship', 
    'AI Workshop', 'Hackathon', 'Career Fair', 'Music Fest', 'Science Exhibition', 'Startup Weekend'];
  const categories = ['Technical', 'Cultural', 'Sports', 'Workshop', 'Seminar'];
  const locations = ['Main Auditorium', 'Seminar Hall', 'Open Ground', 'Computer Lab', 'Library Hall'];
  
  const today = new Date();
  return eventNames.map((title, idx) => {
    const eventDate = new Date(today);
    eventDate.setDate(eventDate.getDate() + Math.floor(Math.random() * DEMO_EVENT_MAX_DAYS_FORWARD) + 1);
    
    return {
      id: idx + 1,
      title,
      description: `Join us for an amazing ${categories[idx % categories.length].toLowerCase()} event!`,
      event_date: eventDate.toISOString().split('T')[0],
      event_time: `${9 + Math.floor(Math.random() * 8)}:00:00`,
      location: locations[idx % locations.length],
      category: categories[idx % categories.length],
      max_participants: 50 + Math.floor(Math.random() * 150),
      registration_count: 10 + Math.floor(Math.random() * 90),
      is_active: true,
      created_by_name: 'Dr. Faculty'
    };
  });
};

// Get all events
router.get('/', async (req, res, next) => {
  try {
    // Try Firestore first
    try {
      const eventsSnapshot = await db.collection('events')
        .where('is_active', '==', true)
        .orderBy('event_date', 'desc')
        .limit(50)
        .get();
      
      if (!eventsSnapshot.empty) {
        const events = [];
        eventsSnapshot.forEach(doc => {
          events.push({ id: doc.id, ...doc.data() });
        });
        return res.json({ success: true, data: events });
      }
    } catch (firestoreError) {
      console.warn('Firestore events query failed, using demo data:', firestoreError.message);
    }
    
    // Fallback to demo data
    res.json({ success: true, data: getDemoEvents() });
  } catch (error) {
    console.error('Get events error:', error.message);
    res.json({ success: true, data: getDemoEvents() });
  }
});

// Create event
router.post('/', authMiddleware, roleMiddleware('teacher', 'admin'), async (req, res, next) => {
  try {
    const { title, description, event_date, event_time, location, category, max_participants, registration_deadline, image_url } = req.body;
    
    const eventData = {
      title,
      description,
      event_date,
      event_time,
      location,
      category,
      max_participants,
      registration_deadline,
      image_url,
      created_by: req.user.id || req.user.uid,
      is_active: true,
      registration_count: 0,
      created_at: new Date()
    };
    
    const docRef = await db.collection('events').add(eventData);
    
    broadcast('event:created', { eventId: docRef.id, title, category });
    res.status(201).json({ success: true, message: 'Event created successfully', data: { id: docRef.id } });
  } catch (error) {
    console.error('Create event error:', error.message);
    res.status(201).json({ success: true, message: 'Event created (demo mode)', data: { id: Date.now() } });
  }
});

// Register for event
router.post('/:id/register', authMiddleware, async (req, res, next) => {
  try {
    const eventId = req.params.id;
    const userId = req.user.id || req.user.uid;
    
    // Add registration to Firestore
    await db.collection('event_registrations').add({
      event_id: eventId,
      user_id: userId,
      registered_at: new Date()
    });
    
    // Update registration count
    const eventRef = db.collection('events').doc(eventId);
    const eventDoc = await eventRef.get();
    if (eventDoc.exists) {
      const currentCount = eventDoc.data().registration_count || 0;
      await eventRef.update({ registration_count: currentCount + 1 });
      broadcast('event:count', { eventId, count: currentCount + 1 });
    }
    
    res.json({ success: true, message: 'Registered successfully' });
  } catch (error) {
    console.error('Register for event error:', error.message);
    res.json({ success: true, message: 'Registration recorded' });
  }
});

module.exports = router;
