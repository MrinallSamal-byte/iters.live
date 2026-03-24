const {
  countRecords,
  createRecord,
  deleteRecord,
  getRecord,
  listRecords,
  updateRecord
} = require('./firebase-data.service');
const { emitToUser } = require('../socket/socket');

class NotificationService {
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
      const record = await createRecord('notifications', {
        user_id: userId,
        title,
        message,
        type,
        link,
        metadata,
        is_read: false,
        read_at: null
      });

      const notification = this.toClientShape(record);
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

  async createBulk(users, data) {
    const results = await Promise.all(users.map((userId) => this.create({ userId, ...data })));
    const successCount = results.filter((result) => result.success).length;

    return {
      success: successCount === users.length,
      count: successCount,
      error: successCount === users.length ? null : 'One or more notifications failed to create'
    };
  }

  async getForUser(userId, options = {}) {
    const {
      isRead = null,
      type = null,
      page = 1,
      pageSize = 20
    } = options;

    try {
      const filters = [{ field: 'user_id', value: userId }];
      if (isRead !== null) filters.push({ field: 'is_read', value: isRead });
      if (type) filters.push({ field: 'type', value: type });

      const all = await listRecords('notifications', {
        filters,
        orderBy: [{ field: 'created_at', direction: 'desc' }]
      });
      const unreadCount = await countRecords('notifications', {
        filters: [
          { field: 'user_id', value: userId },
          { field: 'is_read', value: false }
        ]
      });

      const start = (page - 1) * pageSize;
      const notifications = all.slice(start, start + pageSize).map((record) => this.toClientShape(record));

      return {
        success: true,
        notifications,
        unreadCount,
        pagination: {
          page,
          pageSize,
          total: all.length,
          totalPages: Math.ceil(all.length / pageSize)
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

  async markAsRead(notificationId, userId) {
    try {
      const notification = await getRecord('notifications', notificationId);
      if (!notification || notification.user_id !== userId) {
        return { success: false };
      }

      await updateRecord('notifications', notificationId, {
        is_read: true,
        read_at: new Date().toISOString()
      });

      return { success: true };
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async markAllAsRead(userId) {
    try {
      const notifications = await listRecords('notifications', {
        filters: [
          { field: 'user_id', value: userId },
          { field: 'is_read', value: false }
        ]
      });

      await Promise.all(notifications.map((notification) => updateRecord('notifications', notification.id, {
        is_read: true,
        read_at: new Date().toISOString()
      })));

      return {
        success: true,
        count: notifications.length
      };
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async delete(notificationId, userId) {
    try {
      const notification = await getRecord('notifications', notificationId);
      if (!notification || notification.user_id !== userId) {
        return { success: false };
      }

      await deleteRecord('notifications', notificationId);
      return { success: true };
    } catch (error) {
      console.error('Failed to delete notification:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async deleteAllRead(userId) {
    try {
      const notifications = await listRecords('notifications', {
        filters: [
          { field: 'user_id', value: userId },
          { field: 'is_read', value: true }
        ]
      });

      await Promise.all(notifications.map((notification) => deleteRecord('notifications', notification.id)));
      return {
        success: true,
        count: notifications.length
      };
    } catch (error) {
      console.error('Failed to delete read notifications:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getUnreadCount(userId) {
    try {
      const count = await countRecords('notifications', {
        filters: [
          { field: 'user_id', value: userId },
          { field: 'is_read', value: false }
        ]
      });

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

  async emitRealTime(userId, notification) {
    try {
      emitToUser(userId, 'notification:new', notification);
    } catch (error) {
      console.error('Failed to emit real-time notification:', error);
    }
  }

  async sendEmail(userId, data) {
    console.log(`Email notification to user ${userId}:`, data);
    return { success: true };
  }

  async sendSMS(userId, data) {
    console.log(`SMS notification to user ${userId}:`, data);
    return { success: true };
  }

  async sendPush(userId, data) {
    console.log(`Push notification to user ${userId}:`, data);
    return { success: true };
  }

  async sendMultiChannel(userId, data) {
    try {
      const result = await this.create({
        userId,
        title: data.title,
        message: data.message,
        type: data.type,
        link: data.link,
        metadata: data.metadata
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to create in-app notification');
      }

      return { success: true };
    } catch (error) {
      console.error('Failed to send multi-channel notification:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async cleanOld(days = 90) {
    try {
      const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
      const notifications = await listRecords('notifications', {
        filters: [{ field: 'is_read', value: true }]
      });
      const stale = notifications.filter((notification) => Date.parse(notification.created_at || '') < cutoff);
      await Promise.all(stale.map((notification) => deleteRecord('notifications', notification.id)));

      return {
        success: true,
        count: stale.length
      };
    } catch (error) {
      console.error('Failed to clean old notifications:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getStats(userId) {
    try {
      const notifications = await listRecords('notifications', {
        filters: [{ field: 'user_id', value: userId }]
      });

      const stats = notifications.reduce((acc, notification) => {
        acc.total += 1;
        if (!notification.is_read) acc.unread += 1;
        acc.byType[notification.type] = (acc.byType[notification.type] || 0) + 1;
        return acc;
      }, {
        total: 0,
        unread: 0,
        byType: {}
      });

      return {
        success: true,
        data: stats
      };
    } catch (error) {
      console.error('Failed to get notification stats:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  toClientShape(record) {
    return {
      id: record.id,
      user_id: record.user_id,
      title: record.title,
      message: record.message,
      type: record.type || 'info',
      link: record.link || null,
      metadata: record.metadata || {},
      is_read: record.is_read === true,
      created_at: record.created_at || new Date().toISOString(),
      read_at: record.read_at || null
    };
  }
}

module.exports = new NotificationService();
