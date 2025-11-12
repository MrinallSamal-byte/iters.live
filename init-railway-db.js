require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const path = require('path');

async function initializeRailwayDatabase() {
  let connection;
  
  try {
    console.log('\n🚀 Initializing Railway MySQL Database...\n');
    
    const dbConfig = {
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      multipleStatements: true,
      connectTimeout: 30000
    };

    console.log('📡 Connecting to Railway MySQL...');
    console.log(`   Host: ${dbConfig.host}`);
    console.log(`   Port: ${dbConfig.port}`);
    console.log(`   Database: ${dbConfig.database}\n`);

    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Connected successfully!\n');

    // Drop all existing tables to start fresh
    console.log('🗑️  Cleaning up existing data...');
    const [tables] = await connection.query('SHOW TABLES');
    
    if (tables.length > 0) {
      console.log(`   Found ${tables.length} tables to drop`);
      await connection.query('SET FOREIGN_KEY_CHECKS = 0');
      for (const table of tables) {
        const tableName = Object.values(table)[0];
        await connection.query(`DROP TABLE IF EXISTS ${tableName}`);
        console.log(`   ✓ Dropped ${tableName}`);
      }
      await connection.query('SET FOREIGN_KEY_CHECKS = 1');
      console.log('✅ Cleanup complete\n');
    } else {
      console.log('   No existing tables to drop\n');
    }

    // Read and execute schema
    console.log('📋 Creating database schema...');
    const schemaPath = path.join(__dirname, 'server/database/init.sql');
    let schema = await fs.readFile(schemaPath, 'utf8');
    
    // Remove CREATE DATABASE and USE statements (Railway manages this)
    schema = schema.replace(/CREATE DATABASE IF NOT EXISTS.*?;/gi, '');
    schema = schema.replace(/USE .*?;/gi, '');
    
    // Execute schema in chunks to avoid timeout
    const statements = schema.split(';').filter(s => s.trim());
    let createdTables = 0;
    
    for (const statement of statements) {
      if (statement.trim()) {
        try {
          await connection.query(statement);
          if (statement.toUpperCase().includes('CREATE TABLE')) {
            createdTables++;
            const tableName = statement.match(/CREATE TABLE (?:IF NOT EXISTS )?`?(\w+)`?/i)?.[1];
            if (tableName) {
              console.log(`   ✓ Created table: ${tableName}`);
            }
          }
        } catch (err) {
          if (!err.message.includes('already exists')) {
            console.error(`   ✗ Error executing statement: ${err.message}`);
          }
        }
      }
    }
    
    console.log(`✅ Created ${createdTables} tables\n`);

    // Verify tables
    const [finalTables] = await connection.query('SHOW TABLES');
    console.log(`📊 Total tables in database: ${finalTables.length}\n`);

    await connection.end();

    console.log('╔════════════════════════════════════════════╗');
    console.log('║  ✅ Railway Database Initialized!         ║');
    console.log('╚════════════════════════════════════════════╝\n');
    
    console.log('📝 Next step: Run the seed script');
    console.log('   node server/seed/seed.js\n');

    return true;

  } catch (error) {
    console.error('\n❌ Initialization failed:', error.message);
    console.error(error.stack);
    if (connection) await connection.end();
    return false;
  }
}

initializeRailwayDatabase();
