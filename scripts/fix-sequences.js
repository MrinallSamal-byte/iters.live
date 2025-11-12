require('dotenv').config();
const { query } = require('../server/database/db');

async function fixSequences() {
  console.log('🔧 Fixing PostgreSQL sequences...');
  
  try {
    // Fix users table sequence
    console.log('Fixing users_id_seq...');
    await query(`SELECT setval('users_id_seq', (SELECT MAX(id) FROM users) + 1)`);
    console.log('✓ Users sequence fixed');
    
    // Fix other tables that might have the same issue
    const tables = [
      'attendance',
      'marks',
      'assignments',
      'assignment_submissions',
      'events',
      'event_registrations',
      'timetable',
      'admit_cards',
      'files',
      'hostel_menu',
      'fees',
      'clubs',
      'achievements',
      'announcements',
      'activity_log',
      'system_settings',
      'refresh_tokens'
    ];
    
    for (const table of tables) {
      try {
        await query(`SELECT setval('${table}_id_seq', (SELECT COALESCE(MAX(id), 1) FROM ${table}))`);
        console.log(`✓ ${table} sequence fixed`);
      } catch (err) {
        console.log(`⚠ ${table} sequence skip (${err.message})`);
      }
    }
    
    console.log('\n✅ All sequences fixed!');
    console.log('\nYou can now register new users without conflicts.');
    
    process.exit(0);
  } catch (err) {
    console.error('❌ Error fixing sequences:', err);
    process.exit(1);
  }
}

fixSequences();
