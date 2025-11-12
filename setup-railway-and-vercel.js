require('dotenv').config();
const readline = require('readline');
const mysql = require('mysql2/promise');
const { exec } = require('child_process');
const util = require('util');
const fs = require('fs').promises;

const execPromise = util.promisify(exec);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

console.log('\n╔══════════════════════════════════════════════════════════════════╗');
console.log('║   Railway MySQL Setup & Database Migration                      ║');
console.log('║   Connect your Vercel deployment to Railway database            ║');
console.log('╚══════════════════════════════════════════════════════════════════╝\n');

async function setupRailwayDatabase() {
  let connection;
  
  try {
    console.log('📋 Step 1: Get Railway MySQL Credentials\n');
    console.log('Find these in Railway Dashboard:');
    console.log('→ https://railway.app/dashboard');
    console.log('→ Click your MySQL service → Variables tab\n');

    const useExisting = await question('Do you have Railway MySQL credentials? (y/n): ');
    
    if (useExisting.toLowerCase() !== 'y') {
      console.log('\n📝 To create Railway MySQL:');
      console.log('1. Go to https://railway.app/new');
      console.log('2. Click "New Project" → "Provision MySQL"');
      console.log('3. Wait 1-2 minutes for deployment');
      console.log('4. Copy credentials from Variables tab');
      console.log('\nRun this script again after creating Railway MySQL.\n');
      rl.close();
      return;
    }

    console.log('\n📝 Enter Railway MySQL Credentials:\n');
    
    const host = await question('MYSQLHOST (e.g., roundhouse.proxy.rlwy.net): ');
    const port = await question('MYSQLPORT (default 3306): ') || '3306';
    const user = await question('MYSQLUSER (usually root): ') || 'root';
    const password = await question('MYSQLPASSWORD: ');
    const database = await question('MYSQLDATABASE (or press Enter for "railway"): ') || 'railway';

    const railwayConfig = {
      host: host.trim(),
      port: parseInt(port),
      user: user.trim(),
      password: password.trim(),
      database: database.trim(),
      multipleStatements: true,
      connectTimeout: 20000
    };

    console.log('\n🔍 Step 2: Testing Railway Connection...\n');
    
    try {
      connection = await mysql.createConnection(railwayConfig);
      console.log('✅ Successfully connected to Railway MySQL!\n');
    } catch (error) {
      console.error('❌ Connection failed:', error.message);
      console.error('\nPlease verify:');
      console.error('1. Credentials are correct');
      console.error('2. Railway MySQL service is running');
      console.error('3. Database name exists\n');
      rl.close();
      return;
    }

    // Check if database has tables
    console.log('🔍 Step 3: Checking Database Status...\n');
    const [tables] = await connection.query('SHOW TABLES');
    console.log(`Found ${tables.length} tables in database`);

    if (tables.length === 0) {
      console.log('\n⚠️  Database is empty - needs initialization\n');
    } else {
      const [users] = await connection.query('SELECT COUNT(*) as count FROM users WHERE 1=1').catch(() => [{ count: 0 }]);
      console.log(`Found ${users[0]?.count || 0} users in database`);
      
      if (users[0]?.count > 0) {
        console.log('\n✅ Database already has data!\n');
        const proceed = await question('Do you want to reseed (will clear existing data)? (y/n): ');
        if (proceed.toLowerCase() !== 'y') {
          console.log('\nSkipping database seeding...');
          await connection.end();
          rl.close();
          
          // Show Vercel configuration
          await showVercelConfiguration(railwayConfig);
          return;
        }
      }
    }

    await connection.end();

    // Create temporary .env file for seeding
    console.log('\n🌱 Step 4: Seeding Railway Database...\n');
    console.log('This will create:');
    console.log('  • 3 Admin accounts');
    console.log('  • 50 Teacher accounts');
    console.log('  • 100+ Student accounts');
    console.log('  • Comprehensive dummy data (attendance, marks, assignments, etc.)\n');

    const proceed = await question('Proceed with seeding? (y/n): ');
    
    if (proceed.toLowerCase() === 'y') {
      // Backup current .env
      await fs.copyFile('.env', '.env.backup').catch(() => {});

      // Create temporary .env with Railway credentials
      const tempEnvContent = `NODE_ENV=production
CLIENT_URL=https://iter-college-management-7sct95bwk-mrinallsamal-bytes-projects.vercel.app

DB_HOST=${railwayConfig.host}
DB_PORT=${railwayConfig.port}
DB_USER=${railwayConfig.user}
DB_PASSWORD=${railwayConfig.password}
DB_NAME=${railwayConfig.database}

JWT_SECRET=${require('crypto').randomBytes(32).toString('hex')}
JWT_REFRESH_SECRET=${require('crypto').randomBytes(32).toString('hex')}
JWT_EXPIRE=1h
JWT_REFRESH_EXPIRE=7d

UPLOAD_DIR=./uploads
MAX_FILE_SIZE=10485760
STORAGE_MODE=local

CORS_WHITELIST=https://iter-college-management-7sct95bwk-mrinallsamal-bytes-projects.vercel.app
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
`;

      await fs.writeFile('.env.temp', tempEnvContent);
      await fs.copyFile('.env.temp', '.env');

      console.log('Running seed script (this may take 5-10 minutes)...\n');

      try {
        const { stdout, stderr } = await execPromise('node server/seed/seed.js', {
          maxBuffer: 10 * 1024 * 1024,
          timeout: 600000 // 10 minutes
        });

        console.log(stdout);
        if (stderr) console.error(stderr);

        console.log('\n✅ Database seeded successfully!\n');

      } catch (error) {
        console.error('❌ Seeding failed:', error.message);
        if (error.stdout) console.log(error.stdout);
        if (error.stderr) console.error(error.stderr);
      } finally {
        // Restore original .env
        await fs.copyFile('.env.backup', '.env').catch(() => {});
        await fs.unlink('.env.backup').catch(() => {});
        await fs.unlink('.env.temp').catch(() => {});
      }

      // Verify seeding
      console.log('\n🔍 Step 5: Verifying Data...\n');
      connection = await mysql.createConnection(railwayConfig);
      
      const [finalUsers] = await connection.query(`
        SELECT role, COUNT(*) as count FROM users GROUP BY role
      `);
      
      console.log('✅ User counts:');
      finalUsers.forEach(row => {
        console.log(`   ${row.role}: ${row.count}`);
      });

      const [dataStats] = await connection.query(`
        SELECT 
          (SELECT COUNT(*) FROM attendance) as attendance_count,
          (SELECT COUNT(*) FROM marks) as marks_count,
          (SELECT COUNT(*) FROM assignments) as assignment_count
      `);

      console.log('\n✅ Data counts:');
      console.log(`   Attendance: ${dataStats[0].attendance_count}`);
      console.log(`   Marks: ${dataStats[0].marks_count}`);
      console.log(`   Assignments: ${dataStats[0].assignment_count}`);

      await connection.end();
    }

    // Show Vercel configuration
    await showVercelConfiguration(railwayConfig);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    if (connection) {
      await connection.end().catch(() => {});
    }
    rl.close();
  }
}

