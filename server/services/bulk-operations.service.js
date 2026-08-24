/**
 * Bulk Operations Service
 * Handles bulk imports, exports, and batch operations
 */

const csv = require('csv-parse');
const { stringify } = require('csv-stringify/sync');
const ExcelJS = require('exceljs');
const fs = require('fs').promises;
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const {
  createRecord,
  listRecords,
  updateRecord
} = require('./firebase-data.service');

class BulkOperationsService {
  async bulkCreateUsers(filePath, fileType = 'csv') {
    const users = fileType === 'csv'
      ? await this.parseCSV(filePath)
      : await this.parseExcel(filePath);

    const results = {
      success: 0,
      failed: 0,
      errors: [],
      credentials: []
    };

    const existingUsers = await listRecords('users');
    const existingUserIds = new Map(existingUsers.map((user) => [String(user.id), user]));

    for (const user of users) {
      try {
        if (!user.username || !user.email || !user.role) {
          throw new Error('Missing required fields (username, email, role)');
        }

        // ponytail: per-row role gate -> shared validator if more import types need it
        const role = String(user.role).trim().toLowerCase();
        if (!['student', 'teacher', 'admin'].includes(role)) {
          throw new Error('Invalid role. Must be student, teacher, or admin');
        }

        const registrationNumber = String(user.registration_number || user.username).trim();
        if (existingUserIds.has(registrationNumber)) {
          throw new Error('User already exists');
        }

        const password = user.password || this.generatePassword();
        const hashedPassword = await bcrypt.hash(password, 10);

        await createRecord('users', {
          username: user.username,
          name: user.full_name || user.name || user.username,
          email: user.email,
          password: hashedPassword,
          full_name: user.full_name || user.name || user.username,
          role,
          department: user.department || null,
          year: user.year ? Number(user.year) : null,
          section: user.section || null,
          phone: user.phone || null,
          phone_number: user.phone || null,
          address: user.address || null,
          registration_number: registrationNumber,
          is_active: true,
          last_login: null
        }, { id: registrationNumber });

        if (!user.password) {
          results.credentials.push({
            username: user.username,
            email: user.email,
            temporary_password: password
          });
        }

        results.success += 1;
      } catch (error) {
        results.failed += 1;
        results.errors.push({
          row: user.row,
          username: user.username,
          error: error.message
        });
      }
    }

    return results;
  }

  async bulkMarkAttendance(filePath, teacherId, fileType = 'csv') {
    // ponytail: extension sniffing duplicated per import -> shared parse dispatch if a 4th import lands
    const records = fileType === 'csv'
      ? await this.parseCSV(filePath)
      : await this.parseExcel(filePath);
    const results = {
      success: 0,
      failed: 0,
      errors: []
    };

    const existingAttendance = await listRecords('attendance');
    const attendanceByKey = new Map(existingAttendance.map((row) => [`${row.student_id}_${row.subject}_${row.date}`, row]));

    for (const record of records) {
      try {
        if (!record.student_id || !record.subject || !record.date || !record.status) {
          throw new Error('Missing required fields (student_id, subject, date, status)');
        }

        const status = String(record.status).toLowerCase();
        if (!['present', 'absent', 'late'].includes(status)) {
          throw new Error('Invalid status. Must be present, absent, or late');
        }

        const existing = attendanceByKey.get(`${record.student_id}_${record.subject}_${record.date}`);

        const payload = {
          student_id: String(record.student_id),
          subject: record.subject,
          date: record.date,
          status,
          marked_by: teacherId,
          remarks: record.remarks || null
        };

        if (existing) {
          await updateRecord('attendance', existing.id, payload);
        } else {
          await createRecord('attendance', payload);
        }

        results.success += 1;
      } catch (error) {
        results.failed += 1;
        results.errors.push({
          row: record.row,
          student_id: record.student_id,
          error: error.message
        });
      }
    }

    return results;
  }

