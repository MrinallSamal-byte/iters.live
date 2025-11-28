const express = require('express');
const router = express.Router();
const { db } = require('../database/firebase');
const { authMiddleware } = require('../middleware/auth');

// Helper function to get demo timetable
// Constants for timetable generation
const WEDNESDAY_HALF_DAY_MAX_SLOTS = 3;
const getDemoTimetable = (department, year, section) => {
  const subjects = ['Data Structures', 'Algorithms', 'Database Management', 'Operating Systems', 'Computer Networks'];
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const timeSlots = ['09:00-10:00', '10:00-11:00', '11:00-12:00', '14:00-15:00', '15:00-16:00', '16:00-17:00'];
  
  const timetable = [];
  let subjectIndex = 0;
  
  days.forEach(day => {
    timeSlots.forEach((timeSlot, idx) => {
      // Half day Wednesday
      if (day === 'Wednesday' && idx > WEDNESDAY_HALF_DAY_MAX_SLOTS) return;
      // Skip lunch break slot
      if (idx === 3) return;
      
      const subject = subjects[subjectIndex % subjects.length];
      const room = `${department || 'CSE'}-${101 + Math.floor(Math.random() * 50)}`;
      
      timetable.push({
        id: timetable.length + 1,
        day_of_week: day,
        time_slot: timeSlot,
        start_time: timeSlot.split('-')[0],
        end_time: timeSlot.split('-')[1],
        subject,
        teacher_name: `Dr. Faculty ${Math.floor(Math.random() * 10) + 1}`,
        room_number: room,
        department: department || 'CSE',
        year: year || 2,
        section: section || 'A'
      });
      
      subjectIndex++;
    });
  });
  
  return timetable;
};

// Get timetable for student/teacher
router.get('/', authMiddleware, async (req, res, next) => {
  try {
    const department = req.user.department || 'CSE';
    const year = req.user.year || 2;
    const section = req.user.section || 'A';
    const userId = req.user.id || req.user.uid;
    
    // Try Firestore first
    try {
      let timetableSnapshot;
      
      if (req.user.role === 'student') {
        timetableSnapshot = await db.collection('timetable')
          .where('department', '==', department)
          .where('year', '==', year)
          .where('section', '==', section)
          .get();
      } else if (req.user.role === 'teacher') {
        timetableSnapshot = await db.collection('timetable')
          .where('teacher_id', '==', userId)
          .get();
      }
      
      if (timetableSnapshot && !timetableSnapshot.empty) {
        const timetable = [];
        timetableSnapshot.forEach(doc => {
          timetable.push({ id: doc.id, ...doc.data() });
        });
        
        // Sort by day and time
        const dayOrder = { 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3, 'Thursday': 4, 'Friday': 5, 'Saturday': 6 };
        timetable.sort((a, b) => {
          const dayDiff = (dayOrder[a.day_of_week] || 7) - (dayOrder[b.day_of_week] || 7);
          if (dayDiff !== 0) return dayDiff;
          return (a.start_time || '00:00').localeCompare(b.start_time || '00:00');
        });
        
        return res.json({ success: true, data: timetable });
      }
    } catch (firestoreError) {
      console.warn('Firestore timetable query failed, using demo data:', firestoreError.message);
    }
    
    // Fallback to demo data
    res.json({ success: true, data: getDemoTimetable(department, year, section) });
  } catch (error) {
    console.error('Get timetable error:', error.message);
    res.json({ success: true, data: getDemoTimetable() });
  }
});

module.exports = router;
