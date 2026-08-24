const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const { updateRecord } = require('../services/firebase-data.service');

router.put('/profile', authMiddleware, async (req, res, next) => {
  try {
    const { name, phone_number, profile_picture } = req.body;

    if (profile_picture !== undefined && profile_picture !== '' &&
        !/^https?:\/\//i.test(profile_picture) &&
        !profile_picture.startsWith('/')) {
      return res.status(400).json({ success: false, message: 'profile_picture must be an http(s) URL or a /path' });
    }

    // Only touch fields the client actually sent (partial updates stay partial)
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (phone_number !== undefined) updates.phone_number = phone_number || null;
    if (profile_picture !== undefined) updates.profile_picture = profile_picture || null;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, message: 'No valid fields to update' });
    }

    await updateRecord('users', req.user.id, updates);
    res.json({ success: true, message: 'Profile updated successfully' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
