const axios = require('axios');

async function checkVercelEnv() {
  console.log('\n🔍 Checking Vercel Environment...\n');
  
  try {
    // Test the health endpoint to see what it reveals
    const healthResponse = await axios.get('https://iter-college-management.vercel.app/api/health', {
      timeout: 10000
    });
    
    console.log('API Health Response:');
    console.log(JSON.stringify(healthResponse.data, null, 2));
    
  } catch (error) {
    console.log('Health check error:', error.message);
    if (error.response) {
      console.log('Response:', error.response.data);
    }
  }
  
  console.log('\n');
  
  // Try to get more diagnostic info
  try {
    const diagResponse = await axios.get('https://iter-college-management.vercel.app/api/debug-db', {
      timeout: 10000
    });
    
    console.log('Debug DB Response:');
    console.log(JSON.stringify(diagResponse.data, null, 2));
    
  } catch (error) {
    console.log('Debug endpoint not available (expected)');
  }
}

checkVercelEnv();
