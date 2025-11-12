// Migrate Data from Render to Neon PostgreSQL
require('dotenv').config();
const { Client } = require('pg');

// Source: Render PostgreSQL (explicitly use Render URL)
const RENDER_URL = 'postgresql://iter_college_db_user:93UqDvuxyr57TKtxgvBWIVSj3CcAJe6B@dpg-d3o80g3e5dus73agr8q0-a.ohio-postgres.render.com/iter_college_db';

// Target: Neon PostgreSQL
const NEON_URL = process.env.NEON_DATABASE_URL || 
                 'postgresql://neondb_owner:npg_GydRSne3hs4g@ep-nameless-truth-ad9vx1o4-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function migrateToNeon() {
    console.log('🚀 Starting migration from Render to Neon PostgreSQL...\n');

    const sourceClient = new Client({
        connectionString: RENDER_URL,
        ssl: { rejectUnauthorized: false }
    });

    const targetClient = new Client({
        connectionString: NEON_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        // Connect to both databases
        await sourceClient.connect();
        console.log('✅ Connected to Render PostgreSQL (source)\n');

        await targetClient.connect();
        console.log('✅ Connected to Neon PostgreSQL (target)\n');

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
            console.log(`📋 Migrating table: ${table}`);
            console.log('━'.repeat(60));

            // Get data from source
            const result = await sourceClient.query(`SELECT * FROM ${table}`);
            console.log(`   Found ${result.rows.length} records`);

            if (result.rows.length === 0) {
                console.log(`   ⏭️  No data to migrate\n`);
                continue;
            }

            // Insert into target
            let inserted = 0;
            let skipped = 0;

            for (const row of result.rows) {
                try {
                    const columns = Object.keys(row);
                    const values = Object.values(row).map(v => {
                        if (v instanceof Date) return v.toISOString();
                        if (v === null) return null;
                        return v;
                    });

                    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
                    const insertQuery = `
                        INSERT INTO ${table} (${columns.join(', ')})
                        VALUES (${placeholders})
                    `;

                    await targetClient.query(insertQuery, values);
                    inserted++;

                    // Progress indicator
                    if (inserted % 100 === 0) {
                        process.stdout.write(`\r   ✅ Inserted ${inserted}/${result.rows.length} records`);
                    }
                } catch (error) {
                    skipped++;
                    if (skipped <= 3) {
                        console.log(`\n   ⚠️  Skipped row: ${error.message}`);
                    }
                }
            }

            console.log(`\r   ✅ Inserted ${inserted}/${result.rows.length} records`);

            if (skipped > 0) {
                console.log(`   ⚠️  Skipped ${skipped} records (duplicates or errors)`);
            }

            // Verify count
            const verifyResult = await targetClient.query(`SELECT COUNT(*) FROM ${table}`);
            console.log(`   ✅ Successfully migrated ${inserted} records`);
            console.log(`   📊 Total records in Neon: ${verifyResult.rows[0].count}\n`);

            totalMigrated += inserted;
        }

        console.log('\n╔════════════════════════════════════════════════════════════╗');
        console.log('║            ✅ Migration Complete!                          ║');
        console.log('╚════════════════════════════════════════════════════════════╝\n');
        console.log(`📊 Total records migrated: ${totalMigrated}\n`);
        console.log('✅ All data successfully migrated from Render to Neon!');
        console.log('\n🚀 Ready to deploy to Vercel!\n');

    } catch (error) {
        console.error('❌ Migration error:', error.message);
        process.exit(1);
    } finally {
        await sourceClient.end();
        await targetClient.end();
    }
}

migrateToNeon();
