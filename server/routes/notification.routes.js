const express = require('express');
const router = express.Router();
const { authMiddleware: auth } = require('../middleware/auth');
const notificationService = require('../services/notification.service');

/**
 * @route   GET /api/notifications
 * @desc    Get notifications for authenticated user
 * @access  Private
 */
router.get('/', auth, async (req, res) => {
  try {
    const { isRead, type, page, pageSize } = req.query;

    const result = await notificationService.getForUser(req.user.id, {
      isRead: isRead === 'true' ? true : isRead === 'false' ? false : null,
      type,
      // Clamp: a negative page would slice from the end of the list and a huge
      // pageSize would defeat pagination altogether.
      page: Math.max(1, parseInt(page, 10) || 1),
      pageSize: Math.min(100, Math.max(1, parseInt(pageSize, 10) || 20))
    });

    if (!result.success) {
      return res.status(500).json({ success: false, message: 'Notification service is temporarily unavailable' });
    }

    res.json(result);
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get notifications'
    });
  }
});

/**
 * @route   GET /api/notifications/unread-count
 * @desc    Get unread notification count
 * @access  Private
 */
router.get('/unread-count', auth, async (req, res) => {
  try {
    const result = await notificationService.getUnreadCount(req.user.id);

    if (!result.success) {
      return res.status(500).json({ success: false, message: 'Notification service is temporarily unavailable' });
    }

    res.json(result);
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get unread count'
    });
  }
});

/**
 * @route   GET /api/notifications/stats
 * @desc    Get notification statistics
 * @access  Private
 */
router.get('/stats', auth, async (req, res) => {
  try {
    const result = await notificationService.getStats(req.user.id);

    if (!result.success) {
      return res.status(500).json({ success: false, message: 'Notification service is temporarily unavailable' });
    }

    res.json(result);
  } catch (error) {
    console.error('Get notification stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get notification statistics'
    });
  }
});

/**
 * @route   PUT /api/notifications/:id/read
 * @desc    Mark notification as read
 * @access  Private
 */
router.put('/:id/read', auth, async (req, res) => {
  try {
    const result = await notificationService.markAsRead(
      req.params.id,
      req.user.id
    );

    if (!result.success) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    res.json({
      success: true,
      message: 'Notification marked as read'
    });
  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark notification as read'
    });
  }
});

/**
 * @route   PUT /api/notifications/read-all
 * @desc    Mark all notifications as read
 * @access  Private
 */
router.put('/read-all', auth, async (req, res) => {
  try {
    const result = await notificationService.markAllAsRead(req.user.id);

    if (!result.success) {
      return res.status(500).json({ success: false, message: 'Notification service is temporarily unavailable' });
    }

    res.json({
      success: true,
      message: `Marked ${result.count} notifications as read`
    });
  } catch (error) {
    console.error('Mark all as read error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark all notifications as read'
    });
  }
});

/**
 * @route   DELETE /api/notifications/:id
 * @desc    Delete notification
 * @access  Private
 */
router.delete('/:id', auth, async (req, res) => {
  try {
    const result = await notificationService.delete(
      req.params.id,
      req.user.id
    );

    if (!result.success) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    res.json({
      success: true,
      message: 'Notification deleted'
    });
  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete notification'
    });
  }
});

/**
 * @route   DELETE /api/notifications/read
 * @desc    Delete all read notifications
 * @access  Private
 */
router.delete('/read/all', auth, async (req, res) => {
  try {
    const result = await notificationService.deleteAllRead(req.user.id);

    if (!result.success) {
      return res.status(500).json({ success: false, message: 'Notification service is temporarily unavailable' });
    }

    res.json({
      success: true,
      message: `Deleted ${result.count} notifications`
    });
  } catch (error) {
    console.error('Delete read notifications error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete read notifications'
    });
  }
});

module.exports = router;
