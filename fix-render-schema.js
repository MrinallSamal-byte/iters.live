// Fix Render Schema - Add Missing Columns
require('dotenv').config();
const { Client } = require('pg');

async function fixSchema() {
    console.log('🔧 Fixing Render PostgreSQL schema...\n');

    const client = new Client({
        connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log('✅ Connected to Render PostgreSQL\n');

        // Fix assignments table - add deadline column
        console.log('📝 Fixing assignments table...');
        try {
            await client.query(`
                ALTER TABLE assignments 
                ADD COLUMN IF NOT EXISTS deadline TIMESTAMP
            `);
            console.log('✅ Added deadline column to assignments\n');
        } catch (error) {
            console.log('⚠️  Column might already exist:', error.message, '\n');
        }

        // Fix events table - add event_time column
        console.log('📝 Fixing events table...');
        try {
            await client.query(`
                ALTER TABLE events 
                ADD COLUMN IF NOT EXISTS event_time TIME
            `);
            console.log('✅ Added event_time column to events\n');
        } catch (error) {
            console.log('⚠️  Column might already exist:', error.message, '\n');
        }

        // Verify the fixes
        console.log('🔍 Verifying schema...\n');

        const assignmentsColumns = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'assignments'
            ORDER BY ordinal_position
        `);

        console.log('📋 Assignments table columns:');
        assignmentsColumns.rows.forEach(col => {
            console.log(`   - ${col.column_name} (${col.data_type})`);
        });

        const eventsColumns = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'events'
            ORDER BY ordinal_position
        `);

        console.log('\n📋 Events table columns:');
        eventsColumns.rows.forEach(col => {
            console.log(`   - ${col.column_name} (${col.data_type})`);
        });

        console.log('\n✅ Schema fixed successfully!');

    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    } finally {
        await client.end();
    }
}

fixSchema();
