require('dotenv').config();
const mysql = require('mysql2/promise');

const dbConfig = {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  multipleStatements: true,
  connectTimeout: 30000
};

const departments = ['CSE', 'IT', 'ECE', 'EEE', 'MECH', 'CIVIL'];
const subjects = {
  CSE: ['Data Structures', 'Algorithms', 'Database Management', 'Operating Systems', 'Computer Networks'],
  IT: ['Web Development', 'Mobile Computing', 'Cloud Computing', 'Cyber Security', 'AI & ML'],
  ECE: ['Digital Electronics', 'Signals & Systems', 'VLSI Design', 'Embedded Systems'],
  EEE: ['Power Systems', 'Control Systems', 'Electrical Machines', 'Power Electronics'],
  MECH: ['Thermodynamics', 'Fluid Mechanics', 'Manufacturing Processes', 'CAD/CAM'],
  CIVIL: ['Structural Analysis', 'Concrete Technology', 'Surveying', 'Geotechnical Engineering']
};

const getRandomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

async function completeSeeding() {
  let connection;
  
  try {
    console.log('\n📝 Completing Railway Database Seeding...\n');
    
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Connected\n');

    // Get teacher IDs
    const [teachers] = await connection.query("SELECT id, department FROM users WHERE role='teacher'");
    const teacherIds = teachers.map(t => ({ id: t.id, dept: t.department }));

    // Check if assignments already exist
    const [existingAssignments] = await connection.query('SELECT COUNT(*) as count FROM assignments');
    
    if (existingAssignments[0].count === 0) {
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
      console.log('   ✅ Created assignments\n');
    } else {
      console.log(`   ⏭️  Assignments already exist (${existingAssignments[0].count})\n`);
    }

    // Check if events already exist
    const [existingEvents] = await connection.query('SELECT COUNT(*) as count FROM events');
    
    if (existingEvents[0].count === 0) {
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
    } else {
      console.log(`   ⏭️  Events already exist (${existingEvents[0].count})\n`);
    }

    // Final statistics
    const [stats] = await connection.query(`
      SELECT 
        (SELECT COUNT(*) FROM users WHERE role='admin') as admins,
        (SELECT COUNT(*) FROM users WHERE role='teacher') as teachers,
        (SELECT COUNT(*) FROM users WHERE role='student') as students,
        (SELECT COUNT(*) FROM attendance) as attendance,
        (SELECT COUNT(*) FROM marks) as marks,
        (SELECT COUNT(*) FROM assignments) as assignments,
        (SELECT COUNT(*) FROM events) as events
    `);

    console.log('╔══════════════════════════════════════════════╗');
    console.log('║  ✅ Railway Database Complete!              ║');
    console.log('╚══════════════════════════════════════════════╝\n');
    
    console.log('📊 Final Statistics:');
    console.log(`   Admins: ${stats[0].admins}`);
    console.log(`   Teachers: ${stats[0].teachers}`);
    console.log(`   Students: ${stats[0].students}`);
    console.log(`   Attendance: ${stats[0].attendance}`);
    console.log(`   Marks: ${stats[0].marks}`);
    console.log(`   Assignments: ${stats[0].assignments}`);
    console.log(`   Events: ${stats[0].events}\n`);

    console.log('🎓 Demo Accounts:');
    console.log('   Admin:   admin1@iter.edu / Admin@123456');
    console.log('   Teacher: teacher1@iter.edu / Teacher@123');
    console.log('   Student: student1@iter.edu / Student@123\n');

    await connection.end();

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (connection) await connection.end();
    process.exit(1);
  }
}

completeSeeding();
