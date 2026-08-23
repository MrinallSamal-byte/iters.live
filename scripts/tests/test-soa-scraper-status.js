/**
 * Diagnostic: check the SOA portal service status endpoint.
 *
 * Usage:
 *   node scripts/tests/test-soa-scraper-status.js
 *
 * Environment:
 *   BASE_URL - base URL of the API server (default: http://localhost:5000)
 *
 * Exits 0 when the status endpoint reports a healthy service, 1 otherwise.
 */

const http = require('http');
const https = require('https');

const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';
const STATUS_URL = `${BASE_URL.replace(/\/+$/, '')}/api/soa/status`;
const TIMEOUT_MS = parseInt(process.env.SOA_STATUS_TIMEOUT_MS, 10) || 15000;

function requestStatus(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https:') ? https : http;
    const req = client.get(url, { timeout: TIMEOUT_MS }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        resolve({ statusCode: res.statusCode, body });
      });
    });

    req.on('timeout', () => {
      req.destroy(new Error(`Request timed out after ${TIMEOUT_MS}ms`));
    });
    req.on('error', reject);
  });
}

async function main() {
  console.log(`Checking SOA scraper status at: ${STATUS_URL}\n`);

  let response;
  try {
    response = await requestStatus(STATUS_URL);
  } catch (error) {
    console.error('[FAIL] Could not reach the status endpoint.');
    console.error(`       ${error.message}`);
    console.error('\nHint: is the server running? Start it with `npm start` (or set BASE_URL).');
    process.exit(1);
  }

  let parsed;
  try {
    parsed = JSON.parse(response.body);
  } catch (_) {
    console.error(`[FAIL] Endpoint returned non-JSON response (HTTP ${response.statusCode}).`);
    console.error(`Body: ${response.body.slice(0, 500)}`);
    process.exit(1);
  }

  console.log(`HTTP status: ${response.statusCode}`);
  console.log('Response:');
  console.log(JSON.stringify(parsed, null, 2));

  const healthy = response.statusCode >= 200 && response.statusCode < 300 &&
    parsed && parsed.success !== false;

  if (healthy) {
    console.log('\n[PASS] SOA scraper status endpoint responded successfully.');
    process.exit(0);
  }

  console.error('\n[FAIL] SOA scraper status endpoint reported an unhealthy state.');
  process.exit(1);
}

main();
