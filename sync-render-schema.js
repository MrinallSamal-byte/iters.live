// Sync Render Schema with Supabase
require('dotenv').config();
const { Client } = require('pg');

async function syncSchema() {
    console.log('🔄 Syncing Render schema with Supabase...\n');

    const client = new Client({
        connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log('✅ Connected to Render PostgreSQL\n');

        // Fix assignments table
        console.log('📝 Updating assignments table...');
        await client.query(`
            ALTER TABLE assignments 
            ADD COLUMN IF NOT EXISTS attachment_id INTEGER,
            ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
            DROP COLUMN IF EXISTS due_date CASCADE
        `);
        console.log('✅ Assignments table updated\n');

        // Fix events table
        console.log('📝 Updating events table...');
        await client.query(`
            ALTER TABLE events 
            ADD COLUMN IF NOT EXISTS image_url VARCHAR(500),
            ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
            ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            DROP COLUMN IF EXISTS organizer CASCADE
        `);
        console.log('✅ Events table updated\n');

        // Change event_date from TIMESTAMP to DATE in events
        console.log('📝 Fixing event_date column type...');
        try {
            await client.query(`ALTER TABLE events ALTER COLUMN event_date TYPE DATE`);
            console.log('✅ event_date converted to DATE\n');
        } catch (error) {
            console.log('⚠️  Could not change event_date type:', error.message, '\n');
        }

        // Change registration_deadline from TIMESTAMP to DATE in events
        console.log('📝 Fixing registration_deadline column type...');
        try {
            await client.query(`ALTER TABLE events ALTER COLUMN registration_deadline TYPE DATE`);
            console.log('✅ registration_deadline converted to DATE\n');
        } catch (error) {
            console.log('⚠️  Could not change registration_deadline type:', error.message, '\n');
        }

        // Change total_marks from INTEGER to NUMERIC in assignments
        console.log('📝 Fixing total_marks column type...');
        try {
            await client.query(`ALTER TABLE assignments ALTER COLUMN total_marks TYPE NUMERIC USING total_marks::numeric`);
            console.log('✅ total_marks converted to NUMERIC\n');
        } catch (error) {
            console.log('⚠️  Could not change total_marks type:', error.message, '\n');
        }

        console.log('✅ Schema sync complete!');

    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    } finally {
        await client.end();
    }
}

syncSchema();
