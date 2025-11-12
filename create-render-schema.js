// Create Database Schema in Render PostgreSQL
require('dotenv').config();
const { Client } = require('pg');
const fs = require('fs');

async function createSchema() {
    console.log('📋 Creating database schema in Render PostgreSQL...\n');

    // Connect to Render database
    const client = new Client({
        connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
        ssl: {
            rejectUnauthorized: false // Render requires SSL
        }
    });

    try {
        await client.connect();
        console.log('✅ Connected to Render PostgreSQL\n');

        // Read schema file
        const schemaSQL = fs.readFileSync('supabase-schema.sql', 'utf8');

        console.log('📝 Applying schema in a single transaction...\n');
        await client.query('BEGIN');
        try {
            await client.query(schemaSQL);
            await client.query('COMMIT');
            console.log('✅ Schema applied successfully');
        } catch (err) {
            await client.query('ROLLBACK');
            console.error('❌ Schema apply failed:', err.message);
            process.exit(1);
        }

        // Verify tables created
        const tablesResult = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            ORDER BY table_name
        `);

        console.log('✅ Tables in database:');
        tablesResult.rows.forEach(row => {
            console.log(`   - ${row.table_name}`);
        });

    console.log('\n✅ Schema created successfully in Render PostgreSQL!');

    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    } finally {
        await client.end();
    }
}

createSchema();