  async bulkUploadMarks(filePath, teacherId, fileType = 'csv') {
    const records = fileType === 'csv'
      ? await this.parseCSV(filePath)
      : await this.parseExcel(filePath);
    const results = {
      success: 0,
      failed: 0,
      errors: []
    };

    const existingMarks = await listRecords('marks');
    const marksByKey = new Map(existingMarks.map((row) => [`${row.student_id}_${row.subject}_${row.exam_type}`, row]));

    for (const record of records) {
      try {
        if (!record.student_id || !record.subject || !record.exam_type ||
            record.marks_obtained === undefined || record.total_marks === undefined) {
          throw new Error('Missing required fields');
        }

        const marksObtained = Number(record.marks_obtained);
        const totalMarks = Number(record.total_marks);
        if (!Number.isFinite(marksObtained) || !Number.isFinite(totalMarks) || marksObtained < 0 || marksObtained > totalMarks) {
          throw new Error('Invalid marks value');
        }

        const existing = marksByKey.get(`${record.student_id}_${record.subject}_${record.exam_type}`);

        const payload = {
          student_id: String(record.student_id),
          subject: record.subject,
          exam_type: record.exam_type,
          marks_obtained: marksObtained,
          total_marks: totalMarks,
          grade: this.calculateGrade(marksObtained, totalMarks),
          uploaded_by: teacherId,
          remarks: record.remarks || null,
          exam_date: record.exam_date || record.date || new Date().toISOString().slice(0, 10)
        };

        if (existing) {
          await updateRecord('marks', existing.id, payload);
        } else {
          await createRecord('marks', payload);
        }

        results.success += 1;
      } catch (error) {
        results.failed += 1;
        results.errors.push({
          row: record.row,
          student_id: record.student_id,
          error: error.message
        });
      }
    }

    return results;
  }

  async exportToCSV(type, filters = {}) {
    const { data, columns } = await this.getExportDataset(type, filters);
    return stringify(data, { header: true, columns });
  }

  async exportToExcel(type, filters = {}) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(type.charAt(0).toUpperCase() + type.slice(1));
    const { data, columns } = await this.getExportDataset(type, filters, true);

