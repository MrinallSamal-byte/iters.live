// Test Render PostgreSQL Connection
require('dotenv').config();
const { Client } = require('pg');

async function testConnection() {
    const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;
    
    console.log('Testing Render PostgreSQL connection...\n');
    console.log('Host:', process.env.DB_HOST);
    console.log('Database:', process.env.DB_NAME);
    console.log('User:', process.env.DB_USER);
    console.log('');

    const client = new Client({
        connectionString: connectionString,
        ssl: {
            rejectUnauthorized: false
        }
    });

    try {
        await client.connect();
        console.log('✅ Connected to Render PostgreSQL!\n');

        const result = await client.query('SELECT version()');
        console.log('PostgreSQL version:', result.rows[0].version);
        console.log('\n✅ Connection test successful!');

    } catch (error) {
        console.error('❌ Connection failed:', error.message);
        console.error('\nFull error:', error);
        process.exit(1);
    } finally {
        await client.end();
    }
}

testConnection();
