require('dotenv').config();
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  multipleStatements: true,
  connectTimeout: 30000
};

// Sample data
const departments = ['CSE', 'IT', 'ECE', 'EEE', 'MECH', 'CIVIL'];
const sections = ['A', 'B', 'C'];
const subjects = {
  CSE: ['Data Structures', 'Algorithms', 'Database Management', 'Operating Systems', 'Computer Networks'],
  IT: ['Web Development', 'Mobile Computing', 'Cloud Computing', 'Cyber Security', 'AI & ML'],
  ECE: ['Digital Electronics', 'Signals & Systems', 'VLSI Design', 'Embedded Systems'],
  EEE: ['Power Systems', 'Control Systems', 'Electrical Machines', 'Power Electronics'],
  MECH: ['Thermodynamics', 'Fluid Mechanics', 'Manufacturing Processes', 'CAD/CAM'],
  CIVIL: ['Structural Analysis', 'Concrete Technology', 'Surveying', 'Geotechnical Engineering']
};

const firstNames = ['Aarav', 'Vivaan', 'Aditya', 'Arjun', 'Sai', 'Diya', 'Ananya', 'Isha', 'Priya', 'Sneha', 'Rohan', 'Karan'];
const lastNames = ['Sharma', 'Verma', 'Patel', 'Kumar', 'Singh', 'Reddy', 'Gupta', 'Joshi', 'Mehta', 'Nair'];

const getRandomElement = (arr) => arr[Math.floor(Math.random() * arr.length)];
const getRandomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