    worksheet.columns = columns;
    worksheet.addRows(data);
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4CAF50' }
    };

    return workbook.xlsx.writeBuffer();
  }

  async getExportDataset(type, filters = {}, excel = false) {
    const users = await listRecords('users');
    const userById = new Map(users.map((user) => [String(user.id), user]));

    if (type === 'users') {
      const data = this.filterUsers(users, filters).map((user) => ({
        id: user.id,
        username: user.username || user.registration_number || user.id,
        email: user.email || null,
        full_name: user.full_name || user.name || null,
        role: user.role || null,
        department: user.department || null,
        year: user.year ?? null,
        section: user.section || null,
        phone: user.phone || user.phone_number || null,
        created_at: user.created_at || null
      }));

      return {
        data,
        columns: excel ? [
          { header: 'ID', key: 'id', width: 20 },
          { header: 'Username', key: 'username', width: 20 },
          { header: 'Email', key: 'email', width: 30 },
          { header: 'Full Name', key: 'full_name', width: 25 },
          { header: 'Role', key: 'role', width: 15 },
          { header: 'Department', key: 'department', width: 15 },
          { header: 'Year', key: 'year', width: 10 },
          { header: 'Section', key: 'section', width: 10 },
          { header: 'Phone', key: 'phone', width: 15 },
          { header: 'Created At', key: 'created_at', width: 24 }
        ] : ['id', 'username', 'email', 'full_name', 'role', 'department', 'year', 'section', 'phone', 'created_at']
      };
    }

    if (type === 'attendance') {
      const records = await listRecords('attendance', {
        orderBy: [{ field: 'date', direction: 'desc' }]
      });

      const data = this.filterRecordsByUser(records, userById, filters)
        .map((record) => ({
          id: record.id,
          username: userById.get(String(record.student_id))?.username
            || userById.get(String(record.student_id))?.registration_number
            || String(record.student_id),
          subject: record.subject || null,
          date: record.date || null,
          status: record.status || null,
          remarks: record.remarks || null,
          marked_by: userById.get(String(record.marked_by))?.username
            || userById.get(String(record.marked_by))?.name
            || String(record.marked_by || ''),
          created_at: record.created_at || null
        }));

      return {
        data,
        columns: excel ? [
          { header: 'ID', key: 'id', width: 20 },
          { header: 'Student', key: 'username', width: 20 },
          { header: 'Subject', key: 'subject', width: 25 },
          { header: 'Date', key: 'date', width: 15 },
          { header: 'Status', key: 'status', width: 12 },
          { header: 'Remarks', key: 'remarks', width: 30 },
          { header: 'Marked By', key: 'marked_by', width: 20 },
          { header: 'Created At', key: 'created_at', width: 24 }
        ] : ['id', 'username', 'subject', 'date', 'status', 'remarks', 'marked_by', 'created_at']
      };
    }

    if (type === 'marks') {
      const records = await listRecords('marks', {
        orderBy: [{ field: 'exam_date', direction: 'desc' }, { field: 'created_at', direction: 'desc' }]
      });

      const data = this.filterRecordsByUser(records, userById, filters)
        .map((record) => ({
          id: record.id,
          username: userById.get(String(record.student_id))?.username
            || userById.get(String(record.student_id))?.registration_number
            || String(record.student_id),
          subject: record.subject || null,
          exam_type: record.exam_type || null,
          marks_obtained: record.marks_obtained ?? null,
          total_marks: record.total_marks ?? null,
          grade: record.grade || null,
          remarks: record.remarks || null,
          uploaded_by: userById.get(String(record.uploaded_by))?.username
            || userById.get(String(record.uploaded_by))?.name
            || String(record.uploaded_by || ''),
          created_at: record.created_at || null
        }));

      return {
        data,
        columns: excel ? [
          { header: 'ID', key: 'id', width: 20 },
          { header: 'Student', key: 'username', width: 20 },
          { header: 'Subject', key: 'subject', width: 25 },
          { header: 'Exam Type', key: 'exam_type', width: 15 },
          { header: 'Marks Obtained', key: 'marks_obtained', width: 15 },
          { header: 'Total Marks', key: 'total_marks', width: 15 },
          { header: 'Grade', key: 'grade', width: 10 },
          { header: 'Remarks', key: 'remarks', width: 30 },
          { header: 'Uploaded By', key: 'uploaded_by', width: 20 },
          { header: 'Created At', key: 'created_at', width: 24 }
        ] : ['id', 'username', 'subject', 'exam_type', 'marks_obtained', 'total_marks', 'grade', 'remarks', 'uploaded_by', 'created_at']
      };
    }

    throw new Error('Invalid export type');
  }

  filterUsers(users, filters = {}) {
    return users.filter((user) => {
      if (filters.department && user.department !== filters.department) return false;
      if (filters.year && Number(user.year) !== Number(filters.year)) return false;
      if (filters.section && user.section !== filters.section) return false;
      return true;
    });
  }

  filterRecordsByUser(records, userById, filters = {}) {
    return records.filter((record) => {
      const user = userById.get(String(record.student_id)) || {};
      if (filters.department && user.department !== filters.department) return false;
      if (filters.year && Number(user.year) !== Number(filters.year)) return false;
      if (filters.section && user.section !== filters.section) return false;

      const dateValue = String(record.date || record.exam_date || '').slice(0, 10);
      if (filters.startDate && dateValue && dateValue < filters.startDate) return false;
      if (filters.endDate && dateValue && dateValue > filters.endDate) return false;

      return true;
    });
  }

  async parseCSV(filePath) {
    const fileContent = await fs.readFile(filePath, 'utf-8');
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

  async parseExcel(filePath) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);

    const worksheet = workbook.worksheets[0];
    const records = [];
    const headers = [];

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) {
        row.eachCell((cell) => {
          headers.push(String(cell.value || '').toLowerCase().replace(/\s+/g, '_'));
        });
        return;
      }

      const record = { row: rowNumber };
      row.eachCell((cell, colNumber) => {
        record[headers[colNumber - 1]] = cell.value;
      });
      records.push(record);
    });

    return records;
  }

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

  generatePassword() {
    const length = 12;
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    // ponytail: modulo bias negligible for one-time temp passwords -> rejection sampling if audited
    const bytes = crypto.randomBytes(length);
    let password = '';
    for (let i = 0; i < length; i += 1) {
      password += charset.charAt(bytes[i] % charset.length);
    }
    return password;
  }
}

module.exports = new BulkOperationsService();
