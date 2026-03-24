const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const { getRecord, updateRecord } = require('../services/firebase-data.service');

router.get('/me', authMiddleware, async (req, res, next) => {
  try {
    const user = await getRecord('users', req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({
      success: true,
      data: {
        id: user.id,
        name: user.name,
        registration_number: user.registration_number,
        email: user.email,
        phone: user.phone_number || null,
        role: user.role,
        department: user.department || null,
        year: user.year ?? null,
        section: user.section || null,
        subjects_taught: user.subjects_taught || null,
        profile_pic: user.profile_picture || null
      }
    });
  } catch (error) {
    next(error);
  }
});

router.put('/profile', authMiddleware, async (req, res, next) => {
  try {
    const { name, phone_number, profile_picture } = req.body;
    await updateRecord('users', req.user.id, {
      name,
      phone_number: phone_number || null,
      profile_picture: profile_picture || null
    });
    res.json({ success: true, message: 'Profile updated successfully' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
