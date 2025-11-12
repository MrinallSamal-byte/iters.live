// Test direct connection to Railway from a simple Node.js script
const mysql = require('mysql2/promise');

async function testConnection() {
  console.log('\n🔍 Testing Railway MySQL Connection\n');
  
  const configs = [
    {
      name: 'Hostname + Port',
      config: {
        host: 'shortline.proxy.rlwy.net',
        port: 26910,
        user: 'root',
        password: 'NlEpRBhwEHsSHrDWEEfahDOMcEzfIdLh',
        database: 'railway',
        connectTimeout: 10000
      }
    },
    {
      name: 'IP + Port',
      config: {
        host: '66.33.22.244',
        port: 26910,
        user: 'root',
        password: 'NlEpRBhwEHsSHrDWEEfahDOMcEzfIdLh',
        database: 'railway',
        connectTimeout: 10000
      }
    },
    {
      name: 'Hostname + Standard Port',
      config: {
        host: 'shortline.proxy.rlwy.net',
        port: 3306,
        user: 'root',
        password: 'NlEpRBhwEHsSHrDWEEfahDOMcEzfIdLh',
        database: 'railway',
        connectTimeout: 10000
      }
    }
  ];

  for (const test of configs) {
    console.log(`\nTesting: ${test.name}`);
    console.log(`Host: ${test.config.host}:${test.config.port}`);
    
    try {
      const connection = await mysql.createConnection(test.config);
      console.log('✅ Connection successful!');
      
      const [rows] = await connection.execute('SELECT COUNT(*) as count FROM users');
      console.log(`✅ Query successful! Found ${rows[0].count} users`);
      
      await connection.end();
      
      console.log(`\n✅ ${test.name} WORKS!`);
      console.log(`\nUse these settings in Vercel:`);
      console.log(`DB_HOST=${test.config.host}`);
      console.log(`DB_PORT=${test.config.port}`);
      return;
      
    } catch (error) {
      console.log(`❌ Failed: ${error.message}`);
      console.log(`Error code: ${error.code || 'N/A'}`);
    }
  }
  
  console.log('\n❌ All connection methods failed.');
  console.log('\n💡 This means Railway proxy may not be accessible from external networks.');
  console.log('   Consider using Vercel Postgres or another database provider.');
}

testConnection();
