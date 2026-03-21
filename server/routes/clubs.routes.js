const express = require('express');
const router = express.Router();
const { authMiddleware, roleMiddleware } = require('../middleware/auth');
const parityService = require('../services/mobile-parity.service');

router.get('/', authMiddleware, async (req, res) => {
  const data = await parityService.getClubs(req.user.id);
  res.json({ success: true, data });
});

router.post('/:id/join', authMiddleware, roleMiddleware('student'), async (req, res) => {
  const data = await parityService.joinClub(req.user.id, req.params.id);
  res.json({ success: true, message: 'Club joined successfully', data });
});

router.post('/:id/leave', authMiddleware, roleMiddleware('student'), async (req, res) => {
  const data = await parityService.leaveClub(req.user.id, req.params.id);
  res.json({ success: true, message: 'Club left successfully', data });
});

module.exports = router;
