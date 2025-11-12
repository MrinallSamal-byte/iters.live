// Create Schema in Neon PostgreSQL
require('dotenv').config();
const { Client } = require('pg');
const fs = require('fs');

// Neon connection string (with prefix removed)
const NEON_URL = process.env.NEON_DATABASE_URL || 
                 'postgresql://neondb_owner:npg_GydRSne3hs4g@ep-nameless-truth-ad9vx1o4-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function createNeonSchema() {
    console.log('📋 Creating schema in Neon PostgreSQL...\n');

    const client = new Client({
        connectionString: NEON_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log('✅ Connected to Neon PostgreSQL\n');

        // Read the schema file
        const schemaSQL = fs.readFileSync('supabase-schema.sql', 'utf8');

        // Execute the entire schema
        console.log('📝 Executing schema (18 tables)...\n');
        await client.query(schemaSQL);

        console.log('✅ Schema created successfully!\n');

        // Verify tables
        const result = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_type = 'BASE TABLE'
            ORDER BY table_name
        `);

        console.log('📊 Tables created in Neon:');
        result.rows.forEach((row, index) => {
            console.log(`   ${(index + 1).toString().padStart(2, ' ')}. ${row.table_name}`);
        });

        console.log(`\n✅ Total: ${result.rows.length} tables created`);

        // Add missing columns based on our Render fixes
        console.log('\n🔧 Syncing schema with Render structure...\n');

        // Fix assignments table
        console.log('📝 Updating assignments table...');
        await client.query(`
            ALTER TABLE assignments 
            ADD COLUMN IF NOT EXISTS attachment_id INTEGER,
            ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true
        `);
        console.log('✅ Assignments table synced');

        // Fix events table
        console.log('📝 Updating events table...');
        await client.query(`
            ALTER TABLE events 
            ADD COLUMN IF NOT EXISTS image_url VARCHAR(500),
            ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
            ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        `);
        console.log('✅ Events table synced');

        // Change column types to match Render
        console.log('📝 Fixing column types...');
        try {
            await client.query(`ALTER TABLE events ALTER COLUMN event_date TYPE DATE`);
            await client.query(`ALTER TABLE events ALTER COLUMN registration_deadline TYPE DATE`);
            await client.query(`ALTER TABLE assignments ALTER COLUMN total_marks TYPE NUMERIC USING total_marks::numeric`);
            console.log('✅ Column types fixed');
        } catch (error) {
            console.log('⚠️  Column type changes:', error.message);
        }

        console.log('\n✅ Neon schema is ready for data migration!');

    } catch (error) {
        console.error('❌ Error creating schema:', error.message);
        process.exit(1);
    } finally {
        await client.end();
    }
}

createNeonSchema();
