const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const { listRecords } = require('../services/firebase-data.service');
const { getPortalSnapshotForUser } = require('../services/soa-data.service');

function weekdayRank(day) {
  const order = {
    Monday: 1,
    Tuesday: 2,
    Wednesday: 3,
    Thursday: 4,
    Friday: 5,
    Saturday: 6
  };
  return order[day] || 7;
}

function sortTimetable(records = []) {
  return [...records].sort((left, right) => {
    const dayDiff = weekdayRank(left.day_of_week) - weekdayRank(right.day_of_week);
    if (dayDiff !== 0) return dayDiff;
    return String(left.start_time || '').localeCompare(String(right.start_time || ''));
  });
}

router.get('/', authMiddleware, async (req, res, next) => {
  try {
    let timetable = [];

    if (req.user.role === 'student') {
      timetable = await listRecords('timetable', {
        filters: [
          { field: 'department', value: req.user.department },
          { field: 'year', value: req.user.year },
          { field: 'section', value: req.user.section }
        ]
      });

      if (timetable.length === 0) {
        const snapshot = await getPortalSnapshotForUser({
          userId: req.user.id,
          registrationNumber: req.user.registration_number
        });
        timetable = snapshot.normalizedData?.timetable || [];
      }
    } else if (req.user.role === 'teacher') {
      timetable = await listRecords('timetable', {
        filters: [{ field: 'teacher_id', value: req.user.id }]
      });
    }

    res.json({ success: true, data: sortTimetable(timetable) });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
