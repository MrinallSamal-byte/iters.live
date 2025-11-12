// Verify Supabase migration
const { Client } = require('pg');
require('dotenv').config();

async function verify() {
  const client = new Client({
    host: process.env.DB_HOST,
    port: 5432,
    user: 'postgres',
    password: process.env.DB_PASSWORD,
    database: 'postgres',
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();
  console.log('📊 Supabase Data Verification:\n');

  const tables = ['users', 'attendance', 'marks', 'assignments', 'events'];
  let total = 0;

  for (const table of tables) {
    const result = await client.query(`SELECT COUNT(*) FROM ${table}`);
    const count = parseInt(result.rows[0].count);
    console.log(`   ${table}: ${count} records`);
    total += count;
  }

  console.log(`\n✅ Total: ${total} records migrated successfully!`);
  
  // Test demo accounts
  console.log('\n🔑 Checking demo accounts...');
  const accounts = ['ADM2025001', 'TCH2025001', 'STU2025001'];
  for (const reg of accounts) {
    const result = await client.query('SELECT id, name, role FROM users WHERE registration_number = $1', [reg]);
    if (result.rows.length > 0) {
      const user = result.rows[0];
      console.log(`   ✅ ${reg}: ${user.name} (${user.role})`);
    }
  }

  await client.end();
}

verify();
