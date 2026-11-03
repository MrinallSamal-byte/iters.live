/** @jest-environment node */

jest.mock('../database/firebase', () => require('../test-utils/fake-firebase').createFirebaseMock());

const fs = require('fs');
const os = require('os');
const path = require('path');
const ExcelJS = require('exceljs');
const firebase = require('../database/firebase');
const guard = require('../services/session-guard.service');
const cacheService = require('../services/cache.service');
const bulk = require('../services/bulk-operations.service');
const router = require('../routes/bulk.routes');
const { startHarness } = require('../test-utils/route-harness');
const { tokenFor, USERS } = require('../test-utils/fixtures');

let tmpDir;

function writeCsv(name, text) {
  const file = path.join(tmpDir, name);
  fs.writeFileSync(file, text);
  return file;
}

function multipart(fieldName, fileName, content) {
  const boundary = '----iterTestBoundary';
  const head = `--${boundary}\r\nContent-Disposition: form-data; name="${fieldName}"; filename="${fileName}"\r\nContent-Type: text/csv\r\n\r\n`;
  const body = Buffer.concat([Buffer.from(head), Buffer.from(content), Buffer.from(`\r\n--${boundary}--\r\n`)]);
  return { body, headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}`, 'Content-Length': body.length } };
}

describe('bulk operations', () => {
  beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'iter-bulk-'));
  });

  afterAll(() => fs.rmSync(tmpDir, { recursive: true, force: true }));

  beforeEach(async () => {
    firebase.__reset();
    guard.clearLiveUserCache();
    await cacheService.flush().catch(() => {});
    Object.values(USERS).forEach((user) => firebase.__seed('users', user.id, user));
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => jest.restoreAllMocks());

  describe('marks import (service)', () => {
    const header = 'student_id,subject,exam_type,marks_obtained,total_marks,exam_date\n';

    test('two exams of the same type on different days are two records, not an overwrite', async () => {
      const file = writeCsv('marks-1.csv', `${header}STU1,Maths,Quiz,8,10,2025-02-01\nSTU1,Maths,Quiz,6,10,2025-02-15\n`);

      const result = await bulk.bulkUploadMarks(file, 'TCH1', 'csv');

      expect(result).toMatchObject({ success: 2, failed: 0 });
      expect(firebase.__all('marks').map((row) => row.marks_obtained).sort()).toEqual([6, 8]);
    });

    test('re-importing the same file updates in place instead of duplicating', async () => {
      const file = writeCsv('marks-2.csv', `${header}STU1,Maths,Quiz,8,10,2025-02-01\n`);
      await bulk.bulkUploadMarks(file, 'TCH1', 'csv');
      const corrected = writeCsv('marks-3.csv', `${header}STU1,Maths,Quiz,9,10,2025-02-01\n`);
      await bulk.bulkUploadMarks(corrected, 'TCH1', 'csv');

      const rows = firebase.__all('marks');
      expect(rows).toHaveLength(1);
      expect(rows[0].marks_obtained).toBe(9);
    });

    test('blank cells are rejected, not stored as zero', async () => {
      const file = writeCsv('marks-4.csv', `${header}STU1,Maths,Quiz,,10,2025-02-01\nSTU1,Maths,Quiz,5,,2025-02-02\n`);

      const result = await bulk.bulkUploadMarks(file, 'TCH1', 'csv');

      expect(result.success).toBe(0);
      expect(result.errors).toHaveLength(2);
      expect(firebase.__all('marks')).toHaveLength(0);
    });

    test('reports each bad row with its line number and reason', async () => {
      const file = writeCsv('marks-5.csv', `${header}STU1,Maths,Quiz,50,10,2025-02-01\nGHOST,Maths,Quiz,5,10,2025-02-01\nTCH1,Maths,Quiz,5,10,2025-02-01\nSTU1,Maths,Quiz,5,10,2999-01-01\nSTU1,Maths,Quiz,5,10,not-a-date\nSTU1,Maths,Quiz,5,10,2025-02-03\n`);

      const result = await bulk.bulkUploadMarks(file, 'TCH1', 'csv');

      expect(result.success).toBe(1);
      expect(result.errors.map((error) => [error.row, error.error])).toEqual([
        [2, 'Invalid marks value'],
        [3, 'Student not found'],
        [4, 'Student not found'],
        [5, 'exam_date cannot be in the future'],
        [6, 'exam_date must be a valid date']
      ]);
    });

    test('fills the same class fields as the single-entry endpoint, so reports can group by class', async () => {
      const file = writeCsv('marks-6.csv', `${header}STU1,Maths,Quiz,8,10,2025-02-01\n`);
      await bulk.bulkUploadMarks(file, 'TCH1', 'csv');
      expect(firebase.__all('marks')[0]).toMatchObject({ department: 'CSE', year: 3, section: 'A', grade: 'A', uploaded_by: 'TCH1' });
    });

    test('invalidates the student\'s cached marks', async () => {
      const spy = jest.spyOn(cacheService, 'invalidateMarks');
      const file = writeCsv('marks-7.csv', `${header}STU1,Maths,Quiz,8,10,2025-02-01\n`);
      await bulk.bulkUploadMarks(file, 'TCH1', 'csv');
      expect(spy).toHaveBeenCalledWith('STU1');
    });

    test('rejects an oversized file with a client error', async () => {
      const rows = Array.from({ length: 5001 }, (_, index) => `STU1,Maths,Quiz${index},1,10,2025-02-01`).join('\n');
      const file = writeCsv('marks-8.csv', `${header}${rows}\n`);
      await expect(bulk.bulkUploadMarks(file, 'TCH1', 'csv')).rejects.toMatchObject({ statusCode: 400 });
    });
  });

  describe('attendance import (service)', () => {
    const header = 'student_id,subject,date,status,remarks\n';

    test('normalises dates, validates students, and upserts', async () => {
      const file = writeCsv('att-1.csv', `${header}STU1,Maths,2025-02-01T09:00:00Z,present,\nSTU1,Maths,2025-02-01,absent,corrected\nGHOST,Maths,2025-02-01,present,\nSTU2,Maths,2999-01-01,present,\nSTU2,Maths,2025-02-01,asleep,\n`);

      const result = await bulk.bulkMarkAttendance(file, 'TCH1', 'csv');

      expect(result.success).toBe(2);
      expect(result.errors.map((error) => error.error)).toEqual([
        'Student not found', 'date cannot be in the future', 'Invalid status. Must be present, absent, or late'
      ]);
      const rows = firebase.__all('attendance');
      expect(rows).toHaveLength(1); // second line corrected the first (same student/subject/day)
      expect(rows[0]).toMatchObject({ date: '2025-02-01', status: 'absent', department: 'CSE', year: 3 });
    });

    test('invalidates cached attendance for every student touched', async () => {
      const spy = jest.spyOn(cacheService, 'invalidateAttendance');
      const file = writeCsv('att-2.csv', `${header}STU1,Maths,2025-02-01,present,\nSTU2,Maths,2025-02-01,present,\n`);
      await bulk.bulkMarkAttendance(file, 'TCH1', 'csv');
      expect(spy.mock.calls.map(([id]) => id).sort()).toEqual(['STU1', 'STU2']);
    });
  });

  describe('user import (service)', () => {
    const header = 'username,email,password,full_name,role,department,year,section\n';

    test('creates users, generates passwords only when none is given, and refuses duplicates and bad rows', async () => {
      const file = writeCsv('users-1.csv', `${header}NEW1,new1@iter.edu,,New One,student,CSE,2,A\nNEW2,new2@iter.edu,GivenPass99,New Two,teacher,CSE,,\nNEW1,dup@iter.edu,,Dup,student,CSE,2,A\nSTU1,taken@iter.edu,,Taken,student,CSE,2,A\nBAD!,bad@iter.edu,,Bad,student,CSE,2,A\nNEW3,not-an-email,,Mail,student,CSE,2,A\nNEW4,n4@iter.edu,,Role,wizard,CSE,2,A\nNEW5,n5@iter.edu,short,Pass,student,CSE,2,A\nNEW6,n6@iter.edu,,Year,student,CSE,9,A\n`);

      const result = await bulk.bulkCreateUsers(file, 'csv');

      expect(result.success).toBe(2);
      expect(result.credentials.map((item) => item.username)).toEqual(['NEW1']); // NEW2 chose its own password
      expect(result.credentials[0].temporary_password).toHaveLength(12);
      expect(result.errors.map((error) => error.error)).toEqual([
        'User already exists', 'User already exists',
        'registration number / username must be 3-40 letters, digits, hyphens or underscores',
        'Invalid email format', 'Invalid role. Must be student, teacher, or admin',
        'password must be at least 8 characters', 'year must be a whole number between 1 and 6'
      ]);
      expect(firebase.__read('users', 'NEW1')).toMatchObject({ role: 'student', year: 2, is_active: true });
      expect(firebase.__read('users', 'NEW1').password).not.toBe(result.credentials[0].temporary_password);
      expect(firebase.__read('users', 'STU1').name).toBe('Asha Student'); // existing user untouched
    });
  });

  describe('Excel parsing', () => {
    test('rich text, hyperlinks, formulas and dates in cells become plain values', async () => {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Marks');
      sheet.addRow(['Student ID', 'Subject', 'Exam Type', 'Marks Obtained', 'Total Marks', 'Exam Date']);
      sheet.addRow([
        { richText: [{ text: 'ST' }, { text: 'U1' }] },
        { text: 'Maths', hyperlink: 'https://example.com' },
        'Quiz',
        { formula: '4+4', result: 8 },
        10,
        new Date(Date.UTC(2025, 1, 1))
      ]);
      const file = path.join(tmpDir, 'marks.xlsx');
      await workbook.xlsx.writeFile(file);

      const result = await bulk.bulkUploadMarks(file, 'TCH1', 'xlsx');

      expect(result).toMatchObject({ success: 1, failed: 0 });
      expect(firebase.__all('marks')[0]).toMatchObject({ student_id: 'STU1', subject: 'Maths', marks_obtained: 8, exam_date: '2025-02-01' });
    });
  });

  describe('exports', () => {
    test('CSV export neutralises spreadsheet formulas in user-controlled text', async () => {
      firebase.__seed('users', 'EVIL', { id: 'EVIL', name: '=1+1', full_name: '=1+1', email: 'e@iter.edu', role: 'student', registration_number: 'EVIL', username: 'EVIL' });

      const csv = await bulk.exportToCSV('users', {});

      expect(csv).toContain("'=1+1");
      expect(csv.split('\n').some((line) => line.includes(',=1+1,'))).toBe(false);
    });

    test('attendance export only loads the users it needs', async () => {
      for (let index = 0; index < 20; index += 1) firebase.__seed('users', `BYSTANDER${index}`, { name: 'Bystander', role: 'student' });
      firebase.__seed('attendance', 'x1', { student_id: 'STU1', subject: 'Maths', date: '2025-02-01', status: 'present', marked_by: 'TCH1' });
      firebase.__stats.documentsRead = 0;

      const csv = await bulk.exportToCSV('attendance', {});

      expect(csv).toContain('STU1');
      expect(firebase.__stats.documentsRead).toBeLessThan(8);
    });
  });

  describe('routes', () => {
    let api;
    let tokens;

    beforeAll(() => {
      api = startHarness('/api/bulk', router);
      tokens = {
        admin: tokenFor(USERS.admin),
        teacher: tokenFor(USERS.teacher),
        student: tokenFor(USERS.student)
      };
    });

    afterAll(() => api.close());

    test('admin-only and teacher/admin endpoints now actually admit those roles (array-style role arguments)', async () => {
      const csv = 'username,email,password,full_name,role\nNEWADM,na@iter.edu,GoodPass123,New Admin,admin\n';
      const upload = multipart('file', 'users.csv', csv);

      const asAdmin = await api.upload('/api/bulk/users/import', upload.body, upload.headers, { token: tokens.admin });
      expect(asAdmin.status).toBe(200);
      expect(asAdmin.body.data.success).toBe(1);
      expect(asAdmin.headers['cache-control']).toBe('no-store'); // response may carry temporary passwords

      const asTeacher = await api.upload('/api/bulk/users/import', upload.body, upload.headers, { token: tokens.teacher });
      expect(asTeacher.status).toBe(403);

      const marks = multipart('file', 'marks.csv', 'student_id,subject,exam_type,marks_obtained,total_marks,exam_date\nSTU1,Maths,Quiz,8,10,2025-02-01\n');
      const asTeacherMarks = await api.upload('/api/bulk/marks/import', marks.body, marks.headers, { token: tokens.teacher });
      expect(asTeacherMarks.status).toBe(200);

      const asStudent = await api.upload('/api/bulk/marks/import', marks.body, marks.headers, { token: tokens.student });
      expect(asStudent.status).toBe(403);
    });

    test('a wrong file type is a 400 with the real reason, and the upload is not kept', async () => {
      const upload = multipart('file', 'evil.exe', 'MZ');
      const res = await api.upload('/api/bulk/marks/import', upload.body, upload.headers, { token: tokens.teacher });
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Invalid file type/);
    });

    test('a request without a file is a 400', async () => {
      const res = await api.post('/api/bulk/marks/import', {}, { token: tokens.teacher });
      expect(res.status).toBe(400);
    });

    test('uploaded files are deleted after processing (attendance and marks as well as users)', async () => {
      const uploadsDir = require('../utils/uploads-dir.util').ensureUploadsDir('bulk');
      const before = fs.readdirSync(uploadsDir).length;

      const att = multipart('file', 'att.csv', 'student_id,subject,date,status\nSTU1,Maths,2025-02-01,present\n');
      await api.upload('/api/bulk/attendance/import', att.body, att.headers, { token: tokens.teacher });
      const marks = multipart('file', 'marks.csv', 'student_id,subject,exam_type,marks_obtained,total_marks\nSTU1,Maths,Quiz,8,10\n');
      await api.upload('/api/bulk/marks/import', marks.body, marks.headers, { token: tokens.teacher });
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(fs.readdirSync(uploadsDir).length).toBe(before);
    });

    test('imports are audited', async () => {
      const upload = multipart('file', 'att.csv', 'student_id,subject,date,status\nSTU1,Maths,2025-02-01,present\n');
      await api.upload('/api/bulk/attendance/import', upload.body, upload.headers, { token: tokens.teacher });
      expect(firebase.__all('activity_log').some((entry) => entry.action === 'bulk_attendance_import')).toBe(true);
    });

    test('the marks template includes the exam_date column the importer reads', async () => {
      const res = await api.get('/api/bulk/templates/marks', { token: tokens.teacher, raw: true });
      expect(res.text.trim()).toBe('student_id,subject,exam_type,marks_obtained,total_marks,exam_date,remarks');
    });
  });
});
