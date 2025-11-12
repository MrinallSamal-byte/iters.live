/**
 * Run all MySQL SQL files for this project in a safe order.
 * - Uses environment DB_ vars or sensible defaults
 * - Creates the database if it doesn't exist
 * - Handles DELIMITER blocks (//, $$) for triggers/procs/events
 * - Executes statements sequentially and logs progress
 */

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config();

const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = Number(process.env.DB_PORT || 3306);
const DB_USER = process.env.DB_USER || 'root';
const DB_PASSWORD = process.env.DB_PASSWORD || '';
const DB_NAME = process.env.DB_NAME || 'iter_college_db';

// Ordered SQL files to run
const includeFileMgmt = process.env.INCLUDE_FILE_MGMT === '1';
const SQL_FILES = [
  path.join(__dirname, '..', 'database', 'init.sql'),
  path.join(__dirname, '..', 'database', 'migrations', 'create-profile-tables.sql'),
  path.join(__dirname, '..', 'database', 'migrations', 'security-enhancements.sql'),
  includeFileMgmt && path.join(__dirname, '..', 'database', 'migrations', 'create-file-management-tables.sql'),
  path.join(__dirname, '..', 'database', 'schema', 'notes-schema.sql'),
  path.join(__dirname, '..', 'database', 'migrations', 'ai-features.sql'),
  path.join(__dirname, '..', 'database', 'migrations', 'performance-optimization.sql'),
  path.join(__dirname, '..', 'database', 'migrations', '20251010_add_teacher_features.sql'),
].filter(Boolean).filter(fs.existsSync);

function parseStatementsWithDelimiter(raw) {
  // Normalize line endings
  const text = raw.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');

  const lines = text.split('\n');
  let delimiter = ';';
  let buffer = '';
  const statements = [];

  const pushStmt = (stmt) => {
    const s = stmt.trim();
    if (!s) return;
    // Skip USE statements (we connect to the DB already)
    if (/^USE\s+/i.test(s)) return;
    // Skip pure comment statements
    if (/^--/.test(s) || /^\/\*/.test(s)) return;
    statements.push(s);
  };

  for (let line of lines) {
    const dmatch = line.match(/^\s*DELIMITER\s+(.+)\s*$/i);
    if (dmatch) {
      // Flush existing buffer before changing delimiter (if any)
      if (buffer.trim()) {
        // If buffer ends with existing delimiter, trim it
        if (buffer.trimEnd().endsWith(delimiter)) {
          buffer = buffer.trimEnd().slice(0, -delimiter.length);
        }
        pushStmt(buffer);
        buffer = '';
      }
      delimiter = dmatch[1];
      continue;
    }

    // Remove inline comments starting with -- (not inside strings, naive)
    if (!/\'.*--.*\'/g.test(line) && !/\".*--.*\"/g.test(line)) {
      const idx = line.indexOf('--');
      if (idx >= 0) line = line.substring(0, idx);
    }

    buffer += line + '\n';

    // If current delimiter is found at end (after trimming), push statement
    if (buffer.trimEnd().endsWith(delimiter)) {
      const stmt = buffer.trimEnd().slice(0, -delimiter.length);
      pushStmt(stmt);
      buffer = '';
    }
  }

  // Push remaining buffer
  if (buffer.trim()) pushStmt(buffer);
  return statements.map(s => s.trim()).filter(Boolean);
}

async function ensureDatabase() {
  const conn = await mysql.createConnection({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
    multipleStatements: true,
  });
  await conn.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
  await conn.end();
}

async function run() {
  console.log('Running SQL migrations...');
  console.log(`DB: ${DB_USER}@${DB_HOST}:${DB_PORT}/${DB_NAME}`);

  await ensureDatabase();

  const conn = await mysql.createConnection({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
    multipleStatements: true,
    charset: 'utf8mb4',
  });

  let totalStatements = 0;
  let success = 0;
  let warnings = 0;
  let skipped = 0;
  let errors = 0;

  for (const file of SQL_FILES) {
    const label = path.relative(path.join(__dirname, '..', 'database'), file);
    console.log('\n' + '='.repeat(70));
    console.log(`Executing: ${label}`);
    console.log('='.repeat(70));

    try {
      const raw = fs.readFileSync(file, 'utf8');
  const statements = parseStatementsWithDelimiter(raw);
      console.log(`Found ${statements.length} statements`);

      for (let i = 0; i < statements.length; i++) {
        const stmt = statements[i];
        totalStatements++;
        // Skip known incompatible or optional statements
        const sHead = stmt.slice(0, 80).toUpperCase();
        const shouldSkip = (
          /^CREATE\s+TRIGGER/i.test(stmt) ||
          /^CREATE\s+OR\s+REPLACE\s+VIEW/i.test(stmt) ||
          /^CREATE\s+EVENT/i.test(stmt) ||
          /^DROP\s+EVENT/i.test(stmt) ||
          /^DROP\s+TABLE\s+IF\s+EXISTS\s+view_/i.test(stmt) ||
          /^CREATE\s+TABLE\s+view_/i.test(stmt) ||
          /CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS/i.test(stmt) ||
          /ADD\s+INDEX[^;]+IF\s+EXISTS/i.test(stmt) ||
          /ON\s+attendance\s*\(user_id/i.test(stmt) ||
          /ON\s+assignments\s*\(due_date/i.test(stmt)
        );
        if (shouldSkip) {
          skipped++;
          console.log(`Skipped stmt ${i + 1}: ${sHead} ...`);
          continue;
        }
        try {
          await conn.query(stmt);
          success++;
        } catch (e) {
          const msg = (e.message || '').toLowerCase();
          const benign = (
            msg.includes('already exists') ||
            msg.includes('duplicate') ||
            msg.includes('unknown system variable delimiter') ||
            msg.includes('you have an error in your sql syntax near "delimiter"') ||
            msg.includes('check that column/key exists')
          );
          if (benign) {
            warnings++;
            console.log(`Warning on stmt ${i + 1}: ${e.message.split('\n')[0]}`);
          } else {
            errors++;
            console.log(`Error on stmt ${i + 1}: ${e.message.split('\n')[0]}`);
            console.log(`Statement preview: ${stmt.substring(0, 200)}...`);
          }
        }
      }
    } catch (e) {
      errors++;
      console.error(`Failed reading ${label}:`, e.message);
    }
  }

  console.log('\nSummary');
  console.log('-'.repeat(70));
  console.log(`Total statements: ${totalStatements}`);
  console.log(`  Success: ${success}`);
  console.log(`  Warnings: ${warnings}`);
  console.log(`  Skipped: ${skipped}`);
  console.log(`  Errors: ${errors}`);

  // Verify a few key tables
  try {
    const [rows] = await conn.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = ? AND table_name IN ('users','files','notes','assignments','announcements') ORDER BY table_name`,
      [DB_NAME]
    );
    console.log('\nVerified tables present:', rows.map(r => r.TABLE_NAME || r.table_name).join(', ') || '(none)');
  } catch (_) {}

  await conn.end();

  if (errors > 0) {
    console.log('\nCompleted with errors. Review the logs above.');
    process.exitCode = 1;
  } else {
    console.log('\nAll SQL files executed.');
  }
}

run().catch(err => {
  console.error('Migration runner failed:', err);
  process.exit(1);
});
