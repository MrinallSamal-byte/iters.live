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

// Sample data generators
const departments = ['CSE', 'IT', 'ECE', 'EEE', 'MECH', 'CIVIL'];
const sections = ['A', 'B', 'C'];
const subjects = {
  CSE: ['Data Structures', 'Algorithms', 'Database Management', 'Operating Systems', 'Computer Networks', 'Software Engineering'],
  IT: ['Web Development', 'Mobile Computing', 'Cloud Computing', 'Cyber Security', 'AI & ML', 'IoT'],
  ECE: ['Digital Electronics', 'Signals & Systems', 'VLSI Design', 'Embedded Systems', 'Communication Systems', 'Microprocessors'],
  EEE: ['Power Systems', 'Control Systems', 'Electrical Machines', 'Power Electronics', 'Renewable Energy', 'Electric Drives'],
  MECH: ['Thermodynamics', 'Fluid Mechanics', 'Manufacturing Processes', 'CAD/CAM', 'Machine Design', 'Heat Transfer'],
  CIVIL: ['Structural Analysis', 'Concrete Technology', 'Surveying', 'Geotechnical Engineering', 'Transportation Engineering', 'Hydraulics']
};

const firstNames = ['Aarav', 'Vivaan', 'Aditya', 'Arjun', 'Sai', 'Diya', 'Ananya', 'Isha', 'Priya', 'Sneha', 'Rohan', 'Karan', 'Akash', 'Rahul', 'Amit', 'Neha', 'Pooja', 'Riya', 'Shreya', 'Tanvi'];
const lastNames = ['Sharma', 'Verma', 'Patel', 'Kumar', 'Singh', 'Reddy', 'Gupta', 'Joshi', 'Mehta', 'Nair', 'Rao', 'Desai', 'Kulkarni', 'Mishra', 'Pandey'];

const getRandomElement = (arr) => arr[Math.floor(Math.random() * arr.length)];
const getRandomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

