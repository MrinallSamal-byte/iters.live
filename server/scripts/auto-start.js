require('dotenv').config();
const { spawn } = require('child_process');
const mysql = require('mysql2/promise');
const net = require('net');

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || ''
};

const dbName = process.env.DB_NAME || 'iter_college_db';
const autoSeed = (process.env.AUTO_SEED_ON_START || '').toLowerCase() !== 'false';
const isProd = (process.env.NODE_ENV || '').toLowerCase() === 'production';

async function needsSeeding() {
  let conn;
  try {
    conn = await mysql.createConnection(dbConfig);
    // Check if DB exists
    const [schemas] = await conn.query(
      'SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = ?;',
      [dbName]
    );
    if (!schemas.length) {
      console.log(`⏳ Database ${dbName} does not exist. Seeding required.`);
      return true;
    }
    await conn.query(`USE ${dbName}`);
    // Check if users table exists
    const [tables] = await conn.query(
      'SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?;',
      [dbName, 'users']
    );
    if (!tables.length) {
      console.log('⏳ Table users not found. Seeding required.');
      return true;
    }
    // Check for sentinel admin
    const [rows] = await conn.query(
      "SELECT COUNT(*) AS cnt FROM users WHERE registration_number = 'ADM2025001'"
    );
    const cnt = rows[0]?.cnt || 0;
    if (cnt === 0) {
      console.log('⏳ Sentinel admin not found. Seeding required.');
      return true;
    }
    return false;
  } catch (err) {
    console.warn('⚠️ Auto-seed check failed:', err.message);
    // If we cannot check, attempt to seed in non-production
    return !isProd;
  } finally {
    if (conn) await conn.end();
  }
}

function runNodeScript(scriptPath) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath], { stdio: 'inherit' });
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${scriptPath} exited with code ${code}`));
    });
    child.on('error', reject);
  });
}

function isPortInUse(port, host = '0.0.0.0') {
  return new Promise((resolve) => {
    const tester = net.createServer()
      .once('error', () => resolve(true))
      .once('listening', () => tester.once('close', () => resolve(false)).close())
      .listen(port, host);
  });
}

(async () => {
  try {
    if (autoSeed && !isProd) {
      const seedNeeded = await needsSeeding();
      if (seedNeeded) {
        console.log('\n═══════════════════════════════════════════════════════');
        console.log('🔁 AUTO-SEED: Running comprehensive seed on start...');
        console.log('═══════════════════════════════════════════════════════\n');
        await runNodeScript(require('path').join(__dirname, '../seed/comprehensive-seed.js'));
      } else {
        console.log('✅ AUTO-SEED: Database already seeded, skipping.');
      }
    } else {
      console.log('ℹ️ AUTO-SEED disabled (production or AUTO_SEED_ON_START=false).');
    }
  } catch (err) {
    console.error('❌ AUTO-SEED failed:', err.message);
    if (isProd) process.exit(1);
  } finally {
    const desiredPort = parseInt(process.env.PORT, 10) || 5000;
    const inUse = await isPortInUse(desiredPort);
    if (inUse) {
      console.log(`ℹ️ Port ${desiredPort} is already in use. Assuming server is running. Skipping start.`);
      process.exit(0);
    } else {
      console.log('🚀 Starting server...');
      await runNodeScript(require('path').join(__dirname, '../index.js'));
    }
  }
})();
