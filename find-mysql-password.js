const mysql = require('mysql2/promise');

async function tryPasswords() {
  const passwords = ['', 'root', 'password', 'admin', 'mysql', '123456', 'Root@123'];
  const host = 'localhost';
  const user = 'root';
  
  console.log('Attempting to connect with common passwords...\n');
  
  for (const password of passwords) {
    try {
      const connection = await mysql.createConnection({
        host,
        user,
        password
      });
      
      console.log(`\n✓ SUCCESS! Connected with password: "${password || '(empty)'}"\n`);
      console.log('Update your .env file with:');
      console.log(`DB_PASSWORD=${password}`);
      
      await connection.end();
      process.exit(0);
    } catch (error) {
      console.log(`✗ Failed with password: "${password || '(empty)'}"`);
    }
  }
  
  console.log('\n❌ None of the common passwords worked.');
  console.log('\nNext steps:');
  console.log('1. Check MySQL Workbench or phpMyAdmin for saved credentials');
  console.log('2. Or reset the MySQL root password');
  console.log('3. Or use MySQL Workbench to create a new user for this project');
  
  process.exit(1);
}

tryPasswords();
