const express = require('express');
const router = express.Router();
const { listRecords } = require('../services/firebase-data.service');

function mealRank(mealType) {
  const order = {
    breakfast: 1,
    lunch: 2,
    snacks: 3,
    dinner: 4
  };
  return order[mealType] || 5;
}

function sortMenu(items = []) {
  return [...items].sort((left, right) => {
    const dateDiff = String(left.date || '').localeCompare(String(right.date || ''));
    if (dateDiff !== 0) return dateDiff;
    return mealRank(left.meal_type) - mealRank(right.meal_type);
  });
}

router.get('/menu', async (req, res, next) => {
  try {
    const targetDate = req.query.date || new Date().toISOString().split('T')[0];
    const menu = await listRecords('hostel_menu', {
      filters: [{ field: 'date', value: targetDate }]
    });
    res.json({ success: true, data: sortMenu(menu) });
  } catch (error) {
    next(error);
  }
});

router.get('/menu/week', async (req, res, next) => {
  try {
    const today = new Date();
    const weekLater = new Date(today);
    weekLater.setDate(weekLater.getDate() + 7);

    const menu = await listRecords('hostel_menu');
    const start = today.toISOString().split('T')[0];
    const end = weekLater.toISOString().split('T')[0];

    res.json({
      success: true,
      data: sortMenu(menu.filter((item) => item.date >= start && item.date <= end))
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
