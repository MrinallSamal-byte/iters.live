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
      page: parseInt(page) || 1,
      pageSize: parseInt(pageSize) || 20
    });

    if (!result.success) {
      return res.status(500).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get notifications',
      error: error.message
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
      return res.status(500).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get unread count',
      error: error.message
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
      return res.status(500).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error('Get notification stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get notification statistics',
      error: error.message
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
      parseInt(req.params.id),
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
      message: 'Failed to mark notification as read',
      error: error.message
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
      return res.status(500).json(result);
    }

    res.json({
      success: true,
      message: `Marked ${result.count} notifications as read`
    });
  } catch (error) {
    console.error('Mark all as read error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark all notifications as read',
      error: error.message
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
      parseInt(req.params.id),
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
      message: 'Failed to delete notification',
      error: error.message
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
      return res.status(500).json(result);
    }

    res.json({
      success: true,
      message: `Deleted ${result.count} notifications`
    });
  } catch (error) {
    console.error('Delete read notifications error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete read notifications',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/notifications/test
 * @desc    Send test notification (for testing)
 * @access  Private
 */
router.post('/test', auth, async (req, res) => {
  try {
    const result = await notificationService.create({
      userId: req.user.id,
      title: 'Test Notification',
      message: 'This is a test notification from the system',
      type: 'info',
      link: null,
      metadata: { test: true }
    });

    res.json(result);
  } catch (error) {
    console.error('Send test notification error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send test notification',
      error: error.message
    });
  }
});

module.exports = router;
