require('dotenv').config();
const mysql = require('mysql2/promise');
const chalk = require('chalk');

// Railway database configuration
const railwayConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'iter_college_db',
  connectTimeout: 10000
};

async function checkRailwayConnection() {
  let connection;
  
  try {
    console.log(chalk.blue('\n🔍 Railway MySQL Database Health Check\n'));
    console.log(chalk.cyan('Database Configuration:'));
    console.log(`  Host: ${railwayConfig.host}`);
    console.log(`  Port: ${railwayConfig.port}`);
    console.log(`  User: ${railwayConfig.user}`);
    console.log(`  Database: ${railwayConfig.database}`);
    console.log('');

    // Test connection
    console.log(chalk.yellow('Testing connection...'));
    connection = await mysql.createConnection(railwayConfig);
    console.log(chalk.green('✓ Successfully connected to Railway MySQL\n'));

    // Check tables
    console.log(chalk.yellow('Checking database tables...'));
    const [tables] = await connection.query('SHOW TABLES');
    
    if (tables.length === 0) {
      console.log(chalk.red('✗ No tables found! Database needs to be initialized.'));
      return false;
    }
    
    console.log(chalk.green(`✓ Found ${tables.length} tables:`));
    tables.forEach(table => {
      const tableName = Object.values(table)[0];
      console.log(`  - ${tableName}`);
    });
    console.log('');

    // Check users (admins, teachers, students)
    console.log(chalk.yellow('Checking user accounts...'));
    const [userStats] = await connection.query(`
      SELECT 
        role,
        COUNT(*) as count
      FROM users
      GROUP BY role
    `);

    if (userStats.length === 0) {
      console.log(chalk.red('✗ No users found! Database needs dummy data.'));
      return false;
    }

    console.log(chalk.green('✓ User accounts:'));
    userStats.forEach(stat => {
      console.log(`  - ${stat.role}: ${stat.count}`);
    });
    console.log('');

    // Check demo accounts
    console.log(chalk.yellow('Checking demo accounts...'));
    
    const [admins] = await connection.query(`
      SELECT registration_number, email, name 
      FROM users 
      WHERE role = 'admin' 
      LIMIT 3
    `);
    
    console.log(chalk.green(`✓ Admin accounts (${admins.length}):`));
    admins.forEach(admin => {
      console.log(`  - ${admin.email} (${admin.registration_number}) - ${admin.name}`);
    });
    console.log(chalk.cyan('    Password: Admin@123456'));
    console.log('');

    const [teachers] = await connection.query(`
      SELECT registration_number, email, name, department 
      FROM users 
      WHERE role = 'teacher' 
      LIMIT 5
    `);
    
    console.log(chalk.green(`✓ Teacher accounts (${teachers.length} shown):`));
    teachers.forEach(teacher => {
      console.log(`  - ${teacher.email} (${teacher.registration_number}) - ${teacher.name} [${teacher.department}]`);
    });
    console.log(chalk.cyan('    Password: Teacher@123'));
    console.log('');

    const [students] = await connection.query(`
      SELECT registration_number, email, name, department, year 
      FROM users 
      WHERE role = 'student' 
      LIMIT 5
    `);
    
    console.log(chalk.green(`✓ Student accounts (${students.length} shown):`));
    students.forEach(student => {
      console.log(`  - ${student.email} (${student.registration_number}) - ${student.name} [${student.department}${student.year ? `, Year ${student.year}` : ''}]`);
    });
    console.log(chalk.cyan('    Password: Student@123'));
    console.log('');

    // Check data in key tables
    console.log(chalk.yellow('Checking data in key tables...'));
    
    const tablesToCheck = [
      'attendance',
      'marks',
      'assignments',
      'events',
      'timetable',
      'admit_cards',
      'notifications'
    ];

    for (const table of tablesToCheck) {
      try {
        const [result] = await connection.query(`SELECT COUNT(*) as count FROM ${table}`);
        const count = result[0].count;
        if (count > 0) {
          console.log(chalk.green(`  ✓ ${table}: ${count} records`));
        } else {
          console.log(chalk.yellow(`  ⚠ ${table}: No records`));
        }
      } catch (error) {
        console.log(chalk.red(`  ✗ ${table}: Error - ${error.message}`));
      }
    }
    console.log('');

    // Check analytics data
    console.log(chalk.yellow('Checking analytics capabilities...'));
    
    const [attendanceData] = await connection.query(`
      SELECT COUNT(DISTINCT student_id) as students_with_attendance
      FROM attendance
    `);
    console.log(chalk.green(`  ✓ Students with attendance: ${attendanceData[0].students_with_attendance}`));
    
    const [marksData] = await connection.query(`
      SELECT COUNT(DISTINCT student_id) as students_with_marks
      FROM marks
    `);
    console.log(chalk.green(`  ✓ Students with marks: ${marksData[0].students_with_marks}`));
    
    const [assignmentData] = await connection.query(`
      SELECT COUNT(*) as total_assignments
      FROM assignments
    `);
    console.log(chalk.green(`  ✓ Total assignments: ${assignmentData[0].total_assignments}`));
    
    console.log('');

    // Final summary
    console.log(chalk.green.bold('═══════════════════════════════════════════'));
    console.log(chalk.green.bold('✓ Railway Database is properly configured!'));
    console.log(chalk.green.bold('═══════════════════════════════════════════\n'));

    console.log(chalk.cyan('Next Steps:'));
    console.log('1. Ensure these environment variables are set in Vercel:');
    console.log(chalk.white('   DB_HOST=' + railwayConfig.host));
    console.log(chalk.white('   DB_PORT=' + railwayConfig.port));
    console.log(chalk.white('   DB_USER=' + railwayConfig.user));
    console.log(chalk.white('   DB_PASSWORD=<your_railway_password>'));
    console.log(chalk.white('   DB_NAME=' + railwayConfig.database));
    console.log('');
    console.log('2. Test the Vercel deployment:');
    console.log(chalk.white('   https://iter-college-management.vercel.app/index.html'));
    console.log('');
    console.log('3. Login with demo accounts:');
    console.log(chalk.yellow('   Admin:   admin1@iter.edu / Admin@123456'));
    console.log(chalk.yellow('   Teacher: teacher1@iter.edu / Teacher@123'));
    console.log(chalk.yellow('   Student: (check above for examples) / Student@123'));
    console.log('');

    return true;

  } catch (error) {
    console.error(chalk.red('\n✗ Error connecting to Railway MySQL:'));
    console.error(chalk.red(error.message));
    console.error('');
    console.error(chalk.yellow('Troubleshooting:'));
    console.error('1. Check your .env file has correct Railway credentials');
    console.error('2. Verify Railway database is running');
    console.error('3. Check network connectivity to Railway');
    console.error('4. Ensure your IP is whitelisted (if Railway has restrictions)');
    console.error('');
    return false;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Run the check
checkRailwayConnection()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error(chalk.red('Unexpected error:'), error);
    process.exit(1);
  });
