/**
 * Comprehensive Seeder (Idempotent)
 * ---------------------------------
 * This script populates the database with comprehensive demo data.
 * It is designed to be rerun safely:
 *  - Users (admins/teachers/students) are upserted using ON DUPLICATE KEY UPDATE
 *    combined with LAST_INSERT_ID so we can reuse existing IDs on reruns.
 *  - Many bulk tables use INSERT IGNORE to avoid duplicate key failures when the
 *    script is executed multiple times.
 *  - System settings and some file records are upserted to keep values updated.
 *  - Filenames are sanitized to avoid platform path issues (e.g., CAD/CAM).
 *
 * You can run this multiple times without needing to drop the database.
 */
require('dotenv').config();
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  multipleStatements: true
};

const dbName = process.env.DB_NAME || 'iter_college_db';

// Enhanced sample data
const departments = ['CSE', 'IT', 'ECE', 'EEE', 'MECH', 'CIVIL'];
const sections = ['A', 'B', 'C', 'D'];

const subjects = {
  CSE: ['Data Structures', 'Algorithms', 'Database Management', 'Operating Systems', 'Computer Networks', 'Software Engineering', 'Web Development', 'Machine Learning'],
  IT: ['Web Development', 'Mobile Computing', 'Cloud Computing', 'Cyber Security', 'AI & ML', 'IoT', 'Big Data Analytics', 'DevOps'],
  ECE: ['Digital Electronics', 'Signals & Systems', 'VLSI Design', 'Embedded Systems', 'Communication Systems', 'Microprocessors', 'Control Systems', 'RF Engineering'],
  EEE: ['Power Systems', 'Control Systems', 'Electrical Machines', 'Power Electronics', 'Renewable Energy', 'Electric Drives', 'High Voltage Engineering', 'Smart Grid'],
  MECH: ['Thermodynamics', 'Fluid Mechanics', 'Manufacturing Processes', 'CAD/CAM', 'Machine Design', 'Heat Transfer', 'Robotics', 'Automotive Engineering'],
  CIVIL: ['Structural Analysis', 'Concrete Technology', 'Surveying', 'Geotechnical Engineering', 'Transportation Engineering', 'Hydraulics', 'Environmental Engineering', 'Construction Management']
};

const indianFirstNames = [
  'Aarav', 'Vivaan', 'Aditya', 'Arjun', 'Sai', 'Vihaan', 'Aryan', 'Reyansh', 'Ayush', 'Krishna',
  'Diya', 'Ananya', 'Isha', 'Priya', 'Sneha', 'Aanya', 'Avni', 'Sara', 'Kavya', 'Riya',
  'Rohan', 'Karan', 'Akash', 'Rahul', 'Amit', 'Nikhil', 'Harsh', 'Varun', 'Yash', 'Dhruv',
  'Neha', 'Pooja', 'Shreya', 'Tanvi', 'Megha', 'Divya', 'Sakshi', 'Anjali', 'Preeti', 'Swati',
  'Rajesh', 'Suresh', 'Vikram', 'Anil', 'Ramesh', 'Manoj', 'Sanjay', 'Ajay', 'Vijay', 'Prakash'
];

const indianLastNames = [
  'Sharma', 'Verma', 'Patel', 'Kumar', 'Singh', 'Reddy', 'Gupta', 'Joshi', 'Mehta', 'Nair',
  'Rao', 'Desai', 'Kulkarni', 'Mishra', 'Pandey', 'Iyer', 'Malhotra', 'Banerjee', 'Chatterjee', 'Das',
  'Agarwal', 'Shah', 'Chopra', 'Kapoor', 'Sinha', 'Bose', 'Ghosh', 'Pillai', 'Menon', 'Varma'
];

const clubNames = [
  { name: 'Coding Club', category: 'Technical', description: 'For programming enthusiasts and competitive coders' },
  { name: 'Robotics Club', category: 'Technical', description: 'Build and program robots for competitions' },
  { name: 'Photography Club', category: 'Cultural', description: 'Capture moments and learn photography techniques' },
  { name: 'Music Club', category: 'Cultural', description: 'For music lovers - vocals and instruments' },
  { name: 'Drama Society', category: 'Cultural', description: 'Theater and performing arts' },
  { name: 'Sports Club', category: 'Sports', description: 'Multiple sports activities and competitions' },
  { name: 'Entrepreneurship Cell', category: 'Professional', description: 'Foster startup culture and innovation' },
  { name: 'Literary Society', category: 'Cultural', description: 'Books, debates, and creative writing' },
  { name: 'Dance Club', category: 'Cultural', description: 'Various dance forms and performances' },
  { name: 'IEEE Student Branch', category: 'Technical', description: 'Professional development for engineers' }
];

