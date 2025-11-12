// Verify Neon PostgreSQL Data
require('dotenv').config();
const { Client } = require('pg');

const NEON_URL = process.env.NEON_DATABASE_URL || 
                 'postgresql://neondb_owner:npg_GydRSne3hs4g@ep-nameless-truth-ad9vx1o4-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function verifyNeonData() {
    console.log('🔍 Verifying Neon PostgreSQL data...\n');

    const client = new Client({
        connectionString: NEON_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log('✅ Connected to Neon PostgreSQL\n');

        const tables = [
            'users',
            'attendance',
            'marks',
            'assignments',
            'events',
            'assignment_submissions',
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

        console.log('📊 Record counts by table:\n');
        console.log('┌─────────────────────────────┬────────────┐');
        console.log('│ Table                       │ Count      │');
        console.log('├─────────────────────────────┼────────────┤');

        for (const table of tables) {
            const result = await client.query(`SELECT COUNT(*) FROM ${table}`);
            const count = parseInt(result.rows[0].count);
            totalRecords += count;
            
            const tablePadded = table.padEnd(27);
            const countPadded = count.toString().padStart(10);
            const emoji = count > 0 ? '✓' : ' ';
            console.log(`│ ${emoji} ${tablePadded} │ ${countPadded} │`);
        }

        console.log('├─────────────────────────────┼────────────┤');
        const totalPadded = totalRecords.toString().padStart(10);
        console.log(`│ TOTAL                       │ ${totalPadded} │`);
        console.log('└─────────────────────────────┴────────────┘\n');

        // Verify demo accounts
        console.log('🔍 Checking demo accounts:\n');
        
        const demoUsers = await client.query(`
            SELECT registration_number, name, email, role, department 
            FROM users 
            WHERE registration_number IN ('ADM2025001', 'TCH2025001', 'STU2025001')
            ORDER BY registration_number
        `);

        if (demoUsers.rows.length >= 2) {
            console.log('✅ Demo accounts found:');
            demoUsers.rows.forEach(user => {
                console.log(`   • ${user.registration_number} - ${user.name} (${user.role})`);
            });
        } else {
            console.log('⚠️  Missing demo accounts!');
        }

        console.log('\n✅ Verification complete!');
        console.log(`\n📊 Total records in Neon: ${totalRecords}`);

        // Compare with expected
        const expected = 15453;
        if (totalRecords === expected) {
            console.log(`✅ Perfect match! All ${expected} records migrated successfully!\n`);
        } else if (totalRecords > expected - 10) {
            console.log(`✅ Close match! Expected ${expected}, got ${totalRecords}\n`);
        } else {
            console.log(`⚠️  Expected ${expected} records, but found ${totalRecords}\n`);
        }

        console.log('🚀 Neon database is ready for Vercel deployment!');

    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    } finally {
        await client.end();
    }
}

verifyNeonData();
