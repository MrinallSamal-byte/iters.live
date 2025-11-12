// Migrate assignments and events only
const mysql = require('mysql2/promise');
const { Client } = require('pg');
require('dotenv').config();

async function migrateAssignmentsEvents() {
  const mysqlConn = await mysql.createConnection({
    host: 'shortline.proxy.rlwy.net',
    port: 26910,
    user: 'root',
    password: 'NlEpRBhwEHsSHrDWEEfahDOMcEzfIdLh',
    database: 'railway'
  });

  const pgClient = new Client({
    host: process.env.DB_HOST,
    port: 5432,
    user: 'postgres',
    password: process.env.DB_PASSWORD,
    database: 'postgres',
    ssl: { rejectUnauthorized: false }
  });

  await pgClient.connect();
  console.log('✅ Connected\n');

  // Migrate assignments
  const [assignments] = await mysqlConn.query('SELECT * FROM assignments');
  console.log(`📋 Migrating ${assignments.length} assignments...`);
  
  for (const row of assignments) {
    await pgClient.query(
      `INSERT INTO assignments (id, title, description, subject, department, year, total_marks, deadline, created_by, attachment_id, is_active, created_at, updated_at) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [row.id, row.title, row.description, row.subject, row.department, row.year, row.total_marks, row.deadline, row.created_by, row.attachment_id, row.is_active, row.created_at, row.updated_at]
    );
  }
  console.log('✅ Assignments migrated\n');

  // Migrate events
  const [events] = await mysqlConn.query('SELECT * FROM events');
  console.log(`📋 Migrating ${events.length} events...`);
  
  for (const row of events) {
    await pgClient.query(
      `INSERT INTO events (id, title, description, event_date, event_time, location, category, max_participants, registration_deadline, image_url, created_by, is_active, created_at, updated_at) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      [row.id, row.title, row.description, row.event_date, row.event_time, row.location, row.category, row.max_participants, row.registration_deadline, row.image_url, row.created_by, row.is_active, row.created_at, row.updated_at]
    );
  }
  console.log('✅ Events migrated\n');

  await mysqlConn.end();
  await pgClient.end();
  
  console.log('✅ Migration complete!');
}

migrateAssignmentsEvents();
