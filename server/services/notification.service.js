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
      const rows = await db.query(
        `INSERT INTO notifications (user_id, title, message, type, link, metadata)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, user_id, title, message, type, link, metadata, is_read, created_at`,
        [userId, title, message, type, link, JSON.stringify(metadata)]
      );
      const row = rows[0];

      const notification = {
        id: row?.id,
        userId: row?.user_id || userId,
        title: row?.title || title,
        message: row?.message || message,
        type: row?.type || type,
        link: row?.link || link,
        metadata,
        isRead: row?.is_read || false,
        createdAt: row?.created_at || new Date()
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
    const results = await Promise.all(users.map((userId) => this.create({ userId, ...data })));
    const successCount = results.filter((result) => result.success).length;

    return {
      success: successCount === users.length,
      count: successCount,
      error: successCount === users.length ? null : 'One or more notifications failed to create'
    };
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

    let sql = 'SELECT * FROM notifications WHERE user_id = $1';
    const params = [userId];
    let nextParam = 2;

    if (isRead !== null) {
      sql += ` AND is_read = $${nextParam++}`;
      params.push(isRead);
    }

    if (type) {
      sql += ` AND type = $${nextParam++}`;
      params.push(type);
    }

    sql += ` ORDER BY created_at DESC LIMIT $${nextParam++} OFFSET $${nextParam++}`;
    params.push(pageSize, (page - 1) * pageSize);

    try {
      const notifications = await db.query(sql, params);

      // Get unread count
      const unreadRows = await db.query(
        'SELECT COUNT(*) as unreadCount FROM notifications WHERE user_id = $1 AND is_read = FALSE',
        [userId]
      );
      const unreadCount = Number(unreadRows[0]?.unreadcount || unreadRows[0]?.unreadCount || 0);

      // Get total count
      let countSql = 'SELECT COUNT(*) as total FROM notifications WHERE user_id = $1';
      const countParams = [userId];
      nextParam = 2;

      if (isRead !== null) {
        countSql += ` AND is_read = $${nextParam++}`;
        countParams.push(isRead);
      }

      if (type) {
        countSql += ` AND type = $${nextParam++}`;
        countParams.push(type);
      }

      const totalRows = await db.query(countSql, countParams);
      const total = Number(totalRows[0]?.total || 0);

      return {
        success: true,
        notifications: notifications.map((n) => ({
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
      const rows = await db.query(
        'UPDATE notifications SET is_read = TRUE, read_at = NOW() WHERE id = $1 AND user_id = $2 RETURNING id',
        [notificationId, userId]
      );

      return {
        success: rows.length > 0
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
      const rows = await db.query(
        'UPDATE notifications SET is_read = TRUE, read_at = NOW() WHERE user_id = $1 AND is_read = FALSE RETURNING id',
        [userId]
      );

      return {
        success: true,
        count: rows.length
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
      const rows = await db.query(
        'DELETE FROM notifications WHERE id = $1 AND user_id = $2 RETURNING id',
        [notificationId, userId]
      );

      return {
        success: rows.length > 0
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
      const rows = await db.query(
        'DELETE FROM notifications WHERE user_id = $1 AND is_read = TRUE RETURNING id',
        [userId]
      );

      return {
        success: true,
        count: rows.length
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
        'SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND is_read = FALSE',
        [userId]
      );
      const count = Number(countRows[0]?.count || 0);

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
