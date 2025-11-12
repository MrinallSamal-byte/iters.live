require('dotenv').config();
const mysql = require('mysql2/promise');
const { exec } = require('child_process');
const chalk = require('chalk');
const util = require('util');

const execPromise = util.promisify(exec);

// Railway database configuration
const railwayConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'iter_college_db',
  multipleStatements: true,
  connectTimeout: 20000
};

async function seedRailwayDatabase() {
  let connection;
  
  try {
    console.log(chalk.blue('\n🌱 Seeding Railway MySQL Database\n'));
    console.log(chalk.cyan('Configuration:'));
    console.log(`  Host: ${railwayConfig.host}`);
    console.log(`  Port: ${railwayConfig.port}`);
    console.log(`  Database: ${railwayConfig.database}`);
    console.log('');

    // Connect to Railway
    console.log(chalk.yellow('Connecting to Railway MySQL...'));
    connection = await mysql.createConnection(railwayConfig);
    console.log(chalk.green('✓ Connected successfully\n'));

    // Check if database is already seeded
    console.log(chalk.yellow('Checking existing data...'));
    const [existingUsers] = await connection.query('SELECT COUNT(*) as count FROM users');
    
    if (existingUsers[0].count > 0) {
      console.log(chalk.yellow(`\n⚠ Database already contains ${existingUsers[0].count} users.`));
      console.log(chalk.yellow('Do you want to proceed? This will add more data or you can use seed.js to reset.\n'));
    }

    // Run the seed script
    console.log(chalk.yellow('Running seed script...'));
    console.log(chalk.cyan('This may take a few minutes...\n'));

    try {
      const { stdout, stderr } = await execPromise('node server/seed/seed.js', {
        env: { ...process.env },
        maxBuffer: 10 * 1024 * 1024 // 10MB buffer
      });

      if (stdout) {
        console.log(stdout);
      }
      if (stderr) {
        console.error(chalk.red(stderr));
      }

      console.log(chalk.green('\n✓ Seed script completed successfully\n'));

    } catch (execError) {
      console.error(chalk.red('Error running seed script:'));
      console.error(execError.message);
      throw execError;
    }

    // Verify seeding
    console.log(chalk.yellow('Verifying seeded data...'));
    
    const [finalUsers] = await connection.query(`
      SELECT role, COUNT(*) as count
      FROM users
      GROUP BY role
    `);

    console.log(chalk.green('\n✓ Final user counts:'));
    finalUsers.forEach(stat => {
      console.log(`  - ${stat.role}: ${stat.count}`);
    });

    const [tables] = await connection.query(`
      SELECT 
        'attendance' as table_name, COUNT(*) as count FROM attendance
      UNION ALL
      SELECT 'marks', COUNT(*) FROM marks
      UNION ALL
      SELECT 'assignments', COUNT(*) FROM assignments
      UNION ALL
      SELECT 'events', COUNT(*) FROM events
      UNION ALL
      SELECT 'timetables', COUNT(*) FROM timetables
      UNION ALL
      SELECT 'admit_cards', COUNT(*) FROM admit_cards
    `);

    console.log(chalk.green('\n✓ Data in tables:'));
    tables.forEach(table => {
      console.log(`  - ${table.table_name}: ${table.count}`);
    });

    console.log(chalk.green.bold('\n═══════════════════════════════════════════'));
    console.log(chalk.green.bold('✓ Railway Database seeded successfully!'));
    console.log(chalk.green.bold('═══════════════════════════════════════════\n'));

    console.log(chalk.cyan('Demo Accounts:'));
    console.log(chalk.yellow('Admin:   admin1@iter.edu / Admin@123456'));
    console.log(chalk.yellow('Teacher: teacher1@iter.edu / Teacher@123'));
    console.log(chalk.yellow('Student: (run check-railway-db.js to see list) / Student@123'));
    console.log('');

    return true;

  } catch (error) {
    console.error(chalk.red('\n✗ Error seeding Railway database:'));
    console.error(chalk.red(error.message));
    console.error('');
    return false;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Run the seed
seedRailwayDatabase()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error(chalk.red('Unexpected error:'), error);
    process.exit(1);
  });