async function showVercelConfiguration(railwayConfig) {
  console.log('\n╔══════════════════════════════════════════════════════════════════╗');
  console.log('║   NEXT: Configure Vercel Environment Variables                  ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝\n');

  const jwtSecret = require('crypto').randomBytes(32).toString('hex');
  const jwtRefreshSecret = require('crypto').randomBytes(32).toString('hex');

  const vercelEnvContent = `# Add these to Vercel Dashboard
# Go to: https://vercel.com/dashboard
# Select project → Settings → Environment Variables

DB_HOST=${railwayConfig.host}
DB_PORT=${railwayConfig.port}
DB_USER=${railwayConfig.user}
DB_PASSWORD=${railwayConfig.password}
DB_NAME=${railwayConfig.database}

JWT_SECRET=${jwtSecret}
JWT_REFRESH_SECRET=${jwtRefreshSecret}
JWT_EXPIRE=1h
JWT_REFRESH_EXPIRE=7d

NODE_ENV=production
CLIENT_URL=https://iter-college-management-7sct95bwk-mrinallsamal-bytes-projects.vercel.app
CORS_WHITELIST=https://iter-college-management-7sct95bwk-mrinallsamal-bytes-projects.vercel.app
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
`;

  await fs.writeFile('vercel-env-variables.txt', vercelEnvContent);
  console.log('✅ Vercel configuration saved to: vercel-env-variables.txt\n');

  console.log('📋 To complete setup:\n');
  console.log('1. Open vercel-env-variables.txt');
  console.log('2. Go to https://vercel.com/dashboard');
  console.log('3. Select your project');
  console.log('4. Go to Settings → Environment Variables');
  console.log('5. Add each variable and click Save');
  console.log('6. Redeploy: Deployments → Latest → Redeploy\n');

  console.log('🎓 Demo Accounts:\n');
  console.log('   Admin:   admin1@iter.edu / Admin@123456');
  console.log('   Teacher: teacher1@iter.edu / Teacher@123');
  console.log('   Student: student1@iter.edu / Student@123\n');

  console.log('🧪 After configuring Vercel, test with:');
  console.log('   node test-vercel-deployment.js\n');

  console.log('🌐 Your website:');
  console.log('   https://iter-college-management-7sct95bwk-mrinallsamal-bytes-projects.vercel.app/index.html\n');
}

// Run setup
setupRailwayDatabase();
