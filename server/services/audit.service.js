const db = require('../database/db');
const fs = require('fs').promises;
const path = require('path');

/**
 * Audit logging service for tracking sensitive operations
 */

class AuditLogger {
  constructor() {
    this.logDir = path.join(__dirname, '../../logs');
    this.initLogDirectory();
  }

  async initLogDirectory() {
    try {
      await fs.mkdir(this.logDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create log directory:', error);
    }
  }

  /**
   * Log an audit event to database and file
   * @param {Object} data - Audit log data
   * @param {number} data.userId - User performing the action
   * @param {string} data.action - Action performed
   * @param {string} data.resource - Resource affected
   * @param {number} data.resourceId - ID of affected resource
   * @param {string} data.ipAddress - IP address of request
   * @param {string} data.userAgent - User agent string
   * @param {Object} data.metadata - Additional metadata
   * @param {string} data.status - success or failure
   */
  async log(data) {
    const {
      userId,
      action,
      resource,
      resourceId = null,
      ipAddress = null,
      userAgent = null,
      metadata = {},
      status = 'success'
    } = data;

    try {
      // Log to database
      await db.query(
        `INSERT INTO audit_logs 
        (user_id, action, resource, resource_id, ip_address, user_agent, metadata, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          userId,
          action,
          resource,
          resourceId,
          ipAddress,
          userAgent,
          JSON.stringify(metadata),
          status
        ]
      );

      // Log to file for backup
      await this.logToFile({
        timestamp: new Date().toISOString(),
        userId,
        action,
        resource,
        resourceId,
        ipAddress,
        status,
        metadata
      });
    } catch (error) {
      console.error('Audit logging failed:', error);
      // Don't throw error to avoid breaking the main operation
    }
  }

  /**
   * Log to daily file
   */
  async logToFile(logData) {
    try {
      const date = new Date().toISOString().split('T')[0];
      const logFile = path.join(this.logDir, `audit-${date}.log`);
      const logLine = JSON.stringify(logData) + '\n';
      
      await fs.appendFile(logFile, logLine);
    } catch (error) {
      console.error('File logging failed:', error);
    }
  }

  /**
   * Get audit logs with filters
   */
  async getLogs(filters = {}) {
    const {
      userId,
      action,
      resource,
      status,
      startDate,
      endDate,
      page = 1,
      pageSize = 50
    } = filters;

    let query = `
      SELECT 
        al.*,
        u.name as user_name,
        u.registration_number,
        u.role
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (userId) {
      query += ' AND al.user_id = ?';
      params.push(userId);
    }

    if (action) {
      query += ' AND al.action = ?';
      params.push(action);
    }

    if (resource) {
      query += ' AND al.resource = ?';
      params.push(resource);
    }

    if (status) {
      query += ' AND al.status = ?';
      params.push(status);
    }

    if (startDate) {
      query += ' AND al.created_at >= ?';
      params.push(startDate);
    }

    if (endDate) {
      query += ' AND al.created_at <= ?';
      params.push(endDate);
    }

    // Add pagination
    query += ' ORDER BY al.created_at DESC LIMIT ? OFFSET ?';
    params.push(pageSize, (page - 1) * pageSize);

  const logs = await db.query(query, params);

    // Get total count
    let countQuery = 'SELECT COUNT(*) as total FROM audit_logs WHERE 1=1';
    const countParams = [];

    if (userId) {
      countQuery += ' AND user_id = ?';
      countParams.push(userId);
    }
    if (action) {
      countQuery += ' AND action = ?';
      countParams.push(action);
    }
    if (resource) {
      countQuery += ' AND resource = ?';
      countParams.push(resource);
    }
    if (status) {
      countQuery += ' AND status = ?';
      countParams.push(status);
    }
    if (startDate) {
      countQuery += ' AND created_at >= ?';
      countParams.push(startDate);
    }
    if (endDate) {
      countQuery += ' AND created_at <= ?';
      countParams.push(endDate);
    }

  const totalRows = await db.query(countQuery, countParams);
  const total = totalRows[0]?.total || 0;

    return {
      logs,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize)
      }
    };
  }

  /**
   * Get user activity summary
   */
  async getUserActivitySummary(userId, days = 30) {
    const summary = await db.query(
      `SELECT 
        action,
        resource,
        COUNT(*) as count,
        MAX(created_at) as last_activity
      FROM audit_logs
      WHERE user_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
      GROUP BY action, resource
      ORDER BY count DESC`,
      [userId, days]
    );

    return summary;
  }

  /**
   * Get system activity statistics
   */
  async getSystemStats(days = 7) {
    const stats = await db.query(
      `SELECT 
        DATE(created_at) as date,
        COUNT(*) as total_actions,
        COUNT(DISTINCT user_id) as active_users,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful_actions,
        SUM(CASE WHEN status = 'failure' THEN 1 ELSE 0 END) as failed_actions
      FROM audit_logs
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
      GROUP BY DATE(created_at)
      ORDER BY date DESC`,
      [days]
    );

    return stats;
  }

  /**
   * Detect suspicious activity
   */
  async detectSuspiciousActivity(userId, timeWindowMinutes = 5) {
    const activity = await db.query(
      `SELECT 
        action,
        COUNT(*) as count,
        COUNT(DISTINCT ip_address) as unique_ips
      FROM audit_logs
      WHERE user_id = ? 
        AND created_at >= DATE_SUB(NOW(), INTERVAL ? MINUTE)
      GROUP BY action
      HAVING count > 50`,
      [userId, timeWindowMinutes]
    );

    return activity;
  }

  /**
   * Clean old logs (keep last 90 days)
   */
  async cleanOldLogs(daysToKeep = 90) {
    try {
      const [result] = await db.query(
        'DELETE FROM audit_logs WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)',
        [daysToKeep]
      );

      return {
        success: true,
        deletedCount: result.affectedRows
      };
    } catch (error) {
      console.error('Failed to clean old logs:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

// Export singleton instance
module.exports = new AuditLogger();
