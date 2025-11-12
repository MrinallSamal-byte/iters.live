// Migrate data from Supabase to Vercel Postgres
const { Client: SupabaseClient } = require('pg');
const { sql } = require('@vercel/postgres');
require('dotenv').config();

// Supabase connection
const supabaseConfig = {
  host: process.env.DB_HOST,
  port: 5432,
  user: 'postgres',
  password: process.env.DB_PASSWORD,
  database: 'postgres',
  ssl: { rejectUnauthorized: false }
};

async function migrateToVercelPostgres() {
  console.log('\n🔄 Migrating from Supabase to Vercel Postgres\n');

  let supabaseClient;

  try {
    // Connect to Supabase
    console.log('📡 Connecting to Supabase...');
    supabaseClient = new SupabaseClient(supabaseConfig);
    await supabaseClient.connect();
    console.log('✅ Connected to Supabase\n');

    // Test Vercel Postgres connection
    console.log('📡 Testing Vercel Postgres connection...');
    const testResult = await sql`SELECT 1 as test`;
    console.log('✅ Connected to Vercel Postgres\n');

    // Get tables to migrate
    const tables = [
      'users',
      'attendance',
      'marks',
      'assignments',
      'assignment_submissions',
      'events',
      'event_registrations',
      'timetable',
      'admit_cards',
      'files',
      'hostel_menu',
      'fees',
      'clubs',
      'achievements',
      'announcements',
      'activity_log',
      'system_settings',
      'refresh_tokens'
    ];

    let totalRecords = 0;

    for (const table of tables) {
      try {
        console.log(`\n📋 Migrating table: ${table}`);

        // Get data from Supabase
        const result = await supabaseClient.query(`SELECT * FROM ${table}`);
        const rows = result.rows;

        if (rows.length === 0) {
          console.log(`   ⚠️  No data in ${table}`);
          continue;
        }

        console.log(`   Found ${rows.length} records`);

        // Get column names
        const columns = Object.keys(rows[0]);
        
        // Prepare insert statement
        const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
        const columnNames = columns.join(', ');
        const insertQuery = `INSERT INTO ${table} (${columnNames}) VALUES (${placeholders})`;

        // Insert data into Vercel Postgres
        let inserted = 0;
        for (const row of rows) {
          try {
            const values = columns.map(col => {
              let value = row[col];
              
              // Handle data type conversions
              if (value instanceof Date) {
                return value.toISOString();
              }
              if (typeof value === 'boolean') {
                return value;
              }
              if (value === null || value === undefined) {
                return null;
              }
              return value;
            });

            // Use Vercel Postgres sql template
            await sql.query(insertQuery, values);
            inserted++;
            
            if (inserted % 100 === 0) {
              process.stdout.write(`   Progress: ${inserted}/${rows.length}\r`);
            }
          } catch (error) {
            console.log(`\n   ❌ Error inserting row: ${error.message}`);
          }
        }

        console.log(`\n   ✅ Inserted ${inserted}/${rows.length} records`);
        totalRecords += inserted;

      } catch (error) {
        console.log(`   ❌ Error migrating ${table}: ${error.message}`);
      }
    }

    console.log(`\n\n✅ Migration Complete! Total records migrated: ${totalRecords}\n`);

    // Verify migration
    console.log('📊 Verifying migration:\n');
    for (const table of ['users', 'attendance', 'marks', 'assignments', 'events']) {
      try {
        const result = await sql`SELECT COUNT(*) as count FROM ${sql(table)}`;
        const count = result.rows[0].count;
        console.log(`   ${table}: ${count} records`);
      } catch (error) {
        console.log(`   ${table}: Error - ${error.message}`);
      }
    }

    console.log('\n🎉 Migration successful!');
    console.log('\nNext steps:');
    console.log('1. Deploy to Vercel: vercel --prod');
    console.log('2. Test the API: node test-vercel-deployment.js');

  } catch (error) {
    console.error('\n❌ Migration error:', error.message);
    console.error('\nTroubleshooting:');
    console.error('1. Make sure POSTGRES_URL is set in your .env');
    console.error('2. Verify Vercel Postgres database is created');
    console.error('3. Check that schema is created (run create-vercel-schema.js first)');
    process.exit(1);
  } finally {
    if (supabaseClient) await supabaseClient.end();
  }
}

migrateToVercelPostgres();
