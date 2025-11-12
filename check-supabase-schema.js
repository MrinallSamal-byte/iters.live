// Check Supabase Schema
require('dotenv').config();
const { Client } = require('pg');

async function checkSchema() {
    const client = new Client({
        host: 'db.mgucumgyycldyxryiovw.supabase.co',
        port: 5432,
        user: 'postgres',
        password: 'Mrinall@1123',
        database: 'postgres',
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log('✅ Connected to Supabase\n');

        // Check assignments columns
        const assignmentsResult = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'assignments'
            ORDER BY ordinal_position
        `);

        console.log('📋 Assignments table in Supabase:');
        assignmentsResult.rows.forEach(col => {
            console.log(`   - ${col.column_name} (${col.data_type})`);
        });

        // Check events columns
        const eventsResult = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'events'
            ORDER BY ordinal_position
        `);

        console.log('\n📋 Events table in Supabase:');
        eventsResult.rows.forEach(col => {
            console.log(`   - ${col.column_name} (${col.data_type})`);
        });

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await client.end();
    }
}

checkSchema();
