// Fix assignments and events tables structure
const { Client } = require('pg');
require('dotenv').config();

async function fixTables() {
  const client = new Client({
    host: process.env.DB_HOST,
    port: 5432,
    user: 'postgres',
    password: process.env.DB_PASSWORD,
    database: 'postgres',
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Connected to Supabase\n');

    // Fix assignments table
    console.log('📋 Fixing assignments table...');
    await client.query('DROP TABLE IF EXISTS assignments CASCADE');
    await client.query(`
      CREATE TABLE assignments (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        subject VARCHAR(100) NOT NULL,
        department VARCHAR(100) NOT NULL,
        year INTEGER NOT NULL,
        total_marks DECIMAL(5,2) NOT NULL,
        deadline TIMESTAMP NOT NULL,
        created_by INTEGER NOT NULL,
        attachment_id INTEGER,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    console.log('✅ Fixed assignments table\n');

    // Fix events table
    console.log('📋 Fixing events table...');
    await client.query('DROP TABLE IF EXISTS events CASCADE');
    await client.query(`
      CREATE TABLE events (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        event_date DATE NOT NULL,
        event_time TIME NOT NULL,
        location VARCHAR(255) NOT NULL,
        category VARCHAR(100) NOT NULL,
        max_participants INTEGER,
        registration_deadline DATE,
        image_url VARCHAR(500),
        created_by INTEGER NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    console.log('✅ Fixed events table\n');

    // Create indexes
    console.log('📋 Creating indexes...');
    await client.query('CREATE INDEX idx_assignments_subject ON assignments(subject)');
    await client.query('CREATE INDEX idx_assignments_department ON assignments(department)');
    await client.query('CREATE INDEX idx_assignments_deadline ON assignments(deadline)');
    await client.query('CREATE INDEX idx_assignments_created_by ON assignments(created_by)');
    await client.query('CREATE INDEX idx_events_date ON events(event_date)');
    await client.query('CREATE INDEX idx_events_category ON events(category)');
    await client.query('CREATE INDEX idx_events_created_by ON events(created_by)');
    console.log('✅ Created indexes\n');

    console.log('✅ Tables fixed successfully!');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

fixTables();
