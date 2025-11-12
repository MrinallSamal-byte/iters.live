/**
 * Database Migration Script - Security Enhancements
 * Run this to apply all new database changes
 */

const fs = require('fs').promises;
const path = require('path');
const db = require('./database/db');

async function runMigration() {
  console.log('🚀 Starting database migration for security enhancements...\n');

  try {
    // Read migration file
    const migrationPath = path.join(__dirname, 'database/migrations/security-enhancements.sql');
    const sql = await fs.readFile(migrationPath, 'utf8');

    // Split into individual statements
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    console.log(`📋 Found ${statements.length} SQL statements to execute\n`);

    let successCount = 0;
    let errorCount = 0;

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      
      // Skip comments and empty statements
      if (statement.startsWith('/*') || statement.startsWith('--') || statement.length < 10) {
        continue;
      }

      try {
        console.log(`⏳ Executing statement ${i + 1}/${statements.length}...`);
        await db.query(statement);
        successCount++;
        console.log(`✅ Success\n`);
      } catch (error) {
        errorCount++;
        
        // Check if error is due to table already existing
        if (error.message.includes('already exists') || 
            error.message.includes('Duplicate column name') ||
            error.message.includes('Duplicate key name')) {
          console.log(`⚠️  Warning: ${error.message.split('\n')[0]}\n`);
        } else {
          console.error(`❌ Error: ${error.message}\n`);
          
          // Show the problematic statement (first 100 chars)
          const preview = statement.substring(0, 100) + '...';
          console.error(`   Statement: ${preview}\n`);
        }
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 Migration Summary:');
    console.log('='.repeat(60));
    console.log(`✅ Successful: ${successCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log(`📝 Total: ${statements.length}`);
    console.log('='.repeat(60) + '\n');

    // Verify new tables
    console.log('🔍 Verifying new tables...\n');
    
    const newTables = [
      'audit_logs',
      'account_lockouts',
      'password_reset_tokens',
      'notifications',
      'user_preferences',
      'user_sessions',
      'api_keys',
      'system_settings',
      'file_shares',
      'tags',
      'file_tags',
      'user_favorites',
      'study_groups',
      'study_group_members',
      'chat_messages'
    ];

    let verifiedCount = 0;
    
    for (const table of newTables) {
      try {
        const [rows] = await db.query(`SHOW TABLES LIKE '${table}'`);
        if (rows.length > 0) {
          console.log(`✅ Table '${table}' exists`);
          verifiedCount++;
        } else {
          console.log(`❌ Table '${table}' NOT found`);
        }
      } catch (error) {
        console.log(`❌ Table '${table}' verification failed: ${error.message}`);
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log(`✅ Verified ${verifiedCount}/${newTables.length} tables`);
    console.log('='.repeat(60) + '\n');

    if (verifiedCount === newTables.length) {
      console.log('🎉 Migration completed successfully!\n');
      console.log('Next steps:');
      console.log('1. Update your .env file with new configuration');
      console.log('2. Install new npm packages: npm install');
      console.log('3. Restart your server: npm run dev');
      console.log('4. Test notifications: Visit /api/notifications');
      console.log('5. Test search: Visit /api/search?q=test\n');
    } else {
      console.log('⚠️  Migration completed with warnings. Some tables may already exist.\n');
    }

    // Check for new columns in existing tables
    console.log('🔍 Checking for new columns in users table...\n');
    
    try {
      const [columns] = await db.query(`SHOW COLUMNS FROM users`);
      const columnNames = columns.map(c => c.Field);
      
      const newColumns = [
        'failed_login_attempts',
        'account_locked_until',
        'two_factor_enabled',
        'two_factor_secret'
      ];

      for (const col of newColumns) {
        if (columnNames.includes(col)) {
          console.log(`✅ Column 'users.${col}' exists`);
        } else {
          console.log(`⚠️  Column 'users.${col}' NOT found (may not be critical)`);
        }
      }
    } catch (error) {
      console.log(`⚠️  Could not verify user columns: ${error.message}`);
    }

    console.log('\n✨ Migration process complete!\n');
    process.exit(0);

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
runMigration();
