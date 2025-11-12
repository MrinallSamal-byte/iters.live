// Quick Demo Account Check
require('dotenv').config();
const { Client } = require('pg');

(async () => {
    const client = new Client({
        connectionString: process.env.POSTGRES_URL,
        ssl: { rejectUnauthorized: false }
    });

    await client.connect();
    
    const result = await client.query(`
        SELECT registration_number, name, email, role 
        FROM users 
        WHERE registration_number IN ('ADM2025001', 'TCH2025001', 'STU2025001') 
        ORDER BY registration_number
    `);

    console.log('\n✅ Demo Accounts in Render:');
    result.rows.forEach(user => {
        console.log(`   • ${user.registration_number} - ${user.name} (${user.role})`);
    });
    console.log('');

    await client.end();
})();
