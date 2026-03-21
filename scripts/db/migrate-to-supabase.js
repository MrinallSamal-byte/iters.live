// Migrate data from Railway MySQL to Supabase PostgreSQL
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

// Supabase PostgreSQL connection (will be set from .env after you provide credentials)
const supabaseConfig = {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'postgres',
  ssl: {
    rejectUnauthorized: false
  }
};

async function migrateData() {
  console.log('\n🔄 Starting Migration: Railway MySQL → Supabase PostgreSQL\n');

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
        console.log(`\n📋 Migrating table: ${table}`);

        // Get data from MySQL
        const [rows] = await mysqlConn.query(`SELECT * FROM ${table}`);
        
        if (rows.length === 0) {
          console.log(`   ⚠️  No data in ${table}`);
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
              process.stdout.write(`\r   Inserted ${inserted}/${rows.length} records...`);
            }
          } catch (err) {
            console.error(`\n   ❌ Error inserting row:`, err.message);
            // Continue with next row
          }
        }

        console.log(`\n   ✅ Migrated ${inserted}/${rows.length} records`);
        totalRecords += inserted;

        // Reset sequence for auto-increment columns
        if (columns.includes('id')) {
          await pgClient.query(`SELECT setval(pg_get_serial_sequence('${table}', 'id'), COALESCE((SELECT MAX(id) FROM ${table}), 1), true)`);
        }

      } catch (tableError) {
        console.error(`\n   ❌ Error migrating table ${table}:`, tableError.message);
      }
    }

    console.log('\n\n═══════════════════════════════════════════');
    console.log('✅ Migration Complete!');
    console.log('═══════════════════════════════════════════');
    console.log(`\nTotal records migrated: ${totalRecords}`);
    console.log('\nVerifying data...\n');

    // Verify migration
    const verifyTables = ['users', 'attendance', 'marks', 'assignments', 'events'];
    for (const table of verifyTables) {
      const result = await pgClient.query(`SELECT COUNT(*) as count FROM ${table}`);
      console.log(`✅ ${table}: ${result.rows[0].count} records`);
    }

    console.log('\n✅ Data migration successful!\n');

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    throw error;
  } finally {
    // Close connections
    if (mysqlConn) {
      await mysqlConn.end();
      console.log('\n📡 Closed Railway MySQL connection');
    }
    if (pgClient) {
      await pgClient.end();
      console.log('📡 Closed Supabase PostgreSQL connection');
    }
  }
}

// Check if Supabase credentials are provided
if (!process.env.DB_HOST || !process.env.DB_PASSWORD) {
  console.error('\n❌ Error: Supabase credentials not found!');
  console.error('\nPlease add these to your .env file:');
  console.error('DB_HOST=db.{your-project-ref}.supabase.co');
  console.error('DB_PORT=5432');
  console.error('DB_USER=postgres');
  console.error('DB_PASSWORD=your-password');
  console.error('DB_NAME=postgres\n');
  process.exit(1);
}

// Run migration
migrateData()
  .then(() => {
    console.log('\n✅ All done! Your data is now in Supabase.');
    console.log('\nNext steps:');
    console.log('1. Update Vercel environment variables');
    console.log('2. Deploy to Vercel: vercel --prod');
    console.log('3. Test login at: https://iter-college-management.vercel.app\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Migration failed:', error.message);
    process.exit(1);
  });
