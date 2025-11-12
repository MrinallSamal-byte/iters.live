// Migrate Data from Supabase to Render PostgreSQL
require('dotenv').config();
const { Client: PgClient } = require('pg');

async function migrateData() {
    console.log('🚀 Starting migration from Supabase to Render PostgreSQL...\n');

    // Source: Supabase
    const sourceClient = new PgClient({
        host: 'db.mgucumgyycldyxryiovw.supabase.co',
        port: 5432,
        user: 'postgres',
        password: 'Mrinall@1123',
        database: 'postgres',
        ssl: { rejectUnauthorized: false }
    });

    // Target: Render PostgreSQL
    const targetClient = new PgClient({
        connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        // Connect to both databases
        await sourceClient.connect();
        console.log('✅ Connected to Supabase (source)\n');

        await targetClient.connect();
        console.log('✅ Connected to Render PostgreSQL (target)\n');

        // Tables in dependency order
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

        let totalMigrated = 0;

        for (const table of tables) {
            console.log(`\n📋 Migrating table: ${table}`);
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

            // Get data from source
            const sourceData = await sourceClient.query(`SELECT * FROM ${table}`);
            const rowCount = sourceData.rows.length;

            console.log(`   Found ${rowCount} records`);

            if (rowCount === 0) {
                console.log(`   ⏭️  No data to migrate`);
                continue;
            }

            // Get column names
            const columns = Object.keys(sourceData.rows[0]);
            const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
            const insertSQL = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`;

            // Insert data in batches
            let inserted = 0;
            for (let i = 0; i < sourceData.rows.length; i++) {
                const row = sourceData.rows[i];
                const values = columns.map(col => {
                    const value = row[col];
                    // Handle dates and special types
                    if (value instanceof Date) {
                        return value.toISOString();
                    }
                    return value;
                });

                try {
                    await targetClient.query(insertSQL, values);
                    inserted++;

                    // Progress indicator
                    if (inserted % 100 === 0 || inserted === rowCount) {
                        process.stdout.write(`\r   ✅ Inserted ${inserted}/${rowCount} records`);
                    }
                } catch (error) {
                    // Skip duplicates silently
                    if (!error.message.includes('duplicate key')) {
                        console.error(`\n   ❌ Error inserting row: ${error.message}`);
                    }
                }
            }

            console.log(`\n   ✅ Successfully migrated ${inserted} records`);
            totalMigrated += inserted;

            // Verify
            const verifyResult = await targetClient.query(`SELECT COUNT(*) FROM ${table}`);
            console.log(`   📊 Total records in target: ${verifyResult.rows[0].count}`);
        }

        console.log('\n\n╔════════════════════════════════════════════════════════════╗');
        console.log('║            ✅ Migration Complete!                          ║');
        console.log('╚════════════════════════════════════════════════════════════╝');
        console.log(`\n📊 Total records migrated: ${totalMigrated}`);
        console.log('\n✅ All data successfully migrated from Supabase to Render PostgreSQL!');

    } catch (error) {
        console.error('\n❌ Migration error:', error.message);
        console.error(error);
        process.exit(1);
    } finally {
        await sourceClient.end();
        await targetClient.end();
    }
}

migrateData();
