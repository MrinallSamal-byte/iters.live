// Migrate Only Missing Tables (Assignments and Events)
require('dotenv').config();
const { Client: PgClient } = require('pg');

async function migrateMissingData() {
    console.log('🚀 Migrating missing data (assignments and events)...\n');

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
        await sourceClient.connect();
        console.log('✅ Connected to Supabase (source)\n');

        await targetClient.connect();
        console.log('✅ Connected to Render PostgreSQL (target)\n');

        // Only migrate assignments and events
        const tables = ['assignments', 'events'];
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

                    if (inserted % 10 === 0) {
                        process.stdout.write(`\r   ✅ Inserted ${inserted}/${result.rows.length} records`);
                    }
                } catch (error) {
                    console.log(`\n   ❌ Error inserting row:`, error.message);
                }
            }

            console.log(`\r   ✅ Inserted ${inserted}/${result.rows.length} records`);

            // Verify
            const verifyResult = await targetClient.query(`SELECT COUNT(*) FROM ${table}`);
            console.log(`   ✅ Successfully migrated ${inserted} records`);
            console.log(`   📊 Total records in target: ${verifyResult.rows[0].count}\n`);

            totalMigrated += inserted;
        }

        console.log('\n╔════════════════════════════════════════════════════════════╗');
        console.log('║            ✅ Migration Complete!                          ║');
        console.log('╚════════════════════════════════════════════════════════════╝\n');
        console.log(`📊 Total records migrated: ${totalMigrated}\n`);

    } catch (error) {
        console.error('❌ Migration error:', error.message);
        process.exit(1);
    } finally {
        await sourceClient.end();
        await targetClient.end();
    }
}

migrateMissingData();
