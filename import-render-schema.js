// Import Schema to Render PostgreSQL (Better Parsing)
require('dotenv').config();
const { Client } = require('pg');
const fs = require('fs');

async function importSchema() {
    console.log('📋 Importing database schema to Render PostgreSQL...\n');

    const client = new Client({
        connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log('✅ Connected to Render PostgreSQL\n');

        // Read entire schema file
        const schemaSQL = fs.readFileSync('supabase-schema.sql', 'utf8');

        // Execute the entire file as one query
        // This preserves functions, triggers, and multi-line statements
        await client.query(schemaSQL);

        console.log('✅ Schema imported successfully!\n');

        // Verify tables created
        const tablesResult = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_type = 'BASE TABLE'
            ORDER BY table_name
        `);

        console.log('📊 Tables created:');
        tablesResult.rows.forEach((row, index) => {
            console.log(`   ${index + 1}. ${row.table_name}`);
        });

        console.log(`\n✅ Total: ${tablesResult.rows.length} tables created!`);

    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error('\nFull error:', error);
        process.exit(1);
    } finally {
        await client.end();
    }
}

importSchema();
