// Vercel API endpoint to seed Railway database
// This runs INSIDE Vercel and can access mysql.railway.internal

const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');

// Security: Only allow seeding with secret key
const SEED_SECRET = process.env.SEED_SECRET || 'change-this-secret-key-123456';

module.exports = async (req, res) => {
  // Security check
  const { secret } = req.query;
  if (secret !== SEED_SECRET) {
    return res.status(403).json({ 
      success: false, 
      message: 'Unauthorized. Provide correct secret key.' 
    });
  }

  let connection;
  const startTime = Date.now();

  try {
    // Connect to Railway MySQL
    const dbConfig = {
      host: process.env.DB_HOST,
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      multipleStatements: true,
      connectTimeout: 30000
    };

    res.write('🔍 Connecting to Railway MySQL...\n');
    connection = await mysql.createConnection(dbConfig);
    res.write('✅ Connected successfully!\n\n');

    // Check if already seeded
    const [existingUsers] = await connection.query('SELECT COUNT(*) as count FROM users').catch(() => [[{ count: 0 }]]);
    
    if (existingUsers[0].count > 100) {
      res.write(`⚠️  Database already has ${existingUsers[0].count} users.\n`);
      res.write('Skipping seeding to avoid duplicates.\n');
      await connection.end();
      return res.end('\n✅ Database already populated!\n');
    }

    // Sample data
    const departments = ['CSE', 'IT', 'ECE', 'EEE', 'MECH', 'CIVIL'];
    const sections = ['A', 'B', 'C'];
    const firstNames = ['Aarav', 'Vivaan', 'Aditya', 'Arjun', 'Sai', 'Diya', 'Ananya', 'Isha', 'Priya', 'Sneha'];
    const lastNames = ['Sharma', 'Verma', 'Patel', 'Kumar', 'Singh', 'Reddy', 'Gupta', 'Joshi'];

    const getRandomElement = (arr) => arr[Math.floor(Math.random() * arr.length)];
    const getRandomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

    // Seed Admins
    res.write('👨‍💼 Creating admin accounts...\n');
    const adminPassword = await bcrypt.hash('Admin@123456', 12);
    
    for (let i = 1; i <= 3; i++) {
      await connection.query(
        'INSERT INTO users (name, registration_number, email, password, phone_number, department, role) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [`Admin ${i}`, `ADM2025${String(i).padStart(3, '0')}`, `admin${i}@iter.edu`, adminPassword, `987654321${i}`, 'Administration', 'admin']
      );
    }
    res.write('✅ Created 3 admin accounts\n\n');

    // Seed Teachers
    res.write('👨‍🏫 Creating teacher accounts...\n');
    const teacherPassword = await bcrypt.hash('Teacher@123', 12);
    
    for (let i = 1; i <= 20; i++) {
      const dept = getRandomElement(departments);
      const name = `${getRandomElement(['Dr.', 'Prof.', 'Mr.', 'Mrs.'])} ${getRandomElement(firstNames)} ${getRandomElement(lastNames)}`;
      
      await connection.query(
        'INSERT INTO users (name, registration_number, email, password, phone_number, department, role) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [name, `TCH2025${String(i).padStart(3, '0')}`, `teacher${i}@iter.edu`, teacherPassword, `987654${String(3220 + i).padStart(4, '0')}`, dept, 'teacher']
      );
    }
    res.write('✅ Created 20 teacher accounts\n\n');

    // Seed Students
    res.write('👨‍🎓 Creating student accounts...\n');
    const studentPassword = await bcrypt.hash('Student@123', 12);
    const studentIds = [];
    
    for (let i = 1; i <= 100; i++) {
      const dept = getRandomElement(departments);
      const year = getRandomInt(1, 4);
      const section = getRandomElement(sections);
      const name = `${getRandomElement(firstNames)} ${getRandomElement(lastNames)}`;
      
      const [result] = await connection.query(
        'INSERT INTO users (name, registration_number, email, password, phone_number, department, year, section, role) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [name, `STU2025${String(i).padStart(4, '0')}`, `student${i}@iter.edu`, studentPassword, `987654${String(4000 + i).padStart(4, '0')}`, dept, year, section, 'student']
      );
      studentIds.push(result.insertId);
      
      if (i % 20 === 0) {
        res.write(`   Created ${i} students...\n`);
      }
    }
    res.write('✅ Created 100 student accounts\n\n');

    // Seed Attendance
    res.write('📊 Creating attendance records...\n');
    const subjects = ['Mathematics', 'Physics', 'Chemistry', 'Programming', 'Database'];
    const statuses = ['present', 'present', 'present', 'absent', 'late']; // 60% present
    let attendanceCount = 0;
    
    for (const studentId of studentIds.slice(0, 50)) { // First 50 students
      for (let day = 1; day <= 30; day++) {
        const date = new Date(2025, 9, day); // October 2025
        const subject = getRandomElement(subjects);
        const status = getRandomElement(statuses);
        
        await connection.query(
          'INSERT INTO attendance (student_id, subject, date, status, marked_by) VALUES (?, ?, ?, ?, ?)',
          [studentId, subject, date, status, 1]
        );
        attendanceCount++;
      }
    }
    res.write(`✅ Created ${attendanceCount} attendance records\n\n`);

    // Seed Marks
    res.write('📝 Creating marks records...\n');
    const examTypes = ['internal', 'external', 'assignment', 'quiz'];
    let marksCount = 0;
    
    for (const studentId of studentIds.slice(0, 50)) {
      for (const subject of subjects) {
        const examType = getRandomElement(examTypes);
        const marksObtained = getRandomInt(40, 100);
        const totalMarks = 100;
        
        await connection.query(
          'INSERT INTO marks (student_id, subject, exam_type, marks_obtained, total_marks, exam_date, uploaded_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [studentId, subject, examType, marksObtained, totalMarks, new Date(), 1]
        );
        marksCount++;
      }
    }
    res.write(`✅ Created ${marksCount} marks records\n\n`);

    // Seed Assignments
    res.write('📚 Creating assignments...\n');
    for (let i = 1; i <= 10; i++) {
      const dept = getRandomElement(departments);
      const subject = getRandomElement(subjects);
      const title = `Assignment ${i} - ${subject}`;
      const description = `Complete the ${subject} assignment by the deadline.`;
      const dueDate = new Date(2025, 10, i + 10); // November 2025
      
      await connection.query(
        'INSERT INTO assignments (title, description, subject, department, due_date, total_marks, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [title, description, subject, dept, dueDate, 100, 1]
      );
    }
    res.write('✅ Created 10 assignments\n\n');

    // Seed Events
    res.write('🎉 Creating events...\n');
    const eventTitles = ['Tech Fest', 'Cultural Night', 'Sports Day', 'Workshop', 'Seminar'];
    for (let i = 0; i < eventTitles.length; i++) {
      const eventDate = new Date(2025, 10, (i + 1) * 5);
      
      await connection.query(
        'INSERT INTO events (title, description, event_date, event_time, location, category, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [eventTitles[i], `Join us for ${eventTitles[i]}`, eventDate, '10:00:00', 'Main Auditorium', 'Academic', 1]
      );
    }
    res.write('✅ Created 5 events\n\n');

    // Verify
    const [finalUsers] = await connection.query('SELECT role, COUNT(*) as count FROM users GROUP BY role');
    const [finalAttendance] = await connection.query('SELECT COUNT(*) as count FROM attendance');
    const [finalMarks] = await connection.query('SELECT COUNT(*) as count FROM marks');

    res.write('\n📊 Final Statistics:\n');
    res.write('─────────────────────\n');
    finalUsers.forEach(row => {
      res.write(`   ${row.role}: ${row.count}\n`);
    });
    res.write(`   Attendance: ${finalAttendance[0].count}\n`);
    res.write(`   Marks: ${finalMarks[0].count}\n`);

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    res.write(`\n⏱️  Completed in ${duration} seconds\n`);
    res.write('\n✅ Database seeded successfully!\n\n');
    res.write('🎓 Demo Accounts:\n');
    res.write('   Admin:   admin1@iter.edu / Admin@123456\n');
    res.write('   Teacher: teacher1@iter.edu / Teacher@123\n');
    res.write('   Student: student1@iter.edu / Student@123\n');

    await connection.end();
    res.end();

  } catch (error) {
    console.error('Seeding error:', error);
    if (connection) await connection.end();
    
    res.status(500).json({
      success: false,
      message: error.message,
      error: error.toString()
    });
  }
};
