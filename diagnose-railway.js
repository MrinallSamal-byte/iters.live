require('dotenv').config();
const mysql = require('mysql2/promise');

async function checkAndFixDatabase() {
  let connection;
  
  try {
    console.log('\n🔍 Checking Railway Database Status...\n');
    
    const dbConfig = {
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      multipleStatements: true
    };

    console.log('Connecting to:', dbConfig.host);
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Connected\n');

    // Check tables
    const [tables] = await connection.query('SHOW TABLES');
    console.log(`Found ${tables.length} tables`);

    if (tables.length > 0) {
      console.log('\nTables:');
      tables.forEach(table => {
        console.log(`  - ${Object.values(table)[0]}`);
      });

      // Check users
      try {
        const [users] = await connection.query('SELECT COUNT(*) as count, role FROM users GROUP BY role');
        console.log('\nUsers:');
        users.forEach(row => {
          console.log(`  ${row.role}: ${row.count}`);
        });

        // Check sample admin
        const [admins] = await connection.query("SELECT email, registration_number FROM users WHERE role='admin' LIMIT 3");
        console.log('\nAdmin accounts:');
        admins.forEach(admin => {
          console.log(`  ${admin.email} (${admin.registration_number})`);
        });

        // Check data counts
        const [attendance] = await connection.query('SELECT COUNT(*) as count FROM attendance');
        const [marks] = await connection.query('SELECT COUNT(*) as count FROM marks');
        const [assignments] = await connection.query('SELECT COUNT(*) as count FROM assignments');

        console.log('\nData counts:');
        console.log(`  Attendance: ${attendance[0].count}`);
        console.log(`  Marks: ${marks[0].count}`);
        console.log(`  Assignments: ${assignments[0].count}`);

      } catch (err) {
        console.error('Error checking users:', err.message);
      }
    }

    await connection.end();

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (connection) await connection.end();
  }
}

checkAndFixDatabase();
