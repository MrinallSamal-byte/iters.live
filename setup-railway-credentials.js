require('dotenv').config();
const readline = require('readline');
const fs = require('fs').promises;
const path = require('path');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

async function setupRailwayCredentials() {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║   Railway MySQL Configuration Helper                    ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  console.log('This tool will help you configure Railway MySQL credentials.\n');
  console.log('You can find these values in Railway dashboard:');
  console.log('1. Go to https://railway.app/dashboard');
  console.log('2. Select your MySQL service');
  console.log('3. Click on "Variables" tab\n');

  try {
    // Get credentials from user
    console.log('Enter your Railway MySQL credentials:\n');
    
    const host = await question('MYSQLHOST (e.g., containers-us-west-xxx.railway.app): ');
    const port = await question('MYSQLPORT (default 3306): ') || '3306';
    const user = await question('MYSQLUSER (e.g., root): ');
    const password = await question('MYSQLPASSWORD: ');
    const database = await question('MYSQLDATABASE (default iter_college_db): ') || 'iter_college_db';

    console.log('\n--- Optional Configuration ---\n');
    const jwtSecret = await question('JWT_SECRET (press Enter for auto-generated): ');
    const jwtRefreshSecret = await question('JWT_REFRESH_SECRET (press Enter for auto-generated): ');

    // Generate secrets if not provided
    const finalJwtSecret = jwtSecret || require('crypto').randomBytes(32).toString('hex');
    const finalJwtRefreshSecret = jwtRefreshSecret || require('crypto').randomBytes(32).toString('hex');

    // Create .env content
    const envContent = `# Server Configuration
NODE_ENV=production
CLIENT_URL=https://iter-college-management-7sct95bwk-mrinallsamal-bytes-projects.vercel.app

# Railway MySQL Database Configuration
DB_HOST=${host}
DB_PORT=${port}
DB_USER=${user}
DB_PASSWORD=${password}
DB_NAME=${database}

# JWT Configuration
JWT_SECRET=${finalJwtSecret}
JWT_REFRESH_SECRET=${finalJwtRefreshSecret}
JWT_EXPIRE=1h
JWT_REFRESH_EXPIRE=7d

# File Upload Configuration
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=10485760
STORAGE_MODE=local

# CORS Configuration
CORS_WHITELIST=https://iter-college-management-7sct95bwk-mrinallsamal-bytes-projects.vercel.app

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
`;

    // Save to .env.railway
    const envPath = path.join(__dirname, '.env.railway');
    await fs.writeFile(envPath, envContent);
    console.log('\n✅ Configuration saved to .env.railway\n');

    // Create Vercel environment variables guide
    const vercelEnvContent = `# Copy these environment variables to Vercel Dashboard
# Go to: https://vercel.com/dashboard → Your Project → Settings → Environment Variables

DB_HOST=${host}
DB_PORT=${port}
DB_USER=${user}
DB_PASSWORD=${password}
DB_NAME=${database}
JWT_SECRET=${finalJwtSecret}
JWT_REFRESH_SECRET=${finalJwtRefreshSecret}
JWT_EXPIRE=1h
JWT_REFRESH_EXPIRE=7d
NODE_ENV=production
CORS_WHITELIST=https://iter-college-management-7sct95bwk-mrinallsamal-bytes-projects.vercel.app
`;

    const vercelEnvPath = path.join(__dirname, 'vercel-env-variables.txt');
    await fs.writeFile(vercelEnvPath, vercelEnvContent);
    console.log('✅ Vercel configuration saved to vercel-env-variables.txt\n');

    // Test connection option
    console.log('───────────────────────────────────────────────────────────\n');
    const testNow = await question('Do you want to test the Railway connection now? (y/n): ');
    
    if (testNow.toLowerCase() === 'y') {
      console.log('\n🔍 Testing Railway connection...\n');
      
      // Temporarily update .env for testing
      const currentEnv = path.join(__dirname, '.env');
      await fs.copyFile(currentEnv, path.join(__dirname, '.env.backup'));
      await fs.copyFile(envPath, currentEnv);
      
      try {
        // Import and run check
        const mysql = require('mysql2/promise');
        const connection = await mysql.createConnection({
          host,
          port,
          user,
          password,
          database,
          connectTimeout: 10000
        });

        console.log('✅ Successfully connected to Railway MySQL!\n');

        // Check tables
        const [tables] = await connection.query('SHOW TABLES');
        console.log(`✅ Found ${tables.length} tables in database`);

        if (tables.length === 0) {
          console.log('\n⚠️  Database is empty. You need to seed it.');
          console.log('   Run: node server/seed/seed.js');
        } else {
          // Check for users
          const [users] = await connection.query('SELECT COUNT(*) as count FROM users');
          console.log(`✅ Database has ${users[0].count} users`);

          if (users[0].count === 0) {
            console.log('\n⚠️  No users found. You need to seed the database.');
            console.log('   Run: node server/seed/seed.js');
          } else {
            console.log('\n🎉 Railway database is ready!\n');
          }
        }

        await connection.end();
      } catch (error) {
        console.error('❌ Connection test failed:', error.message);
        console.error('\nPlease verify:');
        console.error('1. Credentials are correct');
        console.error('2. Railway MySQL service is running');
        console.error('3. Your IP is allowed to connect');
      } finally {
        // Restore original .env
        await fs.copyFile(path.join(__dirname, '.env.backup'), currentEnv);
        await fs.unlink(path.join(__dirname, '.env.backup'));
      }
    }

    console.log('\n╔══════════════════════════════════════════════════════════╗');
    console.log('║                   NEXT STEPS                             ║');
    console.log('╚══════════════════════════════════════════════════════════╝\n');

    console.log('1. Add variables to Vercel:');
    console.log('   - Open: vercel-env-variables.txt');
    console.log('   - Go to: https://vercel.com/dashboard');
    console.log('   - Navigate to: Settings → Environment Variables');
    console.log('   - Copy and paste each variable\n');

    console.log('2. Seed Railway database:');
    console.log('   - Copy .env.railway to .env');
    console.log('   - Run: node server/seed/seed.js');
    console.log('   - Run: node check-railway-db.js\n');

    console.log('3. Redeploy Vercel:');
    console.log('   - Run: vercel --prod');
    console.log('   - Or trigger redeploy from Vercel dashboard\n');

    console.log('4. Test deployment:');
    console.log('   - Run: node test-vercel-deployment.js\n');

    console.log('📚 For detailed instructions, see:');
    console.log('   - RAILWAY_VERCEL_SETUP_CHECKLIST.md');
    console.log('   - RAILWAY_VERCEL_TESTING_GUIDE.md\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
  } finally {
    rl.close();
  }
}

// Run the setup
setupRailwayCredentials();
