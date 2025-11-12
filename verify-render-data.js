// Verify Render Data
require('dotenv').config();
const { Client } = require('pg');

async function verifyData() {
    console.log('🔍 Verifying Render PostgreSQL data...\n');

    const client = new Client({
        connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log('✅ Connected to Render PostgreSQL\n');

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
            console.log(`│ ${tablePadded} │ ${countPadded} │`);
        }

        console.log('├─────────────────────────────┼────────────┤');
        const totalPadded = totalRecords.toString().padStart(10);
        console.log(`│ TOTAL                       │ ${totalPadded} │`);
        console.log('└─────────────────────────────┴────────────┘\n');

        // Verify demo accounts
        console.log('🔍 Checking demo accounts:\n');
        
        const demoUsers = await client.query(`
            SELECT user_id, name, email, role, department 
            FROM users 
            WHERE user_id IN ('ADM2025001', 'TCH2025001', 'STU2025001')
            ORDER BY user_id
        `);

        if (demoUsers.rows.length === 3) {
            console.log('✅ All demo accounts found:');
            demoUsers.rows.forEach(user => {
                console.log(`   • ${user.user_id} - ${user.name} (${user.role})`);
            });
        } else {
            console.log('⚠️  Missing demo accounts!');
        }

        console.log('\n✅ Verification complete!');
        console.log(`\n📊 Total records in Render PostgreSQL: ${totalRecords}`);

    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    } finally {
        await client.end();
    }
}

verifyData();
