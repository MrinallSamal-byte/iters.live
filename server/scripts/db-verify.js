const mysql = require('mysql2/promise');
require('dotenv').config();

const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = Number(process.env.DB_PORT || 3306);
const DB_USER = process.env.DB_USER || 'root';
const DB_PASSWORD = process.env.DB_PASSWORD || '';
const DB_NAME = process.env.DB_NAME || 'iter_college_db';

async function main() {
  const conn = await mysql.createConnection({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
  });

  console.log(`Connected: ${DB_USER}@${DB_HOST}:${DB_PORT}/${DB_NAME}`);

  const [tables] = await conn.query(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = ? ORDER BY table_name`,
    [DB_NAME]
  );
  console.log(`\nTables (${tables.length}):`);
  console.log(tables.map(t => t.TABLE_NAME || t.table_name).join(', '));

  // Quick row counts for key tables (ignore errors if table missing)
  const keyTables = ['users','files','attendance','marks','assignments','events','announcements','notes'];
  for (const t of keyTables) {
    try {
      const [rows] = await conn.query(`SELECT COUNT(*) AS c FROM \`${t}\``);
      console.log(`Count ${t}: ${rows[0].c}`);
    } catch (e) {
      console.log(`Count ${t}: (not found)`);
    }
  }

  await conn.end();
}

main().catch(err => { console.error(err); process.exit(1); });
