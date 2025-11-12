// Clean Supabase tables and migrate data from Railway MySQL
const mysql = require('mysql2/promise');
const { Client } = require('pg');
require('dotenv').config();

// Railway MySQL connection
const railwayConfig = {
  host: 'shortline.proxy.rlwy.net',
  port: 26910,
  user: 'root',
  password: 'NlEpRBhwEHsSHrDWEEfahDOMcEzfIdLh',
  database: 'railway'
};

// Supabase PostgreSQL connection
const supabaseConfig = {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'postgres',
  ssl: { rejectUnauthorized: false }
};

async function cleanAndMigrate() {
  console.log('\n🔄 Clean and Migrate: Railway MySQL → Supabase PostgreSQL\n');

  let mysqlConn, pgClient;

  try {
    // Connect to Railway MySQL
    console.log('📡 Connecting to Railway MySQL...');
    mysqlConn = await mysql.createConnection(railwayConfig);
    console.log('✅ Connected to Railway MySQL\n');

    // Connect to Supabase PostgreSQL
    console.log('📡 Connecting to Supabase PostgreSQL...');
    pgClient = new Client(supabaseConfig);
    await pgClient.connect();
    console.log('✅ Connected to Supabase PostgreSQL\n');

    // Clean all tables (reverse order due to foreign keys)
    console.log('🗑️  Cleaning existing data...\n');
    const tablesToClean = [
      'refresh_tokens',
      'system_settings',
      'activity_log',
      'announcements',
      'achievements',
      'clubs',
      'fees',
      'hostel_menu',
      'files',
      'admit_cards',
      'timetable',
      'event_registrations',
      'events',
      'assignment_submissions',
      'assignments',
      'marks',
      'attendance',
      'users'
    ];

    for (const table of tablesToClean) {
      try {
        await pgClient.query(`TRUNCATE TABLE ${table} RESTART IDENTITY CASCADE`);
        console.log(`   ✅ Cleaned ${table}`);
      } catch (error) {
        console.log(`   ⚠️  ${table} - ${error.message}`);
      }
    }

    console.log('\n✅ All tables cleaned\n');

    // Migration sequence (order matters due to foreign keys)
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
        console.log(`📋 Migrating table: ${table}`);

        // Get data from MySQL
        const [rows] = await mysqlConn.query(`SELECT * FROM ${table}`);
        
        if (rows.length === 0) {
          console.log(`   ⚠️  No data in ${table}\n`);
          continue;
        }

        console.log(`   Found ${rows.length} records`);

        // Get column names
        const columns = Object.keys(rows[0]);
        
        // Prepare PostgreSQL insert statement
        const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
        const columnNames = columns.join(', ');
        const insertQuery = `INSERT INTO ${table} (${columnNames}) VALUES (${placeholders})`;

        // Insert data into PostgreSQL
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

            await pgClient.query(insertQuery, values);
            inserted++;
            
            if (inserted % 100 === 0) {
              process.stdout.write(`   Progress: ${inserted}/${rows.length}\r`);
            }
          } catch (error) {
            console.log(`\n   ❌ Error inserting row: ${error.message}`);
          }
        }

        console.log(`   ✅ Inserted ${inserted}/${rows.length} records\n`);
        totalRecords += inserted;

        // Reset sequence for auto-increment columns
        await pgClient.query(`SELECT setval('${table}_id_seq', (SELECT MAX(id) FROM ${table}))`);

      } catch (error) {
        console.log(`   ❌ Error migrating ${table}: ${error.message}\n`);
      }
    }

    console.log(`\n✅ Migration Complete! Total records migrated: ${totalRecords}\n`);

    // Verify migration
    console.log('📊 Verifying migration:\n');
    for (const table of tables) {
      const result = await pgClient.query(`SELECT COUNT(*) FROM ${table}`);
      const count = result.rows[0].count;
      if (count > 0) {
        console.log(`   ${table}: ${count} records`);
      }
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  } finally {
    if (mysqlConn) await mysqlConn.end();
    if (pgClient) await pgClient.end();
  }
}

cleanAndMigrate();
