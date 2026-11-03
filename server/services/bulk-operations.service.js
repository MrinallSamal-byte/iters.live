/**
 * Bulk Operations Service
 * Handles bulk imports, exports, and batch operations
 */

const csv = require('csv-parse');
const ExcelJS = require('exceljs');
const fs = require('fs').promises;
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const {
  createRecord,
  listRecords,
  updateRecord,
  isValidDocId
} = require('./firebase-data.service');
const cacheService = require('./cache.service');
const { toSafeCsv } = require('../utils/csv.util');
const { normalizeDateOnly, isFutureDateOnly } = require('../utils/date.util');

const IN_QUERY_CHUNK = 30;
const MAX_IMPORT_ROWS = 5000;
const REGISTRATION_NUMBER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{2,39}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Collapse the many shapes an Excel cell can have (rich text, hyperlink,
 * formula result, Date) to a plain value; CSV cells are already plain.
 */
function plainCellValue(value) {
  if (value === null || value === undefined) return undefined;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value !== 'object') return value;
  if (Array.isArray(value.richText)) return value.richText.map((part) => part.text).join('');
  if (value.result !== undefined) return plainCellValue(value.result);
  if (value.text !== undefined) return value.text;
  return String(value);
}

/** A cell that is missing, empty, or whitespace. */
function isBlank(value) {
  return value === undefined || value === null || String(value).trim() === '';
}

/** Fetch documents by id in `in` chunks into a Map keyed by id. */
async function loadByIds(collection, ids) {
  const found = new Map();
  const unique = Array.from(new Set(ids.map(String).filter(isValidDocId)));
  for (let index = 0; index < unique.length; index += IN_QUERY_CHUNK) {
    const rows = await listRecords(collection, {
      filters: [{ field: 'id', op: 'in', value: unique.slice(index, index + IN_QUERY_CHUNK) }]
    });
    rows.forEach((row) => found.set(String(row.id), row));
  }
  return found;
}

function assertRowLimit(rows) {
  if (rows.length > MAX_IMPORT_ROWS) {
    const error = new Error(`A single import can contain at most ${MAX_IMPORT_ROWS} rows (this file has ${rows.length})`);
    error.statusCode = 400;
    throw error;
  }
}

