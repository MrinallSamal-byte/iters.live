const express = require('express');
const router = express.Router();
const { authMiddleware, roleMiddleware } = require('../middleware/auth');
const parityService = require('../services/mobile-parity.service');

router.get('/public', async (req, res) => {
  res.json({
    success: true,
    data: parityService.buildPublicContent()
  });
});

router.get('/snapshot', authMiddleware, async (req, res) => {
  const data = await parityService.buildSnapshot(req.user);
  res.json({ success: true, data });
});

router.get('/clubs', authMiddleware, async (req, res) => {
  const data = await parityService.getClubs(req.user.id);
  res.json({ success: true, data });
});

router.post('/clubs/:id/join', authMiddleware, roleMiddleware('student'), async (req, res) => {
  const data = await parityService.joinClub(req.user.id, req.params.id);
  res.json({ success: true, message: 'Club joined successfully', data });
});

router.post('/clubs/:id/leave', authMiddleware, roleMiddleware('student'), async (req, res) => {
  const data = await parityService.leaveClub(req.user.id, req.params.id);
  res.json({ success: true, message: 'Club left successfully', data });
});

router.get('/teacher/students', authMiddleware, roleMiddleware('teacher', 'admin'), async (req, res) => {
  const data = await parityService.getTeacherStudents(req.user);
  res.json({ success: true, data });
});

router.get('/admin/announcements', authMiddleware, roleMiddleware('admin'), async (req, res) => {
  const data = await parityService.getAnnouncements();
  res.json({ success: true, data });
});

router.post('/admin/announcements', authMiddleware, roleMiddleware('admin'), async (req, res) => {
  const data = await parityService.createAnnouncement(req.body, req.user);
  res.status(201).json({ success: true, data });
});

router.get('/admin/settings', authMiddleware, roleMiddleware('admin'), async (req, res) => {
  const data = await parityService.getSettings();
  res.json({ success: true, data });
});

router.put('/admin/settings', authMiddleware, roleMiddleware('admin'), async (req, res) => {
  const data = await parityService.updateSettings(req.body);
  res.json({ success: true, data });
});

module.exports = router;
