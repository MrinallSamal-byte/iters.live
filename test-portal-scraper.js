/**
 * Test script for Portal Scraper Service
 * Tests the Node.js/Puppeteer scraper implementation
 */

const axios = require('axios');

const SCRAPER_URL = process.env.SCRAPER_SERVICE_URL || 'http://localhost:5001';
// Test credentials - use environment variables for real credentials
const TEST_REG_NUMBER = process.env.TEST_REG_NUMBER || 'DEMO_USER';
const TEST_PASSWORD = process.env.TEST_PASSWORD || 'demo_password';

console.log('========================================');
console.log('Portal Scraper Service Test');
console.log('========================================\n');

/**
 * Test health endpoint
 */
async function testHealth() {
    console.log('1. Testing health endpoint...');
    try {
        const response = await axios.get(`${SCRAPER_URL}/health`, {
            timeout: 5000
        });
        
        if (response.status === 200) {
            console.log('✅ Health check passed');
            console.log('   Service:', response.data.service);
            console.log('   Version:', response.data.version);
            console.log('   Status:', response.data.status);
            return true;
        } else {
            console.log('❌ Health check failed');
            return false;
        }
    } catch (error) {
        console.log('❌ Health check failed:', error.message);
        console.log('   Make sure the scraper service is running: npm run start:scraper');
        return false;
    }
}

/**
 * Test CAPTCHA solving capability
 */
async function testCaptcha() {
    console.log('\n2. Testing CAPTCHA solving capability...');
    try {
        const response = await axios.post(
            `${SCRAPER_URL}/api/test-captcha`,
            {},
            { timeout: 10000 }
        );
        
        if (response.status === 200) {
            console.log('✅ CAPTCHA test endpoint working');
            console.log('   Google Vision API Configured:', response.data.api_key_configured);
            console.log('   Google Vision API Key Length:', response.data.api_key_length);
            
            // Use response data for Gemini configuration if available
            const geminiConfigured = response.data.gemini_api_configured || 
                (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 0);
            console.log('   Gemini AI API Configured:', geminiConfigured ? 'Yes' : 'No');
            
            // Show available methods if returned by the endpoint
            if (response.data.available_methods && response.data.available_methods.length > 0) {
                console.log('   Available Methods:', response.data.available_methods.join(', '));
            }
            
            if (!response.data.api_key_configured && !geminiConfigured) {
                console.log('   ⚠️  Warning: Neither Google Vision nor Gemini API key configured');
                console.log('   Set GOOGLE_VISION_API_KEY and/or GEMINI_API_KEY for better CAPTCHA accuracy');
                console.log('   The scraper will fall back to Tesseract.js (local OCR)');
            } else if (geminiConfigured) {
                console.log('   ✅ Gemini AI Vision available for advanced CAPTCHA solving');
            }
            return true;
        } else {
            console.log('❌ CAPTCHA test failed');
            return false;
        }
    } catch (error) {
        console.log('❌ CAPTCHA test failed:', error.message);
        return false;
    }
}

/**
 * Test portal scraping (will fail without valid credentials)
 */
async function testScrape() {
    console.log('\n3. Testing portal scraping...');
    console.log('   Note: This will likely fail without valid credentials');
    console.log(`   Using registration number: ${TEST_REG_NUMBER}`);
    
    try {
        const response = await axios.post(
            `${SCRAPER_URL}/api/scrape`,
            {
                reg_number: TEST_REG_NUMBER,
                password: TEST_PASSWORD
            },
            { 
                timeout: 120000,
                validateStatus: () => true // Don't throw on any status
            }
        );
        
        console.log('   Status Code:', response.status);
        console.log('   Response Status:', response.data.status);
        console.log('   Message:', response.data.message || 'Success');
        
        if (response.data.status === 'SUCCESS') {
            console.log('✅ Scraping successful!');
            console.log('   Data keys:', Object.keys(response.data.data || {}));
            return true;
        } else if (response.data.status === 'AUTH_FAILED') {
            console.log('ℹ️  Auth failed (expected with test credentials)');
            console.log('   To test with real credentials, set:');
            console.log('   TEST_REG_NUMBER=your_reg_number TEST_PASSWORD=your_password node test-portal-scraper.js');
            return true; // Expected failure
        } else if (response.data.status === 'PORTAL_UNREACHABLE') {
            console.log('⚠️  Portal is unreachable');
            return true; // Not a scraper error
        } else {
            console.log('❌ Scraping error:', response.data.message);
            return false;
        }
    } catch (error) {
        console.log('❌ Scraping request failed:', error.message);
        
        if (error.code === 'ECONNREFUSED') {
            console.log('   Make sure the scraper service is running: npm run start:scraper');
        }
        
        return false;
    }
}

/**
 * Run all tests
 */
async function runTests() {
    console.log('Starting tests...\n');
    
    const healthPassed = await testHealth();
    
    if (!healthPassed) {
        console.log('\n❌ Health check failed. Cannot continue tests.');
        console.log('\nTo start the scraper service, run:');
        console.log('   npm run start:scraper');
        process.exit(1);
    }
    
    const captchaPassed = await testCaptcha();
    const scrapePassed = await testScrape();
    
    console.log('\n========================================');
    console.log('Test Summary');
    console.log('========================================');
    console.log('Health Check:', healthPassed ? '✅ PASS' : '❌ FAIL');
    console.log('CAPTCHA Test:', captchaPassed ? '✅ PASS' : '❌ FAIL');
    console.log('Scrape Test:', scrapePassed ? '✅ PASS' : '❌ FAIL');
    console.log('========================================\n');
    
    if (healthPassed && captchaPassed) {
        console.log('✅ All basic tests passed!');
        console.log('\nThe scraper service is working correctly.');
        console.log('\nTo test with real credentials:');
        console.log('TEST_REG_NUMBER=your_reg TEST_PASSWORD=your_pass node test-portal-scraper.js');
        process.exit(0);
    } else {
        console.log('❌ Some tests failed. Please review the output above.');
        process.exit(1);
    }
}

// Run tests
runTests().catch(error => {
    console.error('\n❌ Test execution error:', error);
    process.exit(1);
});
