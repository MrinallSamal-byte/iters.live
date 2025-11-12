// Fix Supabase schema - recreate attendance and marks tables with correct structure
const { Client } = require('pg');
require('dotenv').config();

async function fixSchema() {
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

    // Drop old tables
    console.log('🗑️  Dropping old tables...');
    await client.query('DROP TABLE IF EXISTS attendance CASCADE');
    await client.query('DROP TABLE IF EXISTS marks CASCADE');
    console.log('✅ Dropped old tables\n');

    // Create attendance table with correct structure
    console.log('📋 Creating attendance table...');
    await client.query(`
      CREATE TABLE attendance (
        id SERIAL PRIMARY KEY,
        student_id INTEGER NOT NULL,
        subject VARCHAR(100) NOT NULL,
        date DATE NOT NULL,
        status VARCHAR(10) CHECK (status IN ('present', 'absent', 'late')) NOT NULL,
        marked_by INTEGER NOT NULL,
        remarks TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (marked_by) REFERENCES users(id) ON DELETE SET NULL
      )
    `);
    console.log('✅ Created attendance table\n');

    // Create marks table with correct structure
    console.log('📋 Creating marks table...');
    await client.query(`
      CREATE TABLE marks (
        id SERIAL PRIMARY KEY,
        student_id INTEGER NOT NULL,
        subject VARCHAR(100) NOT NULL,
        exam_type VARCHAR(50) CHECK (exam_type IN ('internal', 'external', 'assignment', 'quiz')) NOT NULL,
        marks_obtained DECIMAL(5,2) NOT NULL,
        total_marks DECIMAL(5,2) NOT NULL,
        exam_date DATE NOT NULL,
        uploaded_by INTEGER NOT NULL,
        remarks TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    console.log('✅ Created marks table\n');

    // Create indexes
    console.log('📋 Creating indexes...');
    await client.query('CREATE INDEX idx_attendance_student ON attendance(student_id)');
    await client.query('CREATE INDEX idx_attendance_date ON attendance(date)');
    await client.query('CREATE INDEX idx_attendance_subject ON attendance(subject)');
    await client.query('CREATE INDEX idx_marks_student ON marks(student_id)');
    await client.query('CREATE INDEX idx_marks_subject ON marks(subject)');
    await client.query('CREATE INDEX idx_marks_exam_type ON marks(exam_type)');
    console.log('✅ Created indexes\n');

    console.log('✅ Schema fixed successfully!');
    console.log('\n📝 Ready to migrate data. Run: node migrate-to-supabase.js');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

fixSchema();