// Create sample PDF content
const createSamplePDF = async (filename, title, content) => {
  const pdfContent = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /Resources 4 0 R /MediaBox [0 0 612 792] /Contents 5 0 R >>
endobj
4 0 obj
<< /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >>
endobj
5 0 obj
<< /Length 100 >>
stream
BT
/F1 24 Tf
50 700 Td
(${title}) Tj
0 -30 Td
/F1 12 Tf
(${content}) Tj
ET
endstream
endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000214 00000 n 
0000000304 00000 n 
trailer
<< /Size 6 /Root 1 0 R >>
startxref
453
%%EOF`;
  
  return Buffer.from(pdfContent);
};

async function seed() {
  let connection;
  
  try {
    console.log('🌱 Starting database seeding...\n');

    // Connect to MySQL
    connection = await mysql.createConnection(dbConfig);
    console.log('✓ Connected to MySQL');

    // Create database if not exists
    await connection.query(`CREATE DATABASE IF NOT EXISTS ${dbName}`);
    await connection.query(`USE ${dbName}`);
    console.log(`✓ Database ${dbName} ready`);

    // Read and execute schema
    const schemaPath = path.join(__dirname, '../database/init.sql');
    const schema = await fs.readFile(schemaPath, 'utf8');
    await connection.query(schema);
    console.log('✓ Database schema initialized\n');

    // Create uploads directory
    const uploadsDir = path.join(__dirname, '../uploads');
    const seedUploadsDir = path.join(__dirname, 'uploads');
    await fs.mkdir(uploadsDir, { recursive: true });
    await fs.mkdir(seedUploadsDir, { recursive: true });
    console.log('✓ Upload directories created\n');

    // Seed Admin Accounts
    console.log('Creating admin accounts...');
    const adminPassword = await bcrypt.hash('Admin@123456', 12);
    const adminData = [
      ['Admin One', 'ADM2025001', 'admin1@iter.edu', adminPassword, '9876543210', 'Administration', 'admin'],
      ['Admin Two', 'ADM2025002', 'admin2@iter.edu', adminPassword, '9876543211', 'Administration', 'admin'],
      ['Admin Three', 'ADM2025003', 'admin3@iter.edu', adminPassword, '9876543212', 'Administration', 'admin']
    ];

    for (const admin of adminData) {
      await connection.query(
        'INSERT INTO users (name, registration_number, email, password, phone_number, department, role) VALUES (?, ?, ?, ?, ?, ?, ?)',
        admin
      );
    }
    console.log('✓ Created 3 admin accounts\n');

    // Seed Teachers
    console.log('Creating teacher accounts...');
    const teacherPassword = await bcrypt.hash('Teacher@123', 12);
    const teacherIds = [];

    for (let i = 0; i < 20; i++) {
      const dept = getRandomElement(departments);
      const name = `${getRandomElement(['Dr.', 'Prof.'])} ${getRandomElement(firstNames)} ${getRandomElement(lastNames)}`;
      const regNumber = `TCH2025${String(i + 1).padStart(3, '0')}`;
      const email = `teacher${i + 1}@iter.edu`;
      const phone = `98765${String(43220 + i).padStart(5, '0')}`;
      const subjectsTaught = subjects[dept].slice(0, getRandomInt(2, 4)).join(', ');

      const [result] = await connection.query(
        'INSERT INTO users (name, registration_number, email, password, phone_number, department, subjects_taught, role) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [name, regNumber, email, teacherPassword, phone, dept, subjectsTaught, 'teacher']
      );
      teacherIds.push({ id: result.insertId, dept, subjects: subjectsTaught.split(', ') });
    }
    console.log('✓ Created 20 teacher accounts\n');

    // Seed Students
    console.log('Creating student accounts...');
    const studentPassword = await bcrypt.hash('Student@123', 12);
    const studentIds = [];

    for (let i = 0; i < 200; i++) {
      const dept = getRandomElement(departments);
      const year = getRandomInt(1, 4);
      const section = getRandomElement(sections);
      const name = `${getRandomElement(firstNames)} ${getRandomElement(lastNames)}`;
      const regNumber = `STU2025${String(i + 1).padStart(4, '0')}`;
      const email = `student${i + 1}@iter.edu`;
      const phone = `98000${String(10000 + i).padStart(5, '0')}`;

      const [result] = await connection.query(
        'INSERT INTO users (name, registration_number, email, password, phone_number, department, year, section, role) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [name, regNumber, email, studentPassword, phone, dept, year, section, 'student']
      );
      studentIds.push({ id: result.insertId, dept, year, section, name, regNumber });
    }
    console.log('✓ Created 200 student accounts\n');

    // Seed Attendance
    console.log('Creating attendance records...');
    const today = new Date();
    for (const student of studentIds) {
      const studentSubjects = subjects[student.dept];
      
      for (const subject of studentSubjects) {
        for (let day = 0; day < 30; day++) {
          const date = new Date(today);
          date.setDate(date.getDate() - day);
          const dateStr = date.toISOString().split('T')[0];
          
          const status = Math.random() > 0.2 ? 'present' : (Math.random() > 0.5 ? 'absent' : 'late');
          const teacher = teacherIds.find(t => t.dept === student.dept);
          
          if (teacher) {
            await connection.query(
              'INSERT INTO attendance (student_id, subject, date, status, marked_by) VALUES (?, ?, ?, ?, ?)',
              [student.id, subject, dateStr, status, teacher.id]
            );
          }
        }
      }
    }
    console.log('✓ Created attendance records\n');

    // Seed Marks
    console.log('Creating marks records...');
    for (const student of studentIds) {
      const studentSubjects = subjects[student.dept];
      
      for (const subject of studentSubjects) {
        const examTypes = ['internal', 'external', 'assignment', 'quiz'];
        for (const examType of examTypes) {
          const totalMarks = examType === 'quiz' ? 10 : (examType === 'assignment' ? 20 : (examType === 'internal' ? 30 : 100));
          const marksObtained = getRandomInt(totalMarks * 0.5, totalMarks);
          const examDate = new Date(today);
          examDate.setDate(examDate.getDate() - getRandomInt(10, 60));
          const teacher = teacherIds.find(t => t.dept === student.dept);
          
          if (teacher) {
            await connection.query(
              'INSERT INTO marks (student_id, subject, exam_type, marks_obtained, total_marks, exam_date, uploaded_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
              [student.id, subject, examType, marksObtained, totalMarks, examDate.toISOString().split('T')[0], teacher.id]
            );
          }
        }
      }
    }
    console.log('✓ Created marks records\n');

    // Create sample files
    console.log('Creating sample files...');
    const sampleFiles = [];
    
    // Notes for each department
    for (const dept of departments) {
      for (const subject of subjects[dept]) {
        const filename = `${dept}_${subject.replace(/\s+/g, '_')}_Notes.pdf`;
        const filepath = path.join(uploadsDir, filename);
        const seedFilepath = path.join(seedUploadsDir, filename);
        
        const pdfBuffer = await createSamplePDF(
          filename,
          `${subject} - Notes`,
          `Comprehensive notes for ${subject} in ${dept} department. Created for ITER students.`
        );
        
        await fs.writeFile(filepath, pdfBuffer);
        await fs.writeFile(seedFilepath, pdfBuffer);
        
        const checksum = crypto.createHash('sha256').update(pdfBuffer).digest('hex');
        const teacher = teacherIds.find(t => t.dept === dept && t.subjects.includes(subject));
        
        if (teacher) {
          const [result] = await connection.query(
            `INSERT INTO files (original_name, stored_name, mime_type, file_size, checksum, file_path, public_url, category, subject, uploaded_by, approved, approved_by, approved_at) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
            [filename, filename, 'application/pdf', pdfBuffer.length, checksum, filepath, `/static/uploads/${filename}`, 'note', subject, teacher.id, true, 1]
          );
          sampleFiles.push(result.insertId);
        }
      }
    }

    // PYQs
    for (const dept of departments) {
      for (let i = 0; i < 3; i++) {
        const subject = getRandomElement(subjects[dept]);
        const year = 2020 + i;
        const filename = `${dept}_${subject.replace(/\s+/g, '_')}_PYQ_${year}.pdf`;
        const filepath = path.join(uploadsDir, filename);
        const seedFilepath = path.join(seedUploadsDir, filename);
        
        const pdfBuffer = await createSamplePDF(
          filename,
          `${subject} - Previous Year Question Paper ${year}`,
          `End-semester examination question paper for ${subject}.`
        );
        
        await fs.writeFile(filepath, pdfBuffer);
        await fs.writeFile(seedFilepath, pdfBuffer);
        
        const checksum = crypto.createHash('sha256').update(pdfBuffer).digest('hex');
        const teacher = teacherIds.find(t => t.dept === dept);
        
        if (teacher) {
          await connection.query(
            `INSERT INTO files (original_name, stored_name, mime_type, file_size, checksum, file_path, public_url, category, subject, uploaded_by, approved, approved_by, approved_at) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
            [filename, filename, 'application/pdf', pdfBuffer.length, checksum, filepath, `/static/uploads/${filename}`, 'pyq', subject, teacher.id, true, 1]
          );
        }
      }
    }

    // Admit cards for students
    for (let i = 0; i < 10; i++) {
      const student = studentIds[i];
      const filename = `AdmitCard_${student.regNumber}.pdf`;
      const filepath = path.join(uploadsDir, filename);
      const seedFilepath = path.join(seedUploadsDir, filename);
      
      const pdfBuffer = await createSamplePDF(
        filename,
        'ADMIT CARD - End Semester Examination',
        `Student: ${student.name}\nReg No: ${student.regNumber}\nDepartment: ${student.dept}`
      );
      
      await fs.writeFile(filepath, pdfBuffer);
      await fs.writeFile(seedFilepath, pdfBuffer);
      
      const checksum = crypto.createHash('sha256').update(pdfBuffer).digest('hex');
      const verificationCode = crypto.randomBytes(8).toString('hex').toUpperCase();
      
      const [fileResult] = await connection.query(
        `INSERT INTO files (original_name, stored_name, mime_type, file_size, checksum, file_path, public_url, category, uploaded_by, approved) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [filename, filename, 'application/pdf', pdfBuffer.length, checksum, filepath, `/static/uploads/${filename}`, 'admit_card', 1, true]
      );
      
      await connection.query(
        'INSERT INTO admit_cards (student_id, exam_name, exam_date, file_id, verification_code) VALUES (?, ?, ?, ?, ?)',
        [student.id, 'End Semester Examination 2025', '2025-05-15', fileResult.insertId, verificationCode]
      );
    }

    console.log('✓ Created sample files (notes, PYQs, admit cards)\n');

    // Seed Events
    console.log('Creating events...');
    const eventCategories = ['Technical', 'Cultural', 'Sports', 'Workshop', 'Seminar'];
    for (let i = 0; i < 10; i++) {
      const futureDate = new Date(today);
      futureDate.setDate(futureDate.getDate() + getRandomInt(5, 60));
      
      await connection.query(
        `INSERT INTO events (title, description, event_date, event_time, location, category, max_participants, registration_deadline, created_by) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          `${getRandomElement(eventCategories)} Event ${i + 1}`,
          `An exciting ${getRandomElement(eventCategories).toLowerCase()} event for all students.`,
          futureDate.toISOString().split('T')[0],
          '10:00:00',
          `Hall ${i + 1}`,
          getRandomElement(eventCategories),
          getRandomInt(50, 200),
          new Date(futureDate.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          teacherIds[i % teacherIds.length].id
        ]
      );
    }
    console.log('✓ Created 10 events\n');

    // Seed Timetable
    console.log('Creating timetable...');
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const timeSlots = ['09:00-10:00', '10:00-11:00', '11:15-12:15', '12:15-13:15', '14:00-15:00', '15:00-16:00'];
    
    for (const dept of departments) {
      for (const year of [1, 2, 3, 4]) {
        for (const section of sections) {
          const deptSubjects = subjects[dept];
          let subjectIndex = 0;
          
          for (const day of days) {
            for (const timeSlot of timeSlots) {
              const subject = deptSubjects[subjectIndex % deptSubjects.length];
              const teacher = teacherIds.find(t => t.dept === dept && t.subjects.includes(subject));
              
              if (teacher) {
                await connection.query(
                  'INSERT INTO timetable (department, year, section, day_of_week, time_slot, subject, teacher_id, room_number) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                  [dept, year, section, day, timeSlot, subject, teacher.id, `Room ${getRandomInt(101, 350)}`]
                );
              }
              
              subjectIndex++;
            }
          }
        }
      }
    }
    console.log('✓ Created timetable\n');

    // Seed Hostel Menu
    console.log('Creating hostel menu...');
    const mealTypes = ['breakfast', 'lunch', 'snacks', 'dinner'];
    const breakfastItems = ['Idli Sambar', 'Poha', 'Upma', 'Paratha with Curd', 'Bread Toast & Jam'];
    const lunchItems = ['Rice, Dal, Sabji, Roti', 'Biryani with Raita', 'Chole Bhature', 'Rajma Chawal', 'Paneer Curry with Rice'];
    const snacksItems = ['Samosa', 'Pakora', 'Sandwich', 'Biscuits & Tea', 'Fruit'];
    const dinnerItems = ['Roti, Dal, Rice', 'Noodles', 'Fried Rice', 'Pulao with Raita', 'Mixed Vegetables'];
    
    for (let day = -7; day < 14; day++) {
      const menuDate = new Date(today);
      menuDate.setDate(menuDate.getDate() + day);
      const dateStr = menuDate.toISOString().split('T')[0];
      
      await connection.query(
        'INSERT INTO hostel_menu (date, meal_type, menu_items) VALUES (?, ?, ?), (?, ?, ?), (?, ?, ?), (?, ?, ?)',
        [
          dateStr, 'breakfast', getRandomElement(breakfastItems),
          dateStr, 'lunch', getRandomElement(lunchItems),
          dateStr, 'snacks', getRandomElement(snacksItems),
          dateStr, 'dinner', getRandomElement(dinnerItems)
        ]
      );
    }
    console.log('✓ Created hostel menu\n');

    // Seed Assignments
    console.log('Creating assignments...');
    for (const dept of departments) {
      const deptTeachers = teacherIds.filter(t => t.dept === dept);
      const deptSubjects = subjects[dept];
      
      for (let i = 0; i < 5; i++) {
        const teacher = getRandomElement(deptTeachers);
        const subject = getRandomElement(deptSubjects);
        const deadline = new Date(today);
        deadline.setDate(deadline.getDate() + getRandomInt(7, 30));
        
        await connection.query(
          'INSERT INTO assignments (title, description, subject, department, year, total_marks, deadline, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [
            `${subject} Assignment ${i + 1}`,
            `Complete assignment on ${subject}. Submit before deadline.`,
            subject,
            dept,
            getRandomInt(1, 4),
            20,
            deadline.toISOString().split('T')[0],
            teacher.id
          ]
        );
      }
    }
    console.log('✓ Created assignments\n');

    // Seed Announcements
    console.log('Creating announcements...');
    const announcementTitles = [
      'Mid-semester exams schedule released',
      'Library timing extended',
      'New courses available for next semester',
      'Sports day registration open',
      'Technical fest coming soon'
    ];
    
    for (let i = 0; i < 5; i++) {
      await connection.query(
        `INSERT INTO announcements (title, content, category, target_audience, posted_by) VALUES (?, ?, ?, ?, ?)`,
        [
          announcementTitles[i],
          `This is an important announcement regarding ${announcementTitles[i].toLowerCase()}.`,
          getRandomElement(['general', 'academic', 'event', 'exam']),
          'all',
          getRandomElement(teacherIds).id
        ]
      );
    }
    console.log('✓ Created announcements\n');

    console.log('═══════════════════════════════════════════════════════');
    console.log('🎉 Database seeding completed successfully!\n');
    console.log('Demo Credentials:');
    console.log('─────────────────────────────────────────────────────');
    console.log('Admin:');
    console.log('  Registration Number: ADM2025001');
    console.log('  Password: Admin@123456\n');
    console.log('Teacher:');
    console.log('  Registration Number: TCH2025001');
    console.log('  Password: Teacher@123\n');
    console.log('Student:');
    console.log('  Registration Number: STU20250001');
    console.log('  Password: Student@123\n');
    console.log('Total Records Created:');
    console.log(`  • Admins: 3`);
    console.log(`  • Teachers: 20`);
    console.log(`  • Students: 200`);
    console.log(`  • Attendance Records: ~36,000`);
    console.log(`  • Marks Records: ~19,200`);
    console.log(`  • Files: ~${departments.length * 6 + departments.length * 3 + 10}`);
    console.log(`  • Events: 10`);
    console.log(`  • Timetable Entries: ~${departments.length * 4 * 3 * 6 * 6}`);
    console.log(`  • Assignments: ${departments.length * 5}`);
    console.log('═══════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('Database connection closed.');
    }
  }
}

// Run the seeder
seed();
