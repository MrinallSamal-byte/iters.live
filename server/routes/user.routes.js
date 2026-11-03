const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const { authMiddleware } = require('../middleware/auth');
const { updateRecord, getRecord } = require('../services/firebase-data.service');
const { revokeUserSessions } = require('../services/session-guard.service');

const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;

function isSafeProfilePictureUrl(value) {
  if (typeof value !== 'string') return false;
  if (/^https?:\/\//i.test(value)) return true;
  // Site-relative path only. "//host/x" is protocol-relative (an external URL).
  return value.startsWith('/') && !value.startsWith('//');
}

router.put('/profile', authMiddleware, async (req, res, next) => {
  try {
    const { name, phone_number, profile_picture } = req.body;

    if (name !== undefined && (typeof name !== 'string' || !name.trim() || name.trim().length > 120)) {
      return res.status(400).json({ success: false, message: 'name must be 1-120 characters' });
    }

    if (phone_number !== undefined && phone_number !== null && phone_number !== ''
      && !/^[0-9+()\-\s]{6,20}$/.test(String(phone_number))) {
      return res.status(400).json({ success: false, message: 'phone_number must be 6-20 digits (+, -, spaces and brackets allowed)' });
    }

    if (profile_picture !== undefined && profile_picture !== '' && profile_picture !== null
      && !isSafeProfilePictureUrl(profile_picture)) {
      return res.status(400).json({ success: false, message: 'profile_picture must be an http(s) URL or a /path' });
    }

    // Only touch fields the client actually sent (partial updates stay partial)
    const updates = {};
    if (name !== undefined) updates.name = name.trim();
    if (phone_number !== undefined) updates.phone_number = phone_number ? String(phone_number).trim() : null;
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

router.put('/password', authMiddleware, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!newPassword || typeof newPassword !== 'string'
      || newPassword.length < MIN_PASSWORD_LENGTH || newPassword.length > MAX_PASSWORD_LENGTH) {
      return res.status(400).json({
        success: false,
        message: `New password must be ${MIN_PASSWORD_LENGTH}-${MAX_PASSWORD_LENGTH} characters`
      });
    }

    const user = await getRecord('users', req.user.id);

    // Login, registration and admin user creation all store the bcrypt hash in
    // `password`. `password_hash` is accepted only for records written by older
    // builds of this endpoint.
    const storedHash = user && (typeof user.password === 'string' && user.password
      ? user.password
      : (typeof user.password_hash === 'string' ? user.password_hash : null));

    if (!storedHash) {
      return res.status(400).json({ success: false, message: 'This account uses Google Sign-In' });
    }

    const isMatch = await bcrypt.compare(typeof currentPassword === 'string' ? currentPassword : '', storedHash);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect' });
    }

    if (await bcrypt.compare(newPassword, storedHash)) {
      return res.status(400).json({ success: false, message: 'New password must be different from the current password' });
    }

    const newHash = await bcrypt.hash(newPassword, 12);
    await updateRecord('users', req.user.id, { password: newHash, password_hash: null });

    // A password change must end every other session (a stolen token should not
    // survive it). The caller signs in again with the new password.
    const revokedAt = await revokeUserSessions(req.user.id);

    res.json({
      success: true,
      message: 'Password updated. Please sign in again on all devices.',
      data: { revokedAt }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
