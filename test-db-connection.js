const mysql = require('mysql2/promise');
require('dotenv').config();

async function testConnection() {
  console.log('Testing database connection...');
  console.log('Configuration:');
  console.log('- Host:', process.env.DB_HOST || 'localhost');
  console.log('- Port:', process.env.DB_PORT || 3306);
  console.log('- User:', process.env.DB_USER || 'root');
  console.log('- Password:', process.env.DB_PASSWORD ? '***' : '(empty)');
  console.log('- Database:', process.env.DB_NAME || 'iter_college_db');
  
  try {
    // First, try to connect without specifying database
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || ''
    });
    
    console.log('\n✓ Successfully connected to MySQL server!');
    
    // Check if database exists
    const dbName = process.env.DB_NAME || 'iter_college_db';
    const [databases] = await connection.query(`SHOW DATABASES LIKE '${dbName}'`);
    
    if (databases.length === 0) {
      console.log(`\n⚠ Database '${dbName}' does not exist.`);
      console.log('Creating database...');
      
      await connection.query(`CREATE DATABASE ${dbName}`);
      console.log(`✓ Database '${dbName}' created successfully!`);
    } else {
      console.log(`\n✓ Database '${dbName}' already exists.`);
    }
    
    await connection.end();
    console.log('\n✓ Connection test completed successfully!');
    process.exit(0);
    
  } catch (error) {
    console.error('\n✗ Connection failed:', error.message);
    console.error('\nTroubleshooting tips:');
    console.error('1. Make sure MySQL service is running');
    console.error('2. Check if the DB_PASSWORD in .env matches your MySQL root password');
    console.error('3. Try setting a password: UPDATE mysql.user SET authentication_string=NULL WHERE User="root";');
    process.exit(1);
  }
}

testConnection();
