const express = require('express');
const router = express.Router();
const { query } = require('../database/db');

// Get hostel menu
router.get('/menu', async (req, res, next) => {
  try {
    const { date } = req.query;
    const targetDate = date || new Date().toISOString().split('T')[0];
    
    const menu = await query(`
      SELECT * FROM hostel_menu WHERE date = $1 
      ORDER BY CASE meal_type 
        WHEN 'breakfast' THEN 1 
        WHEN 'lunch' THEN 2 
        WHEN 'snacks' THEN 3 
        WHEN 'dinner' THEN 4 
        ELSE 5 END`, [targetDate]
    );

    res.json({ success: true, data: menu });
  } catch (error) {
    next(error);
  }
});

// Get menu for week
router.get('/menu/week', async (req, res, next) => {
  try {
    const today = new Date();
    const weekLater = new Date(today);
    weekLater.setDate(weekLater.getDate() + 7);

    const menu = await query(`
      SELECT * FROM hostel_menu WHERE date BETWEEN $1 AND $2 
      ORDER BY date, CASE meal_type 
        WHEN 'breakfast' THEN 1 
        WHEN 'lunch' THEN 2 
        WHEN 'snacks' THEN 3 
        WHEN 'dinner' THEN 4 
        ELSE 5 END`, [today.toISOString().split('T')[0], weekLater.toISOString().split('T')[0]]
    );

    res.json({ success: true, data: menu });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
