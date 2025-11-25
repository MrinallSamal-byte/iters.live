require('dotenv').config();
const { spawn } = require('child_process');
const path = require('path');

function runNodeScript(scriptPath) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath], { stdio: 'inherit' });
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${scriptPath} exited with code ${code}`));
    });
    child.on('error', reject);
  });
}

(async () => {
  try {
    console.log('🚀 Starting server (Firebase Mode)...');
    // Skip SQL seeding checks as we are using Firestore now
    await runNodeScript(path.join(__dirname, '../index.js'));
  } catch (err) {
    console.error('❌ Server failed:', err.message);
    process.exit(1);
  }
})();