class BulkOperationsService {
  async bulkCreateUsers(filePath, fileType = 'csv') {
    const users = fileType === 'csv'
      ? await this.parseCSV(filePath)
      : await this.parseExcel(filePath);
    assertRowLimit(users);

    const results = {
      success: 0,
      failed: 0,
      errors: [],
      credentials: []
    };

    // Only the registration numbers present in the file are checked for clashes.
    const existingUsers = await loadByIds(
      'users',
      users.map((user) => user.registration_number || user.username).filter((value) => !isBlank(value))
    );
    const seenInFile = new Set();

    for (const user of users) {
      try {
        if (isBlank(user.username) || isBlank(user.email) || isBlank(user.role)) {
          throw new Error('Missing required fields (username, email, role)');
        }

        // ponytail: per-row role gate -> shared validator if more import types need it
        const role = String(user.role).trim().toLowerCase();
        if (!['student', 'teacher', 'admin'].includes(role)) {
          throw new Error('Invalid role. Must be student, teacher, or admin');
        }

        if (!EMAIL_PATTERN.test(String(user.email).trim())) {
          throw new Error('Invalid email format');
        }

        const registrationNumber = String(user.registration_number || user.username).trim();
        if (!REGISTRATION_NUMBER_PATTERN.test(registrationNumber)) {
          throw new Error('registration number / username must be 3-40 letters, digits, hyphens or underscores');
        }
        if (existingUsers.has(registrationNumber) || seenInFile.has(registrationNumber)) {
          throw new Error('User already exists');
        }

        let year = null;
        if (!isBlank(user.year)) {
          year = Number(user.year);
          if (!Number.isInteger(year) || year < 1 || year > 6) {
            throw new Error('year must be a whole number between 1 and 6');
          }
        }

        if (!isBlank(user.password) && String(user.password).length < 8) {
          throw new Error('password must be at least 8 characters');
        }

        const password = isBlank(user.password) ? this.generatePassword() : String(user.password);
        const hashedPassword = await bcrypt.hash(password, 10);

        await createRecord('users', {
          username: String(user.username).trim(),
          name: user.full_name || user.name || user.username,
          email: String(user.email).trim(),
          password: hashedPassword,
          full_name: user.full_name || user.name || user.username,
          role,
          department: user.department || null,
          year,
          section: user.section || null,
          phone: user.phone || null,
          phone_number: user.phone || null,
          address: user.address || null,
          registration_number: registrationNumber,
          is_active: true,
          last_login: null
        }, { id: registrationNumber, exclusive: true });

        seenInFile.add(registrationNumber);

        if (isBlank(user.password)) {
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
          error: error.code === 6 ? 'User already exists' : error.message
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
    assertRowLimit(records);

    const results = {
      success: 0,
      failed: 0,
      errors: []
    };

    // Look up only the students (and their existing rows) that appear in the file.
    const students = await loadByIds('users', records.map((record) => record.student_id).filter((value) => !isBlank(value)));
    const existingByKey = new Map();
    const studentIds = Array.from(students.keys());
    for (let index = 0; index < studentIds.length; index += IN_QUERY_CHUNK) {
      const rows = await listRecords('attendance', {
        filters: [{ field: 'student_id', op: 'in', value: studentIds.slice(index, index + IN_QUERY_CHUNK) }]
      });
      rows.forEach((row) => existingByKey.set(`${row.student_id}|${row.subject}|${normalizeDateOnly(row.date)}`, row));
    }

    const touched = new Set();

    for (const record of records) {
      try {
        if (isBlank(record.student_id) || isBlank(record.subject) || isBlank(record.date) || isBlank(record.status)) {
          throw new Error('Missing required fields (student_id, subject, date, status)');
        }

        const status = String(record.status).trim().toLowerCase();
        if (!['present', 'absent', 'late'].includes(status)) {
          throw new Error('Invalid status. Must be present, absent, or late');
        }

        const date = normalizeDateOnly(record.date);
        if (!date) throw new Error('date must be a valid date');
        if (isFutureDateOnly(date)) throw new Error('date cannot be in the future');

        const student = students.get(String(record.student_id).trim());
        if (!student || student.role !== 'student') throw new Error('Student not found');

        const subject = String(record.subject).trim();
        const key = `${student.id}|${subject}|${date}`;
        const existing = existingByKey.get(key);

        const payload = {
          student_id: student.id,
          subject,
          date,
          status,
          marked_by: teacherId,
          remarks: record.remarks || null,
          department: student.department || null,
          year: student.year ?? null,
          section: student.section || null
        };

        if (existing) {
          await updateRecord('attendance', existing.id, payload);
        } else {
          const created = await createRecord('attendance', payload);
          existingByKey.set(key, created);
        }

        touched.add(student.id);
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

    // Cached attendance summaries must not outlive the data they summarise.
    touched.forEach((studentId) => cacheService.invalidateAttendance(studentId));
    if (touched.size > 0) {
      await cacheService.invalidateAnalytics().catch((error) => {
        console.warn('Analytics cache invalidation failed:', error.message);
      });
    }

    return results;
  }

  async bulkUploadMarks(filePath, teacherId, fileType = 'csv') {
    const records = fileType === 'csv'
      ? await this.parseCSV(filePath)
      : await this.parseExcel(filePath);
    assertRowLimit(records);

    const results = {
      success: 0,
      failed: 0,
      errors: []
    };

    const students = await loadByIds('users', records.map((record) => record.student_id).filter((value) => !isBlank(value)));
    const existingByKey = new Map();
    const studentIds = Array.from(students.keys());
    for (let index = 0; index < studentIds.length; index += IN_QUERY_CHUNK) {
      const rows = await listRecords('marks', {
        filters: [{ field: 'student_id', op: 'in', value: studentIds.slice(index, index + IN_QUERY_CHUNK) }]
      });
      // Same uniqueness rule as the single-entry endpoint: student + subject + exam type + date.
      rows.forEach((row) => existingByKey.set(
        `${row.student_id}|${row.subject}|${row.exam_type}|${normalizeDateOnly(row.exam_date)}`,
        row
      ));
    }

    const touched = new Set();

    for (const record of records) {
      try {
        if (isBlank(record.student_id) || isBlank(record.subject) || isBlank(record.exam_type)
          || isBlank(record.marks_obtained) || isBlank(record.total_marks)) {
          throw new Error('Missing required fields (student_id, subject, exam_type, marks_obtained, total_marks)');
        }

        const marksObtained = Number(record.marks_obtained);
        const totalMarks = Number(record.total_marks);
        if (!Number.isFinite(marksObtained) || !Number.isFinite(totalMarks)
          || totalMarks < 1 || marksObtained < 0 || marksObtained > totalMarks) {
          throw new Error('Invalid marks value');
        }

        const examDate = isBlank(record.exam_date || record.date)
          ? new Date().toISOString().slice(0, 10)
          : normalizeDateOnly(record.exam_date || record.date);
        if (!examDate) throw new Error('exam_date must be a valid date');
        if (isFutureDateOnly(examDate)) throw new Error('exam_date cannot be in the future');

        const student = students.get(String(record.student_id).trim());
        if (!student || student.role !== 'student') throw new Error('Student not found');

        const subject = String(record.subject).trim();
        const examType = String(record.exam_type).trim();
        const key = `${student.id}|${subject}|${examType}|${examDate}`;
        const existing = existingByKey.get(key);

        const payload = {
          student_id: student.id,
          subject,
          exam_type: examType,
          marks_obtained: marksObtained,
          total_marks: totalMarks,
          grade: this.calculateGrade(marksObtained, totalMarks),
          uploaded_by: teacherId,
          remarks: record.remarks || null,
          exam_date: examDate,
          semester: student.semester ?? null,
          department: student.department || null,
          year: student.year ?? null,
          section: student.section || null
        };

        if (existing) {
          await updateRecord('marks', existing.id, payload);
        } else {
          const created = await createRecord('marks', payload);
          existingByKey.set(key, created);
        }

        touched.add(student.id);
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

    touched.forEach((studentId) => cacheService.invalidateMarks(studentId));
    if (touched.size > 0) {
      await cacheService.invalidateAnalytics().catch((error) => {
        console.warn('Analytics cache invalidation failed:', error.message);
      });
    }

    return results;
  }

  async exportToCSV(type, filters = {}) {
    const { data, columns } = await this.getExportDataset(type, filters);
    // Spreadsheet-safe: user-controlled text must not execute as a formula.
    return toSafeCsv(data, columns);
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
    // Users are listed in full only when they are the export; for attendance and
    // marks just the students that appear in the data are looked up (below).
    const users = type === 'users' ? await listRecords('users') : [];
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
      await this.attachReferencedUsers(userById, records, ['student_id', 'marked_by']);

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
      await this.attachReferencedUsers(userById, records, ['student_id', 'uploaded_by']);

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

  /** Load the users referenced by `records` (in `fields`) into `userById`. */
  async attachReferencedUsers(userById, records, fields) {
    const ids = [];
    for (const record of records) {
      for (const field of fields) {
        if (record[field]) ids.push(record[field]);
      }
    }
    const found = await loadByIds('users', ids);
    found.forEach((user, id) => userById.set(id, user));
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
    if (!worksheet) {
      const error = new Error('The workbook has no worksheets');
      error.statusCode = 400;
      throw error;
    }
    const records = [];
    const headers = [];

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) {
        row.eachCell((cell) => {
          headers.push(String(plainCellValue(cell.value) || '').trim().toLowerCase().replace(/\s+/g, '_'));
        });
        return;
      }

      const record = { row: rowNumber };
      row.eachCell((cell, colNumber) => {
        record[headers[colNumber - 1]] = plainCellValue(cell.value);
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
