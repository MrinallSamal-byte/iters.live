require('dotenv').config();
const { query } = require('../server/database/db');
const bcrypt = require('bcrypt');

async function main() {
  console.log('🌱 Seeding comprehensive demo data for Render...');
  
  const adminPass = await bcrypt.hash('Admin@123456', 12);
  const teacherPass = await bcrypt.hash('Teacher@123', 12);
  const studentPass = await bcrypt.hash('Student@123', 12);

  const ensureUser = async (name, reg, email, pass, role, extra = {}) => {
    const existing = await query('SELECT id FROM users WHERE registration_number = $1', [reg]);
    if (existing.length) return existing[0].id;
    const cols = ['name','registration_number','email','password','role','department'];
    const vals = [name, reg, email, pass, role, extra.department || 'CSE'];
    if (role === 'student') { cols.push('year','section'); vals.push(3,'A'); }
    if (role === 'teacher') { cols.push('subjects_taught'); vals.push(extra.subjects_taught || 'Data Structures, Algorithms'); }
    const placeholders = cols.map((_,i)=>`$${i+1}`).join(',');
    const sql = `INSERT INTO users (${cols.join(',')}) VALUES (${placeholders}) RETURNING id`;
    const rows = await query(sql, vals);
    return rows[0].id;
  };

  // Create demo users
  const adminId = await ensureUser('Admin One','ADM2025001','admin1@iter.edu',adminPass,'admin',{department:'Administration'});
  const tchId = await ensureUser('Prof. Ada Lovelace','TCH2025001','teacher1@iter.edu',teacherPass,'teacher',{department:'CSE',subjects_taught:'Data Structures, Algorithms, DBMS'});
  const stuId = await ensureUser('Demo Student','STU20250001','student1@iter.edu',studentPass,'student',{department:'CSE'});

  console.log('✓ Created demo users:', { adminId, tchId, stuId });

  // Seed timetable for student (CSE, Year 3, Section A)
  console.log('📅 Seeding timetable...');
  const timetableData = [
    { day: 'Monday', start: '09:00', end: '10:00', subject: 'Data Structures', room: 'CS-301' },
    { day: 'Monday', start: '10:00', end: '11:00', subject: 'Algorithms', room: 'CS-302' },
    { day: 'Monday', start: '11:00', end: '12:00', subject: 'DBMS', room: 'CS-303' },
    { day: 'Tuesday', start: '09:00', end: '10:00', subject: 'Operating Systems', room: 'CS-301' },
    { day: 'Tuesday', start: '10:00', end: '11:00', subject: 'Computer Networks', room: 'CS-302' },
    { day: 'Tuesday', start: '11:00', end: '12:00', subject: 'Data Structures', room: 'CS-Lab-1' },
    { day: 'Wednesday', start: '09:00', end: '10:00', subject: 'Software Engineering', room: 'CS-301' },
    { day: 'Wednesday', start: '10:00', end: '11:00', subject: 'Web Technologies', room: 'CS-302' },
    { day: 'Wednesday', start: '11:00', end: '12:00', subject: 'Algorithms', room: 'CS-Lab-2' },
    { day: 'Thursday', start: '09:00', end: '10:00', subject: 'Machine Learning', room: 'CS-301' },
    { day: 'Thursday', start: '10:00', end: '11:00', subject: 'Data Structures', room: 'CS-302' },
    { day: 'Thursday', start: '11:00', end: '12:00', subject: 'DBMS', room: 'CS-Lab-1' },
    { day: 'Friday', start: '09:00', end: '10:00', subject: 'Algorithms', room: 'CS-301' },
    { day: 'Friday', start: '10:00', end: '11:00', subject: 'Computer Networks', room: 'CS-302' },
    { day: 'Friday', start: '11:00', end: '12:00', subject: 'Software Engineering', room: 'CS-303' }
  ];

  for (const tt of timetableData) {
    const exists = await query(
      `SELECT id FROM timetable WHERE department = $1 AND year = $2 AND section = $3 
       AND day_of_week = $4 AND start_time = $5`,
      ['CSE', 3, 'A', tt.day, tt.start]
    );
    
    if (exists.length === 0) {
      await query(
        `INSERT INTO timetable 
         (teacher_id, department, year, section, subject, day_of_week, start_time, end_time, room_number)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [tchId, 'CSE', 3, 'A', tt.subject, tt.day, tt.start, tt.end, tt.room]
      );
    }
  }
  console.log(`✓ Created ${timetableData.length} timetable entries`);

  // Seed notes for student
  console.log('📚 Seeding notes...');
  const notesData = [
    { filename: 'DS_Arrays_and_Linked_Lists.pdf', subject: 'Data Structures', category: 'lecture_notes' },
    { filename: 'DS_Trees_and_Graphs.pdf', subject: 'Data Structures', category: 'lecture_notes' },
    { filename: 'DS_Lab_Manual_Sorting.pdf', subject: 'Data Structures', category: 'lab_manual' },
    { filename: 'Algo_Divide_and_Conquer.pdf', subject: 'Algorithms', category: 'lecture_notes' },
    { filename: 'Algo_Dynamic_Programming.pdf', subject: 'Algorithms', category: 'lecture_notes' },
    { filename: 'Algo_PYQ_2024.pdf', subject: 'Algorithms', category: 'previous_year' },
    { filename: 'DBMS_SQL_Basics.pdf', subject: 'DBMS', category: 'lecture_notes' },
    { filename: 'DBMS_Normalization.pdf', subject: 'DBMS', category: 'lecture_notes' },
    { filename: 'DBMS_Lab_ER_Diagrams.pdf', subject: 'DBMS', category: 'lab_manual' },
    { filename: 'OS_Process_Management.pdf', subject: 'Operating Systems', category: 'lecture_notes' },
    { filename: 'CN_OSI_Model.pdf', subject: 'Computer Networks', category: 'lecture_notes' },
    { filename: 'SE_SDLC_Models.pdf', subject: 'Software Engineering', category: 'lecture_notes' }
  ];

  for (const note of notesData) {
    const exists = await query(
      `SELECT id FROM files WHERE filename = $1`,
      [note.filename]
    );
    
    if (exists.length === 0) {
      await query(
        `INSERT INTO files 
         (uploaded_by, filename, original_name, file_path, file_type, file_size, subject, department, category, description)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          tchId,
          note.filename,
          note.filename,
          `/uploads/notes/${note.filename}`,
          'application/pdf',
          1024000,
          note.subject,
          'CSE',
          note.category,
          `${note.category.replace('_', ' ')} for ${note.subject}`
        ]
      );
    }
  }
  console.log(`✓ Created ${notesData.length} notes entries`);

  // Seed attendance for student (last 30 days)
  console.log('📝 Seeding attendance...');
  const today = new Date();
  let attendanceCount = 0;
  
  for (let i = 0; i < 30; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    
    // Skip weekends
    if (date.getDay() === 0 || date.getDay() === 6) continue;
    
    // Random attendance (85% present)
    const status = Math.random() > 0.15 ? 'present' : 'absent';
    
    const exists = await query(
      `SELECT id FROM attendance WHERE student_id = $1 AND date = $2 AND subject = $3`,
      [stuId, dateStr, 'Data Structures']
    );
    
    if (exists.length === 0) {
      try {
        await query(
          `INSERT INTO attendance (student_id, subject, date, status, marked_by)
           VALUES ($1, $2, $3, $4, $5)`,
          [stuId, 'Data Structures', dateStr, status, tchId]
        );
        attendanceCount++;
      } catch (err) {
        if (err.code !== '23505') throw err; // Ignore duplicates
      }
    }
  }
  console.log(`✓ Created ${attendanceCount} attendance records`);

  // Seed marks for student
  console.log('💯 Seeding marks...');
  const marksData = [
    { subject: 'Data Structures', exam: 'internal', marks: 78, max: 100, date: '2025-09-15' },
    { subject: 'Data Structures', exam: 'assignment', marks: 45, max: 50, date: '2025-09-20' },
    { subject: 'Algorithms', exam: 'internal', marks: 82, max: 100, date: '2025-09-16' },
    { subject: 'Algorithms', exam: 'assignment', marks: 48, max: 50, date: '2025-09-22' },
    { subject: 'DBMS', exam: 'internal', marks: 75, max: 100, date: '2025-09-17' },
    { subject: 'DBMS', exam: 'quiz', marks: 18, max: 20, date: '2025-09-10' },
    { subject: 'Operating Systems', exam: 'internal', marks: 70, max: 100, date: '2025-09-18' },
    { subject: 'Computer Networks', exam: 'internal', marks: 68, max: 100, date: '2025-09-19' }
  ];

  for (const mark of marksData) {
    const exists = await query(
      `SELECT id FROM marks WHERE student_id = $1 AND subject = $2 AND exam_type = $3`,
      [stuId, mark.subject, mark.exam]
    );
    
    if (exists.length === 0) {
      try {
        await query(
          `INSERT INTO marks 
           (student_id, subject, exam_type, marks_obtained, total_marks, exam_date, uploaded_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [stuId, mark.subject, mark.exam, mark.marks, mark.max, mark.date, tchId]
        );
      } catch (err) {
        if (err.code !== '23505') throw err; // Ignore duplicates
      }
    }
  }
  console.log(`✓ Created ${marksData.length} marks records`);

  // Seed system settings
  console.log('⚙️ Seeding system settings...');
  const settings = [
    ['current_semester', '5'],
    ['current_academic_year', '2024-2025'],
    ['attendance_threshold', '75'],
    ['max_file_size', '10485760']
  ];

  for (const [key, value] of settings) {
    const exists = await query(`SELECT id FROM system_settings WHERE setting_key = $1`, [key]);
    if (exists.length === 0) {
      await query(
        `INSERT INTO system_settings (setting_key, setting_value) VALUES ($1, $2)`,
        [key, value]
      );
    }
  }
  console.log('✓ Created system settings');

  console.log('\n✅ Demo data seeding complete!');
  console.log('\n🎓 Demo Accounts:');
  console.log('   Student: STU20250001 / Student@123');
  console.log('   Teacher: TCH2025001 / Teacher@123');
  console.log('   Admin: ADM2025001 / Admin@123456');
  console.log('\n📊 Data Created:');
  console.log(`   - ${timetableData.length} timetable entries`);
  console.log(`   - ${notesData.length} notes/files`);
  console.log(`   - ${attendanceCount} attendance records`);
  console.log(`   - ${marksData.length} marks entries`);
  console.log(`   - ${settings.length} system settings`);
  
  process.exit(0);
}

main().catch(err => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
