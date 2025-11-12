// Create database schema in Vercel Postgres
const { sql } = require('@vercel/postgres');
const fs = require('fs');
require('dotenv').config();

async function createSchema() {
  console.log('\n📋 Creating schema in Vercel Postgres\n');

  try {
    // Read the schema file
    const schemaSQL = fs.readFileSync('supabase-schema.sql', 'utf8');

    // Split into individual statements (separated by semicolons)
    const statements = schemaSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    console.log(`Found ${statements.length} SQL statements to execute\n`);

    let executed = 0;
    let failed = 0;

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      
      // Extract table name for logging
      const tableMatch = statement.match(/CREATE TABLE\s+(\w+)/i);
      const indexMatch = statement.match(/CREATE INDEX\s+(\w+)/i);
      const triggerMatch = statement.match(/CREATE TRIGGER\s+(\w+)/i);
      
      let description = `Statement ${i + 1}`;
      if (tableMatch) description = `Table: ${tableMatch[1]}`;
      else if (indexMatch) description = `Index: ${indexMatch[1]}`;
      else if (triggerMatch) description = `Trigger: ${triggerMatch[1]}`;

      try {
        await sql.query(statement);
        console.log(`✅ ${description}`);
        executed++;
      } catch (error) {
        // Ignore "already exists" errors
        if (error.message.includes('already exists')) {
          console.log(`⏭️  ${description} (already exists)`);
        } else {
          console.log(`❌ ${description}: ${error.message}`);
          failed++;
        }
      }
    }

    console.log(`\n📊 Summary:`);
    console.log(`   ✅ Executed: ${executed}`);
    console.log(`   ❌ Failed: ${failed}`);

    // Verify tables were created
    console.log('\n📊 Verifying tables...\n');
    const tables = [
      'users', 'attendance', 'marks', 'assignments', 'events',
      'timetable', 'files', 'clubs', 'announcements'
    ];

    for (const table of tables) {
      try {
        const result = await sql`
          SELECT table_name 
          FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = ${table}
        `;
        
        if (result.rows.length > 0) {
          console.log(`   ✅ Table '${table}' exists`);
        } else {
          console.log(`   ❌ Table '${table}' not found`);
        }
      } catch (error) {
        console.log(`   ❌ Error checking '${table}': ${error.message}`);
      }
    }

    console.log('\n✅ Schema creation complete!');
    console.log('\nNext step: Run data migration');
    console.log('   node migrate-supabase-to-vercel-postgres.js\n');

  } catch (error) {
    console.error('\n❌ Error creating schema:', error.message);
    console.error('\nTroubleshooting:');
    console.error('1. Make sure POSTGRES_URL is set in your .env');
    console.error('2. Verify Vercel Postgres database exists');
    console.error('3. Check supabase-schema.sql file exists');
    process.exit(1);
  }
}

createSchema();
