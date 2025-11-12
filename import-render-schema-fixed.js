// Import Schema to Render PostgreSQL - Fixed Version
require('dotenv').config();
const { Client } = require('pg');
const fs = require('fs');

async function importSchema() {
    console.log('📋 Importing schema to Render PostgreSQL...\n');

    const client = new Client({
        connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log('✅ Connected to Render PostgreSQL\n');

        // Read the entire schema file
        const schemaSQL = fs.readFileSync('supabase-schema.sql', 'utf8');

        // Execute the entire schema as one transaction
        console.log('📝 Executing schema...\n');
        await client.query(schemaSQL);

        console.log('✅ Schema imported successfully!\n');

        // Verify tables
        const result = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_type = 'BASE TABLE'
            ORDER BY table_name
        `);

        console.log('📊 Tables created:');
        result.rows.forEach(row => {
            console.log(`   ✓ ${row.table_name}`);
        });

        console.log(`\n✅ Total: ${result.rows.length} tables`);

    } catch (error) {
        console.error('❌ Error importing schema:', error.message);
        process.exit(1);
    } finally {
        await client.end();
    }
}

importSchema();
