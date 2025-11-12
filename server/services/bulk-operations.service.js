/**
 * Bulk Operations Service
 * Handles bulk imports, exports, and batch operations
 */

const db = require('../database/db');
const csv = require('csv-parse');
const { stringify } = require('csv-stringify/sync');
const ExcelJS = require('exceljs');
const fs = require('fs').promises;
const path = require('path');
const bcrypt = require('bcrypt');

class BulkOperationsService {
  /**
   * Bulk create users from CSV/Excel
   * @param {string} filePath - Path to CSV/Excel file
   * @param {string} fileType - 'csv' or 'xlsx'
   * @returns {Object} Result with success count and errors
   */
  async bulkCreateUsers(filePath, fileType = 'csv') {
    const users = fileType === 'csv' 
      ? await this.parseCSV(filePath)
      : await this.parseExcel(filePath);

    const results = {
      success: 0,
      failed: 0,
      errors: []
    };

    for (const user of users) {
      try {
        // Validate required fields
        if (!user.username || !user.email || !user.role) {
          results.failed++;
          results.errors.push({
            row: user.row,
            error: 'Missing required fields (username, email, role)'
          });
          continue;
        }

        // Generate password (use provided or auto-generate)
        const password = user.password || this.generatePassword();
        const hashedPassword = await bcrypt.hash(password, 10);

        // Insert user
        const [result] = await db.query(
          `INSERT INTO users (username, email, password, full_name, role, department, year, section, phone, address)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            user.username,
            user.email,
            hashedPassword,
            user.full_name || user.username,
            user.role,
            user.department || null,
            user.year || null,
            user.section || null,
            user.phone || null,
            user.address || null
          ]
        );

        results.success++;
      } catch (error) {
        results.failed++;
        results.errors.push({
          row: user.row,
          username: user.username,
          error: error.message
        });
      }
    }

    return results;
  }

  /**
   * Bulk mark attendance from CSV
   * @param {string} filePath - Path to CSV file
   * @param {number} teacherId - ID of teacher marking attendance
   * @returns {Object} Result with success count and errors
   */
  async bulkMarkAttendance(filePath, teacherId) {
    const records = await this.parseCSV(filePath);
    
    const results = {
      success: 0,
      failed: 0,
      errors: []
    };

    for (const record of records) {
      try {
        // Validate required fields
        if (!record.student_id || !record.subject || !record.date || !record.status) {
          results.failed++;
          results.errors.push({
            row: record.row,
            error: 'Missing required fields (student_id, subject, date, status)'
          });
          continue;
        }

        // Validate status
        if (!['present', 'absent', 'late'].includes(record.status.toLowerCase())) {
          results.failed++;
          results.errors.push({
            row: record.row,
            error: 'Invalid status. Must be present, absent, or late'
          });
          continue;
        }

        // Insert attendance record
        await db.query(
          `INSERT INTO attendance (student_id, subject, date, status, marked_by, remarks)
           VALUES (?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE 
           status = VALUES(status),
           marked_by = VALUES(marked_by),
           remarks = VALUES(remarks),
           updated_at = CURRENT_TIMESTAMP`,
          [
            record.student_id,
            record.subject,
            record.date,
            record.status.toLowerCase(),
            teacherId,
            record.remarks || null
          ]
        );

        results.success++;
      } catch (error) {
        results.failed++;
        results.errors.push({
          row: record.row,
          student_id: record.student_id,
          error: error.message
        });
      }
    }

    return results;
  }

  /**
   * Bulk upload marks from Excel
   * @param {string} filePath - Path to Excel file
   * @param {number} teacherId - ID of teacher uploading marks
   * @returns {Object} Result with success count and errors
   */
  async bulkUploadMarks(filePath, teacherId) {
    const records = await this.parseExcel(filePath);
    
    const results = {
      success: 0,
      failed: 0,
      errors: []
    };

    for (const record of records) {
      try {
        // Validate required fields
        if (!record.student_id || !record.subject || !record.exam_type || 
            record.marks_obtained === undefined || record.total_marks === undefined) {
          results.failed++;
          results.errors.push({
            row: record.row,
            error: 'Missing required fields'
          });
          continue;
        }

        // Validate marks
        if (record.marks_obtained < 0 || record.marks_obtained > record.total_marks) {
          results.failed++;
          results.errors.push({
            row: record.row,
            error: 'Invalid marks value'
          });
          continue;
        }

        // Insert marks record
        await db.query(
          `INSERT INTO marks (student_id, subject, exam_type, marks_obtained, total_marks, grade, uploaded_by, remarks)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE 
           marks_obtained = VALUES(marks_obtained),
           total_marks = VALUES(total_marks),
           grade = VALUES(grade),
           uploaded_by = VALUES(uploaded_by),
           remarks = VALUES(remarks),
           updated_at = CURRENT_TIMESTAMP`,
          [
            record.student_id,
            record.subject,
            record.exam_type,
            record.marks_obtained,
            record.total_marks,
            this.calculateGrade(record.marks_obtained, record.total_marks),
            teacherId,
            record.remarks || null
          ]
        );

        results.success++;
      } catch (error) {
        results.failed++;
        results.errors.push({
          row: record.row,
          student_id: record.student_id,
          error: error.message
        });
      }
    }

    return results;
  }

  /**
   * Export data to CSV
   * @param {string} type - Type of data to export (users, attendance, marks, etc.)
   * @param {Object} filters - Filters to apply
   * @returns {string} CSV string
   */
  async exportToCSV(type, filters = {}) {
    let data = [];
    let columns = [];

    switch (type) {
      case 'users':
        [data] = await db.query(
          `SELECT id, username, email, full_name, role, department, year, section, 
                  phone, created_at FROM users 
           WHERE 1=1 ${this.buildFilterQuery(filters)}`
        );
        columns = ['id', 'username', 'email', 'full_name', 'role', 'department', 
                   'year', 'section', 'phone', 'created_at'];
        break;

      case 'attendance':
        [data] = await db.query(
          `SELECT a.id, u.username, a.subject, a.date, a.status, a.remarks,
                  t.username as marked_by, a.created_at
           FROM attendance a
           JOIN users u ON a.student_id = u.id
           LEFT JOIN users t ON a.marked_by = t.id
           WHERE 1=1 ${this.buildFilterQuery(filters)}`
        );
        columns = ['id', 'username', 'subject', 'date', 'status', 'remarks', 
                   'marked_by', 'created_at'];
        break;

      case 'marks':
        [data] = await db.query(
          `SELECT m.id, u.username, m.subject, m.exam_type, m.marks_obtained,
                  m.total_marks, m.grade, m.remarks, t.username as uploaded_by, m.created_at
           FROM marks m
           JOIN users u ON m.student_id = u.id
           LEFT JOIN users t ON m.uploaded_by = t.id
           WHERE 1=1 ${this.buildFilterQuery(filters)}`
        );
        columns = ['id', 'username', 'subject', 'exam_type', 'marks_obtained',
                   'total_marks', 'grade', 'remarks', 'uploaded_by', 'created_at'];
        break;

      default:
        throw new Error('Invalid export type');
    }

    return stringify(data, { header: true, columns });
  }

  /**
   * Export data to Excel
   * @param {string} type - Type of data to export
   * @param {Object} filters - Filters to apply
   * @returns {Buffer} Excel file buffer
   */
  async exportToExcel(type, filters = {}) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(type.charAt(0).toUpperCase() + type.slice(1));

    let data = [];
    let columns = [];

    // Get data based on type (similar to CSV export)
    switch (type) {
      case 'users':
        [data] = await db.query(
          `SELECT id, username, email, full_name, role, department, year, section, 
                  phone, created_at FROM users 
           WHERE 1=1 ${this.buildFilterQuery(filters)}`
        );
        columns = [
          { header: 'ID', key: 'id', width: 10 },
          { header: 'Username', key: 'username', width: 20 },
          { header: 'Email', key: 'email', width: 30 },
          { header: 'Full Name', key: 'full_name', width: 25 },
          { header: 'Role', key: 'role', width: 15 },
          { header: 'Department', key: 'department', width: 15 },
          { header: 'Year', key: 'year', width: 10 },
          { header: 'Section', key: 'section', width: 10 },
          { header: 'Phone', key: 'phone', width: 15 },
          { header: 'Created At', key: 'created_at', width: 20 }
        ];
        break;

      case 'attendance':
        [data] = await db.query(
          `SELECT a.id, u.username, a.subject, a.date, a.status, a.remarks,
                  t.username as marked_by, a.created_at
           FROM attendance a
           JOIN users u ON a.student_id = u.id
           LEFT JOIN users t ON a.marked_by = t.id
           WHERE 1=1 ${this.buildFilterQuery(filters)}`
        );
        columns = [
          { header: 'ID', key: 'id', width: 10 },
          { header: 'Student', key: 'username', width: 20 },
          { header: 'Subject', key: 'subject', width: 25 },
          { header: 'Date', key: 'date', width: 15 },
          { header: 'Status', key: 'status', width: 12 },
          { header: 'Remarks', key: 'remarks', width: 30 },
          { header: 'Marked By', key: 'marked_by', width: 20 },
          { header: 'Created At', key: 'created_at', width: 20 }
        ];
        break;

      case 'marks':
        [data] = await db.query(
          `SELECT m.id, u.username, m.subject, m.exam_type, m.marks_obtained,
                  m.total_marks, m.grade, m.remarks, t.username as uploaded_by, m.created_at
           FROM marks m
           JOIN users u ON m.student_id = u.id
           LEFT JOIN users t ON m.uploaded_by = t.id
           WHERE 1=1 ${this.buildFilterQuery(filters)}`
        );
        columns = [
          { header: 'ID', key: 'id', width: 10 },
          { header: 'Student', key: 'username', width: 20 },
          { header: 'Subject', key: 'subject', width: 25 },
          { header: 'Exam Type', key: 'exam_type', width: 15 },
          { header: 'Marks Obtained', key: 'marks_obtained', width: 15 },
          { header: 'Total Marks', key: 'total_marks', width: 15 },
          { header: 'Grade', key: 'grade', width: 10 },
          { header: 'Remarks', key: 'remarks', width: 30 },
          { header: 'Uploaded By', key: 'uploaded_by', width: 20 },
          { header: 'Created At', key: 'created_at', width: 20 }
        ];
        break;
    }

    worksheet.columns = columns;
    worksheet.addRows(data);

    // Style header row
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4CAF50' }
    };

    return await workbook.xlsx.writeBuffer();
  }

  /**
   * Parse CSV file
   * @private
   */
  async parseCSV(filePath) {
    const fileContent = await fs.readFile(filePath, 'utf-8');
    const records = [];
    
    return new Promise((resolve, reject) => {
      csv.parse(fileContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true
      }, (err, data) => {
        if (err) reject(err);
        else resolve(data.map((record, index) => ({ ...record, row: index + 2 })));
      });
    });
  }

  /**
   * Parse Excel file
   * @private
   */
  async parseExcel(filePath) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    
    const worksheet = workbook.worksheets[0];
    const records = [];
    const headers = [];

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) {
        // Extract headers
        row.eachCell((cell) => {
          headers.push(cell.value.toString().toLowerCase().replace(/\s+/g, '_'));
        });
      } else {
        const record = { row: rowNumber };
        row.eachCell((cell, colNumber) => {
          record[headers[colNumber - 1]] = cell.value;
        });
        records.push(record);
      }
    });

    return records;
  }

  /**
   * Build filter query from filters object
   * @private
   */
  buildFilterQuery(filters) {
    let query = '';
    
    if (filters.department) {
      query += ` AND department = '${filters.department}'`;
    }
    if (filters.year) {
      query += ` AND year = ${filters.year}`;
    }
    if (filters.section) {
      query += ` AND section = '${filters.section}'`;
    }
    if (filters.startDate && filters.endDate) {
      query += ` AND date BETWEEN '${filters.startDate}' AND '${filters.endDate}'`;
    }

    return query;
  }

  /**
   * Calculate grade based on percentage
   * @private
   */
  calculateGrade(obtained, total) {
    const percentage = (obtained / total) * 100;
    
    if (percentage >= 90) return 'A+';
    if (percentage >= 80) return 'A';
    if (percentage >= 70) return 'B+';
    if (percentage >= 60) return 'B';
    if (percentage >= 50) return 'C';
    if (percentage >= 40) return 'D';
    return 'F';
  }

  /**
   * Generate random password
   * @private
   */
  generatePassword() {
    const length = 12;
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';
    
    for (let i = 0; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    
    return password;
  }
}

module.exports = new BulkOperationsService();
