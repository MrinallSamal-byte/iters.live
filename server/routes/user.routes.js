const express = require('express');
const router = express.Router();
const { query } = require('../database/db');
const { authMiddleware } = require('../middleware/auth');

router.get('/me', authMiddleware, async (req, res, next) => {
  try {
    const users = await query('SELECT id, name, registration_number, email, phone_number AS phone, role, department, year, section, subjects_taught, profile_picture AS profile_pic FROM users WHERE id = $1', [req.user.id]
    );
    res.json({ success: true, data: users[0] });
  } catch (error) {
    next(error);
  }
});

router.put('/profile', authMiddleware, async (req, res, next) => {
  try {
    const { name, phone_number, profile_picture } = req.body;
    await query('UPDATE users SET name = $1, phone_number = $2, profile_picture = $3 WHERE id = $4', [name, phone_number, profile_picture, req.user.id]
    );
    res.json({ success: true, message: 'Profile updated successfully' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