const achievementTypes = [
  { title: 'First Year Excellence', badge: '🏆', category: 'Academic' },
  { title: 'Perfect Attendance', badge: '📅', category: 'Attendance' },
  { title: 'Coding Competition Winner', badge: '💻', category: 'Technical' },
  { title: 'Sports Champion', badge: '⚽', category: 'Sports' },
  { title: 'Cultural Fest Winner', badge: '🎭', category: 'Cultural' },
  { title: 'Research Paper Published', badge: '📄', category: 'Research' },
  { title: 'Hackathon Participant', badge: '🚀', category: 'Technical' },
  { title: 'Community Service', badge: '🤝', category: 'Social' }
];

// Utility functions
const getRandomElement = (arr) => arr[Math.floor(Math.random() * arr.length)];
const getRandomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const shuffleArray = (array) => {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

// Sanitize a string to be safe in filenames (no path separators or special chars)
const sanitizeSegment = (str) => {
  return String(str)
    .normalize('NFKD')
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_.-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
};

// Create sample PDF content
const createSamplePDF = async (title, content) => {
  const pdfContent = `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/Resources 4 0 R/MediaBox[0 0 612 792]/Contents 5 0 R>>endobj
4 0 obj<</Font<</F1<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>>>>>endobj
5 0 obj<</Length 120>>stream
BT /F1 24 Tf 50 700 Td (${title}) Tj 0 -30 Td /F1 12 Tf (${content}) Tj ET
endstream endobj
xref 0 6
0000000000 65535 f 0000000009 00000 n 0000000058 00000 n 0000000115 00000 n 0000000214 00000 n 0000000304 00000 n 
trailer<</Size 6/Root 1 0 R>>startxref 453 %%EOF`;
  return Buffer.from(pdfContent);
};

async function comprehensiveSeed() {
  let connection;
  
  try {
    console.log('🚀 Starting Comprehensive Database Seeding...\n');
    console.log('═══════════════════════════════════════════════════════\n');

    connection = await mysql.createConnection(dbConfig);
    console.log('✓ Connected to MySQL');

    await connection.query(`CREATE DATABASE IF NOT EXISTS ${dbName}`);
    await connection.query(`USE ${dbName}`);
    console.log(`✓ Database ${dbName} ready\n`);

    // Read and execute schema
    const schemaPath = path.join(__dirname, '../database/init.sql');
    const schema = await fs.readFile(schemaPath, 'utf8');
    await connection.query(schema);
    console.log('✓ Database schema initialized\n');

    // Create uploads directory
    const uploadsDir = path.join(__dirname, '../uploads');
    await fs.mkdir(uploadsDir, { recursive: true });

    // =============================================================================
    // SEED ADMIN ACCOUNTS
    // =============================================================================
    console.log('👤 Creating admin accounts...');
    const adminPassword = await bcrypt.hash('Admin@123456', 12);
    const adminData = [
      ['Admin One', 'ADM2025001', 'admin1@iter.edu', adminPassword, '9876543210', 'Administration'],
      ['Admin Two', 'ADM2025002', 'admin2@iter.edu', adminPassword, '9876543211', 'Administration'],
      ['Admin Three', 'ADM2025003', 'admin3@iter.edu', adminPassword, '9876543212', 'Administration']
    ];

    // Upsert admins to make seeding idempotent
    const upsertAdminSql = `
      INSERT INTO users (name, registration_number, email, password, phone_number, department, role)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        id = LAST_INSERT_ID(id),
        name = VALUES(name),
        email = VALUES(email),
        phone_number = VALUES(phone_number),
        department = VALUES(department),
        role = VALUES(role)
    `;
    for (const admin of adminData) {
      await connection.query(upsertAdminSql, [...admin, 'admin']);
    }
    console.log('✓ Created 3 admin accounts\n');

    // =============================================================================
    // SEED TEACHERS
    // =============================================================================
    console.log('👨‍🏫 Creating teacher accounts...');
    const teacherPassword = await bcrypt.hash('Teacher@123', 12);
    const teacherIds = [];

    for (let i = 0; i < 50; i++) {
      const dept = getRandomElement(departments);
      const titles = ['Dr.', 'Prof.', 'Mr.', 'Ms.', 'Mrs.'];
      const firstName = getRandomElement(indianFirstNames);
      const lastName = getRandomElement(indianLastNames);
      const name = `${getRandomElement(titles)} ${firstName} ${lastName}`;
      const regNumber = `TCH2025${String(i + 1).padStart(3, '0')}`;
      const email = `teacher${i + 1}@iter.edu`;
      const phone = `98765${String(43220 + i).padStart(5, '0')}`;
      
      const deptSubjects = subjects[dept];
      const numSubjects = getRandomInt(2, 4);
      const teacherSubjects = shuffleArray(deptSubjects).slice(0, numSubjects);
      const subjectsTaught = teacherSubjects.join(', ');

      // Upsert teachers and capture ID even on duplicate using LAST_INSERT_ID trick
      const upsertTeacherSql = `
        INSERT INTO users (name, registration_number, email, password, phone_number, department, subjects_taught, role, is_active, last_login)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
        ON DUPLICATE KEY UPDATE
          id = LAST_INSERT_ID(id),
          name = VALUES(name),
          email = VALUES(email),
          phone_number = VALUES(phone_number),
          department = VALUES(department),
          subjects_taught = VALUES(subjects_taught),
          role = VALUES(role),
          is_active = VALUES(is_active)
      `;
      const [result] = await connection.query(
        upsertTeacherSql,
        [name, regNumber, email, teacherPassword, phone, dept, subjectsTaught, 'teacher', true]
      );
      
      teacherIds.push({ 
        id: result.insertId, 
        dept, 
        subjects: teacherSubjects,
        name
      });
    }
    console.log('✓ Created 50 teacher accounts\n');

    // =============================================================================
    // SEED STUDENTS
    // =============================================================================
    console.log('👨‍🎓 Creating student accounts...');
    const studentPassword = await bcrypt.hash('Student@123', 12);
    const studentIds = [];

    for (let i = 0; i < 500; i++) {
      const dept = getRandomElement(departments);
      const year = getRandomInt(1, 4);
      const section = getRandomElement(sections);
      const firstName = getRandomElement(indianFirstNames);
      const lastName = getRandomElement(indianLastNames);
      const name = `${firstName} ${lastName}`;
      const regNumber = `STU2025${String(i + 1).padStart(4, '0')}`;
      const email = `student${i + 1}@iter.edu`;
      const phone = `98000${String(10000 + i).padStart(5, '0')}`;

      // Upsert students and capture ID on duplicates
      const upsertStudentSql = `
        INSERT INTO users (name, registration_number, email, password, phone_number, department, year, section, role, is_active, last_login)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
        ON DUPLICATE KEY UPDATE
          id = LAST_INSERT_ID(id),
          name = VALUES(name),
          email = VALUES(email),
          phone_number = VALUES(phone_number),
          department = VALUES(department),
          year = VALUES(year),
          section = VALUES(section),
          role = VALUES(role),
          is_active = VALUES(is_active)
      `;
      const [result] = await connection.query(
        upsertStudentSql,
        [name, regNumber, email, studentPassword, phone, dept, year, section, 'student', true]
      );
      
      studentIds.push({ 
        id: result.insertId, 
        dept, 
        year, 
        section, 
        name, 
        regNumber 
      });
    }
    console.log('✓ Created 500 student accounts\n');

    // =============================================================================
    // SEED ATTENDANCE (with realistic variations)
    // =============================================================================
    console.log('📊 Creating attendance records...');
    const today = new Date();
    let attendanceCount = 0;

    for (const student of studentIds) {
      const studentSubjects = subjects[student.dept];
      const attendancePercent = getRandomInt(70, 98); // Each student has base attendance
      
      for (const subject of studentSubjects) {
        // Go back 60 days
        for (let day = 0; day < 60; day++) {
          const date = new Date(today);
          date.setDate(date.getDate() - day);
          
          // Skip Sundays
          if (date.getDay() === 0) continue;
          
          const dateStr = date.toISOString().split('T')[0];
          
          // Determine status based on student's base attendance with variation
          const randomChance = Math.random() * 100;
          let status;
          if (randomChance < attendancePercent - 5) {
            status = 'present';
          } else if (randomChance < attendancePercent + 5) {
            status = 'late';
          } else {
            status = 'absent';
          }
          
          const teacher = teacherIds.find(t => 
            t.dept === student.dept && t.subjects.includes(subject)
          );
          
          if (teacher) {
            await connection.query(
              'INSERT IGNORE INTO attendance (student_id, subject, date, status, marked_by, remarks) VALUES (?, ?, ?, ?, ?, ?)',
              [student.id, subject, dateStr, status, teacher.id, status === 'late' ? 'Arrived 10 minutes late' : null]
            );
            attendanceCount++;
          }
        }
      }
    }
    console.log(`✓ Created ${attendanceCount} attendance records\n`);

    // =============================================================================
    // SEED MARKS (varied and realistic)
    // =============================================================================
    console.log('📈 Creating marks records...');
    let marksCount = 0;

    for (const student of studentIds) {
      const studentSubjects = subjects[student.dept];
      const basePerformance = getRandomInt(65, 95); // Each student has base performance level
      
      for (const subject of studentSubjects) {
        const examTypes = [
          { type: 'internal', total: 30, count: 3 },
          { type: 'assignment', total: 20, count: 4 },
          { type: 'quiz', total: 10, count: 5 },
          { type: 'external', total: 100, count: 1 }
        ];
        
        for (const examConfig of examTypes) {
          for (let i = 0; i < examConfig.count; i++) {
            const variation = getRandomInt(-10, 10);
            const performancePercent = Math.max(50, Math.min(100, basePerformance + variation));
            const marksObtained = Math.round((examConfig.total * performancePercent) / 100);
            
            const examDate = new Date(today);
            examDate.setDate(examDate.getDate() - getRandomInt(10, 180));
            
            const teacher = teacherIds.find(t => 
              t.dept === student.dept && t.subjects.includes(subject)
            );
            
            if (teacher) {
              await connection.query(
                'INSERT IGNORE INTO marks (student_id, subject, exam_type, marks_obtained, total_marks, exam_date, uploaded_by, remarks) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                [
                  student.id, 
                  subject, 
                  examConfig.type, 
                  marksObtained, 
                  examConfig.total, 
                  examDate.toISOString().split('T')[0], 
                  teacher.id,
                  performancePercent > 90 ? 'Excellent performance' : (performancePercent < 60 ? 'Needs improvement' : null)
                ]
              );
              marksCount++;
            }
          }
        }
      }
    }
    console.log(`✓ Created ${marksCount} marks records\n`);

    // =============================================================================
    // SEED FILES (Notes, PYQs, Study Materials)
    // =============================================================================
    console.log('📚 Creating file records...');
    let filesCount = 0;

    for (const dept of departments) {
      const deptSubjects = subjects[dept];
      
      // Notes for each subject
      for (const subject of deptSubjects) {
        for (let unit = 1; unit <= 5; unit++) {
          const filename = `${sanitizeSegment(dept)}_${sanitizeSegment(subject)}_Unit${unit}_Notes.pdf`;
          const filepath = path.join(uploadsDir, filename);
          
          const pdfBuffer = await createSamplePDF(
            `${subject} - Unit ${unit}`,
            `Comprehensive notes for ${subject}, Unit ${unit}. Department: ${dept}.`
          );
          
          await fs.writeFile(filepath, pdfBuffer);
          
          const checksum = crypto.createHash('sha256').update(pdfBuffer).digest('hex');
          const teacher = teacherIds.find(t => t.dept === dept && t.subjects.includes(subject));
          
          if (teacher) {
            await connection.query(
              `INSERT IGNORE INTO files (original_name, stored_name, mime_type, file_size, checksum, file_path, public_url, category, subject, uploaded_by, approved, approved_by, approved_at, description, download_count) 
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?)`,
              [filename, filename, 'application/pdf', pdfBuffer.length, checksum, filepath, 
               `/uploads/${filename}`, 'note', subject, teacher.id, true, 1, 
               `Unit ${unit} notes for ${subject}`, getRandomInt(50, 500)]
            );
            filesCount++;
          }
        }
      }

      // Previous Year Questions
      for (const subject of deptSubjects) {
        for (let year = 2020; year <= 2024; year++) {
          const filename = `${sanitizeSegment(dept)}_${sanitizeSegment(subject)}_PYQ_${year}.pdf`;
          const filepath = path.join(uploadsDir, filename);
          
          const pdfBuffer = await createSamplePDF(
            `${subject} - Previous Year Question ${year}`,
            `End-semester examination question paper for ${subject} - ${year}.`
          );
          
          await fs.writeFile(filepath, pdfBuffer);
          
          const checksum = crypto.createHash('sha256').update(pdfBuffer).digest('hex');
          const teacher = teacherIds.find(t => t.dept === dept);
          
          if (teacher) {
            await connection.query(
              `INSERT IGNORE INTO files (original_name, stored_name, mime_type, file_size, checksum, file_path, public_url, category, subject, uploaded_by, approved, approved_by, approved_at, description, download_count) 
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?)`,
              [filename, filename, 'application/pdf', pdfBuffer.length, checksum, filepath,
               `/uploads/${filename}`, 'pyq', subject, teacher.id, true, 1,
               `Previous year question paper ${year}`, getRandomInt(100, 800)]
            );
            filesCount++;
          }
        }
      }
    }

    // Admit cards for random students
    for (let i = 0; i < 50; i++) {
      const student = studentIds[getRandomInt(0, studentIds.length - 1)];
  const filename = `AdmitCard_${sanitizeSegment(student.regNumber)}_Sem${getRandomInt(1, 8)}.pdf`;
      const filepath = path.join(uploadsDir, filename);
      
      const pdfBuffer = await createSamplePDF(
        'ADMIT CARD - End Semester Examination',
        `Student: ${student.name}\\nReg No: ${student.regNumber}\\nDept: ${student.dept}`
      );
      
      await fs.writeFile(filepath, pdfBuffer);
      
      const checksum = crypto.createHash('sha256').update(pdfBuffer).digest('hex');
      const verificationCode = crypto.randomBytes(8).toString('hex').toUpperCase();
      
      const [fileResult] = await connection.query(
        `INSERT INTO files (original_name, stored_name, mime_type, file_size, checksum, file_path, public_url, category, uploaded_by, approved, approved_by, approved_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE
           id = LAST_INSERT_ID(id),
           mime_type = VALUES(mime_type),
           file_size = VALUES(file_size),
           file_path = VALUES(file_path),
           public_url = VALUES(public_url),
           category = VALUES(category),
           uploaded_by = VALUES(uploaded_by),
           approved = VALUES(approved),
           approved_by = VALUES(approved_by),
           approved_at = NOW()`,
        [filename, filename, 'application/pdf', pdfBuffer.length, checksum, filepath,
         `/uploads/${filename}`, 'admit_card', 1, true, 1]
      );
      
      const examDate = new Date(today);
      examDate.setDate(examDate.getDate() + getRandomInt(30, 90));
      
      await connection.query(
        'INSERT IGNORE INTO admit_cards (student_id, exam_name, exam_date, file_id, verification_code, qr_code) VALUES (?, ?, ?, ?, ?, ?)',
        [student.id, `Semester ${student.year * 2} End Examination 2025`, 
         examDate.toISOString().split('T')[0], fileResult.insertId, verificationCode,
         `https://api.qrserver.com/v1/create-qr-code/?data=${verificationCode}`]
      );
      filesCount++;
    }

    console.log(`✓ Created ${filesCount} file records\n`);

    // =============================================================================
    // SEED CLUBS
    // =============================================================================
    console.log('🎯 Creating clubs...');
    const clubIds = [];

    for (const club of clubNames) {
      const president = studentIds[getRandomInt(100, studentIds.length - 1)];
      const coordinator = teacherIds[getRandomInt(0, teacherIds.length - 1)];
      
      const [result] = await connection.query(
        'INSERT IGNORE INTO clubs (name, description, category, president_id, faculty_coordinator_id, is_active) VALUES (?, ?, ?, ?, ?, ?)',
        [club.name, club.description, club.category, president.id, coordinator.id, true]
      );
      if (result.insertId) clubIds.push(result.insertId);
    }
    console.log(`✓ Created ${clubNames.length} clubs\n`);

    // =============================================================================
    // SEED EVENTS
    // =============================================================================
    console.log('🎉 Creating events...');
    const eventCategories = ['Technical', 'Cultural', 'Sports', 'Workshop', 'Seminar', 'Hackathon', 'Competition'];
    const eventNames = [
      'TechFest 2025', 'Code Sprint', 'Cultural Night', 'Sports Day', 'Innovation Summit',
      'AI Workshop', 'Debate Competition', 'Music Fest', 'Robotics Challenge', 'Startup Weekend',
      'Photography Exhibition', 'Dance Competition', 'Tech Talk Series', 'Career Fair', 'Freshers Welcome'
    ];

    for (let i = 0; i < 30; i++) {
      const futureDate = new Date(today);
      futureDate.setDate(futureDate.getDate() + getRandomInt(1, 120));
      const category = getRandomElement(eventCategories);
      const creator = i % 2 === 0 ? teacherIds[getRandomInt(0, teacherIds.length - 1)] : { id: 1 };
      
      await connection.query(
        `INSERT INTO events (title, description, event_date, event_time, location, category, max_participants, registration_deadline, created_by, is_active, image_url) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          getRandomElement(eventNames),
          `An exciting ${category.toLowerCase()} event for all students. Don't miss this opportunity!`,
          futureDate.toISOString().split('T')[0],
          `${getRandomInt(9, 17)}:00:00`,
          `${getRandomElement(['Main Auditorium', 'Seminar Hall', 'Open Ground', 'Computer Lab', 'Workshop', 'Library Hall'])}`,
          category,
          getRandomInt(50, 300),
          new Date(futureDate.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          creator.id,
          true,
          `https://picsum.photos/seed/${i}/800/400`
        ]
      );
    }
    console.log('✓ Created 30 events\n');

    // Event registrations
    console.log('📝 Creating event registrations...');
    const [eventList] = await connection.query('SELECT id FROM events LIMIT 30');
    for (const event of eventList) {
      const numRegistrations = getRandomInt(10, 50);
      const registeredStudents = shuffleArray(studentIds).slice(0, numRegistrations);
      
      for (const student of registeredStudents) {
        await connection.query(
          'INSERT IGNORE INTO event_registrations (event_id, user_id, status) VALUES (?, ?, ?)',
          [event.id, student.id, getRandomElement(['registered', 'attended', 'cancelled'])]
        );
      }
    }
    console.log('✓ Created event registrations\n');

    // =============================================================================
    // SEED TIMETABLE
    // =============================================================================
    console.log('📅 Creating timetable...');
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const timeSlots = ['09:00-10:00', '10:00-11:00', '11:00-12:00', '12:00-13:00', '14:00-15:00', '15:00-16:00', '16:00-17:00'];

    for (const dept of departments) {
      for (const year of [1, 2, 3, 4]) {
        for (const section of sections) {
          const deptSubjects = subjects[dept];
          let subjectIndex = 0;
          
          for (const day of days) {
            for (let slotIdx = 0; slotIdx < timeSlots.length; slotIdx++) {
              // Add some breaks
              if (slotIdx === 3 || (day === 'Wednesday' && slotIdx > 4)) {
                continue; // Lunch break or early closing
              }
              
              const timeSlot = timeSlots[slotIdx];
              const subject = deptSubjects[subjectIndex % deptSubjects.length];
              const teacher = teacherIds.find(t => t.dept === dept && t.subjects.includes(subject));
              
              if (teacher) {
                await connection.query(
                  'INSERT IGNORE INTO timetable (department, year, section, day_of_week, time_slot, subject, teacher_id, room_number, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                  [dept, year, section, day, timeSlot, subject, teacher.id, `${dept}-${getRandomInt(101, 450)}`, true]
                );
              }
              
              subjectIndex++;
            }
          }
        }
      }
    }
    console.log('✓ Created timetable entries\n');

    // =============================================================================
    // SEED HOSTEL MENU
    // =============================================================================
    console.log('🍽️ Creating hostel menu...');
    const breakfastItems = ['Idli Sambar', 'Poha', 'Upma', 'Paratha with Curd', 'Bread Toast & Jam', 'Aloo Paratha', 'Dosa', 'Vada'];
    const lunchItems = ['Rice, Dal, Sabji, Roti', 'Biryani with Raita', 'Chole Bhature', 'Rajma Chawal', 'Paneer Curry with Rice', 'Mixed Veg Pulao', 'Sambar Rice'];
    const snacksItems = ['Samosa', 'Pakora', 'Sandwich', 'Biscuits & Tea', 'Fruit', 'Vada Pav', 'Bhel Puri', 'Bread Pakora'];
    const dinnerItems = ['Roti, Dal, Rice', 'Noodles', 'Fried Rice', 'Pulao with Raita', 'Mixed Vegetables', 'Chicken Curry', 'Fish Fry', 'Egg Curry'];

    for (let day = -30; day < 60; day++) {
      const menuDate = new Date(today);
      menuDate.setDate(menuDate.getDate() + day);
      const dateStr = menuDate.toISOString().split('T')[0];
      
      await connection.query(
        'INSERT IGNORE INTO hostel_menu (date, meal_type, menu_items) VALUES (?, ?, ?), (?, ?, ?), (?, ?, ?), (?, ?, ?)',
        [
          dateStr, 'breakfast', getRandomElement(breakfastItems),
          dateStr, 'lunch', getRandomElement(lunchItems),
          dateStr, 'snacks', getRandomElement(snacksItems),
          dateStr, 'dinner', getRandomElement(dinnerItems)
        ]
      );
    }
    console.log('✓ Created hostel menu\n');

    // =============================================================================
    // SEED ASSIGNMENTS
    // =============================================================================
    console.log('📝 Creating assignments...');
    let assignmentsCount = 0;

    for (const dept of departments) {
      const deptTeachers = teacherIds.filter(t => t.dept === dept);
      const deptSubjects = subjects[dept];
      
      for (const year of [1, 2, 3, 4]) {
        for (const subject of deptSubjects) {
          for (let i = 0; i < 3; i++) {
            const teacher = deptTeachers.find(t => t.subjects.includes(subject)) || getRandomElement(deptTeachers);
            const deadline = new Date(today);
            deadline.setDate(deadline.getDate() + getRandomInt(-10, 45));
            
            const [assignmentResult] = await connection.query(
              'INSERT IGNORE INTO assignments (title, description, subject, department, year, total_marks, deadline, created_by, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
              [
                `${subject} Assignment ${i + 1}`,
                `Complete the assignment on ${subject}. Submit detailed solutions with proper documentation. Late submissions will incur penalty.`,
                subject,
                dept,
                year,
                getRandomElement([10, 15, 20, 25, 30]),
                deadline,
                teacher.id,
                true
              ]
            );
            
            // Create some submissions for past assignments
            if (assignmentResult.insertId && deadline < today) {
              const yearStudents = studentIds.filter(s => s.dept === dept && s.year === year);
              const numSubmissions = Math.floor(yearStudents.length * getRandomInt(60, 95) / 100);
              const submittingStudents = shuffleArray(yearStudents).slice(0, numSubmissions);
              
              for (const student of submittingStudents) {
                const marksObtained = getRandomInt(12, 30);
                const submitDate = new Date(deadline);
                submitDate.setDate(submitDate.getDate() - getRandomInt(0, 3));
                
                await connection.query(
                  'INSERT IGNORE INTO assignment_submissions (assignment_id, student_id, submission_text, submitted_at, marks_obtained, status, graded_by, graded_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                  [
                    assignmentResult.insertId,
                    student.id,
                    'Assignment completed and submitted as per requirements.',
                    submitDate,
                    marksObtained,
                    marksObtained >= 20 ? 'graded' : 'graded',
                    teacher.id,
                    new Date(submitDate.getTime() + 2 * 24 * 60 * 60 * 1000)
                  ]
                );
              }
            }
            
            assignmentsCount++;
          }
        }
      }
    }
    console.log(`✓ Created ${assignmentsCount} assignments\n`);

    // =============================================================================
    // SEED ANNOUNCEMENTS
    // =============================================================================
    console.log('📢 Creating announcements...');
    const announcementTemplates = [
      { title: 'Mid-semester exams schedule released', content: 'The mid-semester examination schedule has been released. Check your timetable for exam dates and venues.', category: 'exam' },
      { title: 'Library timing extended', content: 'Central library hours have been extended till 10 PM during the examination period.', category: 'general' },
      { title: 'New courses for next semester', content: 'Registration for elective courses for the next semester is now open. Visit the academic section.', category: 'academic' },
      { title: 'Sports day registration', content: 'Annual sports day registration is now open. Participate in various indoor and outdoor events.', category: 'event' },
      { title: 'Technical fest coming soon', content: 'Get ready for the biggest technical fest of the year. Register your teams now!', category: 'event' },
      { title: 'Placement drive next week', content: 'Major tech companies will be visiting campus for placement drives. Eligible students should register.', category: 'general' },
      { title: 'Hostel allocation for new semester', content: 'Hostel room allocation for the new semester will begin from next Monday.', category: 'general' },
      { title: 'Workshop on AI and ML', content: 'A 3-day workshop on Artificial Intelligence and Machine Learning will be conducted by industry experts.', category: 'academic' },
      { title: 'Fee payment deadline approaching', content: 'Last date for semester fee payment is approaching. Pay before the deadline to avoid penalties.', category: 'urgent' },
      { title: 'Guest lecture by industry expert', content: 'Distinguished alumnus will deliver a guest lecture on emerging technologies this Friday.', category: 'event' }
    ];

    for (let i = 0; i < announcementTemplates.length; i++) {
      const template = announcementTemplates[i];
      const daysAgo = getRandomInt(0, 15);
      const createdAt = new Date(today);
      createdAt.setDate(createdAt.getDate() - daysAgo);
      
      await connection.query(
        `INSERT IGNORE INTO announcements (title, content, category, target_audience, target_department, posted_by, is_pinned, created_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          template.title,
          template.content,
          template.category,
          Math.random() > 0.7 ? 'students' : 'all',
          Math.random() > 0.8 ? getRandomElement(departments) : null,
          getRandomElement(teacherIds).id,
          i < 3, // Pin first 3
          createdAt
        ]
      );
    }
    console.log('✓ Created announcements\n');

    // =============================================================================
    // SEED ACHIEVEMENTS
    // =============================================================================
    console.log('🏆 Creating achievements...');
    for (let i = 0; i < 100; i++) {
      const student = studentIds[getRandomInt(0, studentIds.length - 1)];
      const achievement = getRandomElement(achievementTypes);
      const achievementDate = new Date(today);
      achievementDate.setDate(achievementDate.getDate() - getRandomInt(0, 365));
      
      await connection.query(
        'INSERT IGNORE INTO achievements (user_id, title, description, badge_icon, category, date_achieved, verified) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [
          student.id,
          achievement.title,
          `Awarded for outstanding performance in ${achievement.category.toLowerCase()} activities.`,
          achievement.badge,
          achievement.category,
          achievementDate.toISOString().split('T')[0],
          Math.random() > 0.3
        ]
      );
    }
    console.log('✓ Created achievements\n');

    // =============================================================================
    // SEED FEES
    // =============================================================================
    console.log('💰 Creating fee records...');
    for (const student of studentIds) {
      for (let sem = 1; sem <= student.year * 2; sem++) {
        const amount = 75000;
        const isPaid = Math.random() > 0.1;
        const paidAmount = isPaid ? amount : (Math.random() > 0.5 ? amount * 0.5 : 0);
        
        const dueDate = new Date(today);
        dueDate.setMonth(dueDate.getMonth() - (student.year * 2 - sem) * 6);
        dueDate.setDate(15);
        
        let status;
        if (paidAmount === amount) status = 'paid';
        else if (paidAmount > 0) status = 'partial';
        else if (new Date() > dueDate) status = 'overdue';
        else status = 'pending';
        
        await connection.query(
          'INSERT IGNORE INTO fees (student_id, semester, amount, paid_amount, due_date, payment_status, transaction_id, payment_date, receipt_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [
            student.id,
            sem,
            amount,
            paidAmount,
            dueDate.toISOString().split('T')[0],
            status,
            paidAmount > 0 ? `TXN${Date.now()}${student.id}${sem}` : null,
            paidAmount > 0 ? new Date(dueDate.getTime() - getRandomInt(1, 10) * 24 * 60 * 60 * 1000) : null,
            paidAmount > 0 ? `/uploads/receipts/receipt_${student.regNumber}_sem${sem}.pdf` : null
          ]
        );
      }
    }
    console.log('✓ Created fee records\n');

    // =============================================================================
    // SEED SYSTEM SETTINGS
    // =============================================================================
    console.log('⚙️ Creating system settings...');
    const settings = [
      ['academic_year', '2024-2025', 'Current academic year'],
      ['current_semester', 'Odd', 'Current semester (Odd/Even)'],
      ['admission_open', 'true', 'Are admissions currently open'],
      ['exam_mode', 'offline', 'Current examination mode'],
      ['attendance_threshold', '75', 'Minimum attendance percentage required']
    ];

    for (const setting of settings) {
      await connection.query(
        `INSERT INTO system_settings (setting_key, setting_value, description, updated_by) VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           setting_value = VALUES(setting_value),
           description = VALUES(description),
           updated_by = VALUES(updated_by),
           updated_at = NOW()`,
        [...setting, 1]
      );
    }
    console.log('✓ Created system settings\n');

    // =============================================================================
    // FINAL SUMMARY
    // =============================================================================
    console.log('═══════════════════════════════════════════════════════');
    console.log('✨ COMPREHENSIVE DATABASE SEEDING COMPLETED! ✨\n');
    console.log('📊 Summary of Records Created:');
    console.log('─────────────────────────────────────────────────────');
    console.log(`  👤 Admins: 3`);
    console.log(`  👨‍🏫 Teachers: 50`);
    console.log(`  👨‍🎓 Students: 500`);
    console.log(`  📊 Attendance Records: ~${attendanceCount.toLocaleString()}`);
    console.log(`  📈 Marks Records: ~${marksCount.toLocaleString()}`);
    console.log(`  📚 Files (Notes, PYQs, Admit Cards): ${filesCount}`);
    console.log(`  🎉 Events: 30`);
    console.log(`  🎯 Clubs: ${clubNames.length}`);
    console.log(`  📅 Timetable Entries: ~${departments.length * 4 * 4 * 6 * 5}`);
    console.log(`  🍽️ Hostel Menu Items: ~360`);
    console.log(`  📝 Assignments: ${assignmentsCount}`);
    console.log(`  📢 Announcements: ${announcementTemplates.length}`);
    console.log(`  🏆 Achievements: 100`);
    console.log(`  💰 Fee Records: ${studentIds.length * 4} (avg)`);
    console.log('─────────────────────────────────────────────────────\n');
    console.log('🔑 Demo Credentials:');
    console.log('─────────────────────────────────────────────────────');
    console.log('Admin:');
    console.log('  📧 Registration: ADM2025001');
    console.log('  🔒 Password: Admin@123456\n');
    console.log('Teacher:');
    console.log('  📧 Registration: TCH2025001');
    console.log('  🔒 Password: Teacher@123\n');
    console.log('Student:');
    console.log('  📧 Registration: STU20250001');
    console.log('  🔒 Password: Student@123\n');
    console.log('═══════════════════════════════════════════════════════\n');
    console.log('✅ All users now have complete, realistic data across all pages!');
    console.log('🚀 System is ready for demo and testing!\n');

  } catch (error) {
    console.error('❌ Seeding failed:', error);
    console.error('Stack:', error.stack);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('Database connection closed.');
    }
  }
}

// Run the comprehensive seeder
comprehensiveSeed();