async function seedClean() {
  let connection;
  
  try {
    console.log('\n🌱 Starting Clean Database Seeding...\n');
    
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Connected to Railway MySQL\n');

    // Check existing users
    const [existing] = await connection.query('SELECT COUNT(*) as count FROM users');
    if (existing[0].count > 0) {
      console.log(`⚠️  Database already has ${existing[0].count} users`);
      console.log('   Clearing existing data...\n');
      
      await connection.query('SET FOREIGN_KEY_CHECKS = 0');
      await connection.query('TRUNCATE TABLE assignment_submissions');
      await connection.query('TRUNCATE TABLE assignments');
      await connection.query('TRUNCATE TABLE attendance');
      await connection.query('TRUNCATE TABLE marks');
      await connection.query('TRUNCATE TABLE event_registrations');
      await connection.query('TRUNCATE TABLE events');
      await connection.query('TRUNCATE TABLE admit_cards');
      await connection.query('TRUNCATE TABLE refresh_tokens');
      await connection.query('TRUNCATE TABLE users');
      await connection.query('SET FOREIGN_KEY_CHECKS = 1');
      
      console.log('✅ Cleared existing data\n');
    }

    // Seed Admins
    console.log('👨‍💼 Creating admin accounts...');
    const adminPassword = await bcrypt.hash('Admin@123456', 12);
    
    for (let i = 1; i <= 3; i++) {
      await connection.query(
        'INSERT INTO users (name, registration_number, email, password, phone_number, department, role) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [`Admin ${i}`, `ADM2025${String(i).padStart(3, '0')}`, `admin${i}@iter.edu`, adminPassword, `987654321${i}`, 'Administration', 'admin']
      );
    }
    console.log('   ✅ Created 3 admin accounts\n');

    // Seed Teachers
    console.log('👨‍🏫 Creating teacher accounts...');
    const teacherPassword = await bcrypt.hash('Teacher@123', 12);
    const teacherIds = [];
    
    for (let i = 1; i <= 50; i++) {
      const dept = getRandomElement(departments);
      const name = `${getRandomElement(['Dr.', 'Prof.', 'Mr.', 'Mrs.'])} ${getRandomElement(firstNames)} ${getRandomElement(lastNames)}`;
      const subjectsTaught = subjects[dept].slice(0, getRandomInt(2, 3)).join(', ');
      
      const [result] = await connection.query(
        'INSERT INTO users (name, registration_number, email, password, phone_number, department, subjects_taught, role) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [name, `TCH2025${String(i).padStart(3, '0')}`, `teacher${i}@iter.edu`, teacherPassword, `98765${String(43220 + i).padStart(5, '0')}`, dept, subjectsTaught, 'teacher']
      );
      teacherIds.push({ id: result.insertId, dept });
      
      if (i % 10 === 0) console.log(`   Created ${i} teachers...`);
    }
    console.log('   ✅ Created 50 teacher accounts\n');

    // Seed Students
    console.log('👨‍🎓 Creating student accounts...');
    const studentPassword = await bcrypt.hash('Student@123', 12);
    const studentIds = [];
    
    for (let i = 1; i <= 500; i++) {
      const dept = getRandomElement(departments);
      const year = getRandomInt(1, 4);
      const section = getRandomElement(sections);
      const name = `${getRandomElement(firstNames)} ${getRandomElement(lastNames)}`;
      
      const [result] = await connection.query(
        'INSERT INTO users (name, registration_number, email, password, phone_number, department, year, section, role) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [name, `STU2025${String(i).padStart(4, '0')}`, `student${i}@iter.edu`, studentPassword, `98765${String(44000 + i).padStart(5, '0')}`, dept, year, section, 'student']
      );
      studentIds.push({ id: result.insertId, dept, year, section });
      
      if (i % 100 === 0) console.log(`   Created ${i} students...`);
    }
    console.log('   ✅ Created 500 student accounts\n');

    // Seed Attendance (last 30 days)
    console.log('📊 Creating attendance records...');
    let attendanceCount = 0;
    const allSubjects = Object.values(subjects).flat();
    
    for (const student of studentIds.slice(0, 100)) { // First 100 students
      const studentSubjects = subjects[student.dept];
      for (let day = 0; day < 30; day++) {
        const date = new Date();
        date.setDate(date.getDate() - day);
        
        for (const subject of studentSubjects) {
          const status = Math.random() < 0.8 ? 'present' : (Math.random() < 0.7 ? 'absent' : 'late');
          const teacherId = teacherIds.find(t => t.dept === student.dept)?.id || teacherIds[0].id;
          
          await connection.query(
            'INSERT INTO attendance (student_id, subject, date, status, marked_by) VALUES (?, ?, ?, ?, ?)',
            [student.id, subject, date.toISOString().split('T')[0], status, teacherId]
          );
          attendanceCount++;
        }
      }
      if (attendanceCount % 500 === 0) console.log(`   Created ${attendanceCount} attendance records...`);
    }
    console.log(`   ✅ Created ${attendanceCount} attendance records\n`);

    // Seed Marks
    console.log('📝 Creating marks records...');
    let marksCount = 0;
    
    for (const student of studentIds.slice(0, 100)) {
      const studentSubjects = subjects[student.dept];
      for (const subject of studentSubjects) {
        const examTypes = ['internal', 'external', 'assignment', 'quiz'];
        for (const examType of examTypes) {
          const marksObtained = getRandomInt(40, 100);
          const teacherId = teacherIds.find(t => t.dept === student.dept)?.id || teacherIds[0].id;
          
          await connection.query(
            'INSERT INTO marks (student_id, subject, exam_type, marks_obtained, total_marks, exam_date, uploaded_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [student.id, subject, examType, marksObtained, 100, new Date(), teacherId]
          );
          marksCount++;
        }
      }
      if (marksCount % 100 === 0) console.log(`   Created ${marksCount} marks records...`);
    }
    console.log(`   ✅ Created ${marksCount} marks records\n`);

    // Seed Assignments
    console.log('📚 Creating assignments...');
    for (const dept of departments) {
      const deptSubjects = subjects[dept];
      for (let year = 1; year <= 4; year++) {
        for (const subject of deptSubjects) {
          const teacherId = teacherIds.find(t => t.dept === dept)?.id || teacherIds[0].id;
          const deadline = new Date();
          deadline.setDate(deadline.getDate() + getRandomInt(7, 30));
          
          await connection.query(
            'INSERT INTO assignments (title, description, subject, department, year, total_marks, deadline, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [`${subject} Assignment - Year ${year}`, `Complete the ${subject} assignment before deadline`, subject, dept, year, 100, deadline, teacherId]
          );
        }
      }
    }
    console.log('   ✅ Created assignments for all subjects\n');

    // Seed Events
    console.log('🎉 Creating events...');
    const eventTitles = ['Tech Fest 2025', 'Cultural Night', 'Sports Day', 'Workshop on AI', 'Seminar on Cloud Computing'];
    for (let i = 0; i < eventTitles.length; i++) {
      const eventDate = new Date();
      eventDate.setDate(eventDate.getDate() + (i + 1) * 7);
      
      await connection.query(
        'INSERT INTO events (title, description, event_date, event_time, location, category, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [eventTitles[i], `Join us for ${eventTitles[i]}`, eventDate, '10:00:00', 'Main Auditorium', 'Academic', 1]
      );
    }
    console.log('   ✅ Created 5 events\n');

    // Final verification
    const [finalUsers] = await connection.query('SELECT role, COUNT(*) as count FROM users GROUP BY role');
    const [finalAttendance] = await connection.query('SELECT COUNT(*) as count FROM attendance');
    const [finalMarks] = await connection.query('SELECT COUNT(*) as count FROM marks');
    const [finalAssignments] = await connection.query('SELECT COUNT(*) as count FROM assignments');

    console.log('╔══════════════════════════════════════════════╗');
    console.log('║  ✅ Railway Database Seeded Successfully!   ║');
    console.log('╚══════════════════════════════════════════════╝\n');
    
    console.log('📊 Final Statistics:');
    finalUsers.forEach(row => console.log(`   ${row.role}: ${row.count}`));
    console.log(`   Attendance: ${finalAttendance[0].count}`);
    console.log(`   Marks: ${finalMarks[0].count}`);
    console.log(`   Assignments: ${finalAssignments[0].count}\n`);

    console.log('🎓 Demo Accounts:');
    console.log('   Admin:   admin1@iter.edu / Admin@123456');
    console.log('   Teacher: teacher1@iter.edu / Teacher@123');
    console.log('   Student: student1@iter.edu / Student@123\n');

    await connection.end();

  } catch (error) {
    console.error('\n❌ Seeding failed:', error.message);
    console.error(error.stack);
    if (connection) await connection.end();
    process.exit(1);
  }
}

seedClean();
