/**
 * Database Performance Optimization Migration Script
 * Runs the performance-optimization.sql migration
 */

const fs = require('fs').promises;
const path = require('path');
const db = require('../database/db');

const MIGRATION_FILE = path.join(__dirname, '../database/migrations/performance-optimization.sql');

async function runMigration() {
  console.log('🚀 Starting performance optimization migration...\n');

  try {
    // Read SQL file
    const sql = await fs.readFile(MIGRATION_FILE, 'utf8');
    
    // Split into individual statements
    const statements = sql
      .split('$$')
      .map(s => s.split(';'))
      .flat()
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--') && s !== 'DELIMITER');

    let successCount = 0;
    let warningCount = 0;
    let errorCount = 0;

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      
      if (statement.startsWith('DROP') || statement.startsWith('CREATE') || 
          statement.startsWith('INSERT') || statement.startsWith('ALTER')) {
        try {
          await db.query(statement);
          successCount++;
          
          // Extract object name for logging
          const match = statement.match(/(TABLE|INDEX|PROCEDURE|EVENT)\s+(?:IF\s+(?:NOT\s+)?EXISTS\s+)?(\w+)/i);
          if (match) {
            console.log(`✓ ${match[1]} ${match[2]} processed`);
          }
        } catch (error) {
          if (error.message.includes('already exists') || 
              error.message.includes('Duplicate key')) {
            warningCount++;
            console.log(`⚠ Warning: ${error.message.substring(0, 80)}...`);
          } else {
            errorCount++;
            console.error(`✗ Error: ${error.message.substring(0, 100)}`);
          }
        }
      }
    }

    console.log('\n📊 Migration Summary:');
    console.log(`   ✓ Success: ${successCount}`);
    console.log(`   ⚠ Warnings: ${warningCount}`);
    console.log(`   ✗ Errors: ${errorCount}`);

    // Verify indexes were created
    const indexes = await db.query(`
      SELECT TABLE_NAME, INDEX_NAME, COLUMN_NAME
      FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = ? AND INDEX_NAME LIKE 'idx_%'
      ORDER BY TABLE_NAME, INDEX_NAME
    `, [process.env.DB_NAME || 'iter_college_db']);

    console.log(`\n📈 Total Indexes Created: ${indexes.length}`);

    // Verify materialized views were created
    const views = await db.query(`
      SELECT TABLE_NAME
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME LIKE 'view_%'
    `, [process.env.DB_NAME || 'iter_college_db']);

    console.log(`📊 Materialized Views Created: ${views.length}`);
    views.forEach(v => console.log(`   - ${v.TABLE_NAME}`));

    // Verify stored procedure
    const procedures = await db.query(`
      SELECT ROUTINE_NAME
      FROM information_schema.ROUTINES
      WHERE ROUTINE_SCHEMA = ? AND ROUTINE_NAME = 'sp_refresh_all_views'
    `, [process.env.DB_NAME || 'iter_college_db']);

    if (procedures.length > 0) {
      console.log('\n✓ Stored procedure sp_refresh_all_views created successfully');
    }

    // Test view refresh
    console.log('\n🔄 Testing view refresh...');
    await db.query('CALL sp_refresh_all_views()');
    console.log('✓ View refresh successful');

    // Get view statistics
    console.log('\n📊 View Statistics:');
    const attendanceSummary = await db.query('SELECT COUNT(*) as count FROM view_student_attendance_summary');
    console.log(`   - Student Attendance Summary: ${attendanceSummary[0].count} records`);

    const subjectAttendance = await db.query('SELECT COUNT(*) as count FROM view_student_subject_attendance');
    console.log(`   - Subject-wise Attendance: ${subjectAttendance[0].count} records`);

    const performance = await db.query('SELECT COUNT(*) as count FROM view_student_performance');
    console.log(`   - Student Performance: ${performance[0].count} records`);

    const deptStats = await db.query('SELECT COUNT(*) as count FROM view_department_stats');
    console.log(`   - Department Statistics: ${deptStats[0].count} records`);

    console.log('\n✅ Performance optimization migration completed successfully!');
    console.log('\n💡 Next Steps:');
    console.log('   1. Enable MySQL event scheduler: SET GLOBAL event_scheduler = ON;');
    console.log('   2. Views will auto-refresh every hour');
    console.log('   3. Monitor slow queries in logs/slow-queries.log');
    console.log('   4. Check pool stats via /api/health endpoint');

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

// Run migration
runMigration();
