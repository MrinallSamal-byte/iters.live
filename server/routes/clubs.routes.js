const express = require('express');
const router = express.Router();
const asyncHandler = require('../utils/async-handler');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');
const parityService = require('../services/mobile-parity.service');

router.get('/', authMiddleware, asyncHandler(async (req, res) => {
  const data = await parityService.getClubs(req.user.id);
  res.json({ success: true, data });
}));

router.post('/:id/join', authMiddleware, roleMiddleware('student'), asyncHandler(async (req, res) => {
  const data = await parityService.joinClub(req.user.id, req.params.id);
  res.json({ success: true, message: 'Club joined successfully', data });
}));

router.post('/:id/leave', authMiddleware, roleMiddleware('student'), asyncHandler(async (req, res) => {
  const data = await parityService.leaveClub(req.user.id, req.params.id);
  res.json({ success: true, message: 'Club left successfully', data });
}));

module.exports = router;
