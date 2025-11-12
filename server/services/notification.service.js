const db = require('../database/db');

/**
 * Comprehensive notification service
 * Handles in-app, email, SMS, and push notifications
 */

class NotificationService {
  /**
   * Create a new notification
   */
  async create(data) {
    const {
      userId,
      title,
      message,
      type = 'info',
      link = null,
      metadata = {}
    } = data;

    try {
      const [result] = await db.query(
        `INSERT INTO notifications (user_id, title, message, type, link, metadata)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [userId, title, message, type, link, JSON.stringify(metadata)]
      );

      const notification = {
        id: result.insertId,
        userId,
        title,
        message,
        type,
        link,
        metadata,
        isRead: false,
        createdAt: new Date()
      };

      // Emit real-time notification via Socket.IO
      await this.emitRealTime(userId, notification);

      return {
        success: true,
        notification
      };
    } catch (error) {
      console.error('Failed to create notification:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Create bulk notifications for multiple users
   */
  async createBulk(users, data) {
    const { title, message, type = 'info', link = null, metadata = {} } = data;

    try {
      const values = users.map(userId => [
        userId,
        title,
        message,
        type,
        link,
        JSON.stringify(metadata)
      ]);

      const [result] = await db.query(
        `INSERT INTO notifications (user_id, title, message, type, link, metadata)
         VALUES ?`,
        [values]
      );

      // Emit real-time notifications
      for (const userId of users) {
        await this.emitRealTime(userId, {
          title,
          message,
          type,
          link,
          metadata
        });
      }

      return {
        success: true,
        count: result.affectedRows
      };
    } catch (error) {
      console.error('Failed to create bulk notifications:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get notifications for a user
   */
  async getForUser(userId, options = {}) {
    const {
      isRead = null,
      type = null,
      page = 1,
      pageSize = 20
    } = options;

    let query = 'SELECT * FROM notifications WHERE user_id = ?';
    const params = [userId];

    if (isRead !== null) {
      query += ' AND is_read = ?';
      params.push(isRead);
    }

    if (type) {
      query += ' AND type = ?';
      params.push(type);
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(pageSize, (page - 1) * pageSize);

    try {
  const notifications = await db.query(query, params);

      // Get unread count
      const unreadRows = await db.query(
        'SELECT COUNT(*) as unreadCount FROM notifications WHERE user_id = ? AND is_read = FALSE',
        [userId]
      );
      const unreadCount = unreadRows[0]?.unreadCount || 0;

      // Get total count
      let countQuery = 'SELECT COUNT(*) as total FROM notifications WHERE user_id = ?';
      const countParams = [userId];

      if (isRead !== null) {
        countQuery += ' AND is_read = ?';
        countParams.push(isRead);
      }

      if (type) {
        countQuery += ' AND type = ?';
        countParams.push(type);
      }

  const totalRows = await db.query(countQuery, countParams);
  const total = totalRows[0]?.total || 0;

      return {
        success: true,
        notifications: notifications.map(n => ({
          ...n,
          metadata: JSON.parse(n.metadata || '{}')
        })),
        unreadCount,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize)
        }
      };
    } catch (error) {
      console.error('Failed to get notifications:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId, userId) {
    try {
      const result = await db.query(
        'UPDATE notifications SET is_read = TRUE, read_at = NOW() WHERE id = ? AND user_id = ?',
        [notificationId, userId]
      );

      return {
        success: result.affectedRows > 0
      };
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId) {
    try {
      const result = await db.query(
        'UPDATE notifications SET is_read = TRUE, read_at = NOW() WHERE user_id = ? AND is_read = FALSE',
        [userId]
      );

      return {
        success: true,
        count: result.affectedRows
      };
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Delete notification
   */
  async delete(notificationId, userId) {
    try {
      const result = await db.query(
        'DELETE FROM notifications WHERE id = ? AND user_id = ?',
        [notificationId, userId]
      );

      return {
        success: result.affectedRows > 0
      };
    } catch (error) {
      console.error('Failed to delete notification:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Delete all read notifications for a user
   */
  async deleteAllRead(userId) {
    try {
      const result = await db.query(
        'DELETE FROM notifications WHERE user_id = ? AND is_read = TRUE',
        [userId]
      );

      return {
        success: true,
        count: result.affectedRows
      };
    } catch (error) {
      console.error('Failed to delete read notifications:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get unread count for a user
   */
  async getUnreadCount(userId) {
    try {
      const countRows = await db.query(
        'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = FALSE',
        [userId]
      );
      const count = countRows[0]?.count || 0;

      return {
        success: true,
        count
      };
    } catch (error) {
      console.error('Failed to get unread count:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Emit real-time notification via Socket.IO
   */
  async emitRealTime(userId, notification) {
    try {
      // This will be injected by the route/controller
      if (global.io) {
        global.io.to(`user:${userId}`).emit('notification:new', notification);
      }
    } catch (error) {
      console.error('Failed to emit real-time notification:', error);
    }
  }

  /**
   * Send email notification (placeholder for nodemailer integration)
   */
  async sendEmail(userId, data) {
    // TODO: Implement with nodemailer
    console.log(`Email notification to user ${userId}:`, data);
    return { success: true, method: 'email' };
  }

  /**
   * Send SMS notification (placeholder for Twilio integration)
   */
  async sendSMS(userId, data) {
    // TODO: Implement with Twilio
    console.log(`SMS notification to user ${userId}:`, data);
    return { success: true, method: 'sms' };
  }

  /**
   * Send push notification (placeholder for Web Push API)
   */
  async sendPush(userId, data) {
    // TODO: Implement with Web Push API
    console.log(`Push notification to user ${userId}:`, data);
    return { success: true, method: 'push' };
  }

  /**
   * Send notification via all enabled channels
   */
  async sendMultiChannel(userId, data) {
    const results = {
      inApp: await this.create({ userId, ...data }),
      email: null,
      sms: null,
      push: null
    };

    // Check user preferences
    try {
      const preferencesRows = await db.query(
        'SELECT email_notifications, sms_notifications, push_notifications FROM user_preferences WHERE user_id = ?',
        [userId]
      );

      const preferences = preferencesRows[0];
      if (preferences) {
        if (preferences.email_notifications) {
          results.email = await this.sendEmail(userId, data);
        }
        if (preferences.sms_notifications) {
          results.sms = await this.sendSMS(userId, data);
        }
        if (preferences.push_notifications) {
          results.push = await this.sendPush(userId, data);
        }
      }
    } catch (error) {
      console.error('Failed to send multi-channel notification:', error);
    }

    return results;
  }

  /**
   * Clean old notifications (keep last 90 days)
   */
  async cleanOld(daysToKeep = 90) {
    try {
      const result = await db.query(
        'DELETE FROM notifications WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY) AND is_read = TRUE',
        [daysToKeep]
      );

      return {
        success: true,
        deletedCount: result.affectedRows
      };
    } catch (error) {
      console.error('Failed to clean old notifications:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get notification statistics
   */
  async getStats(userId) {
    try {
      const statsRows = await db.query(
        `SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN is_read = FALSE THEN 1 ELSE 0 END) as unread,
          SUM(CASE WHEN is_read = TRUE THEN 1 ELSE 0 END) as read,
          COUNT(CASE WHEN type = 'attendance' THEN 1 END) as attendance,
          COUNT(CASE WHEN type = 'marks' THEN 1 END) as marks,
          COUNT(CASE WHEN type = 'assignment' THEN 1 END) as assignment,
          COUNT(CASE WHEN type = 'event' THEN 1 END) as event,
          COUNT(CASE WHEN type = 'announcement' THEN 1 END) as announcement
        FROM notifications
        WHERE user_id = ?`,
        [userId]
      );

      return {
        success: true,
        stats: statsRows[0] || { total: 0, unread: 0, read: 0, attendance: 0, marks: 0, assignment: 0, event: 0, announcement: 0 }
      };
    } catch (error) {
      console.error('Failed to get notification stats:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = new NotificationService();
