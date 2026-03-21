#!/usr/bin/env node

/**
 * Test script for /api/ai/chat endpoint
 * Tests the endpoint with and without authentication
 */

const http = require('http');

// Test configuration
const TEST_PORT = process.env.PORT || 5000;
const TEST_HOST = 'localhost';

// Color output
const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    reset: '\x1b[0m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

/**
 * Make HTTP request to test endpoint
 */
function makeRequest(path, method, data, headers = {}) {
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify(data);
        
        const options = {
            hostname: TEST_HOST,
            port: TEST_PORT,
            path: path,
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData),
                ...headers
            }
        };

        const req = http.request(options, (res) => {
            let responseData = '';

            res.on('data', (chunk) => {
                responseData += chunk;
            });

            res.on('end', () => {
                try {
                    resolve({
                        statusCode: res.statusCode,
                        headers: res.headers,
                        body: JSON.parse(responseData)
                    });
                } catch (e) {
                    resolve({
                        statusCode: res.statusCode,
                        headers: res.headers,
                        body: responseData
                    });
                }
            });
        });

        req.on('error', (e) => {
            reject(e);
        });

        req.write(postData);
        req.end();
    });
}

/**
 * Run all tests
 */
async function runTests() {
    log('\n🧪 Testing /api/ai/chat endpoint\n', 'blue');
    
    const tests = [
        {
            name: 'Test 1: Missing message field (should return 400)',
            request: {
                path: '/api/ai/chat',
                method: 'POST',
                data: { context: 'test' },
                headers: {}
            },
            expectedStatus: 400,
            validate: (response) => {
                return response.body.success === false && 
                       response.body.message === 'Message is required';
            }
        },
        {
            name: 'Test 2: Valid request without authentication (guest user)',
            request: {
                path: '/api/ai/chat',
                method: 'POST',
                data: { 
                    message: 'What is 2 + 2?',
                    context: 'Math question'
                },
                headers: {}
            },
            expectedStatus: [200, 503], // 200 if API key configured, 503 if not
            validate: (response) => {
                if (response.statusCode === 503) {
                    // Service unavailable - API key not configured
                    return response.body.success === false && 
                           response.body.message.includes('AI service is currently unavailable');
                } else if (response.statusCode === 200) {
                    // Success - API key configured
                    return response.body.success === true && 
                           response.body.response && 
                           response.body.timestamp;
                }
                return false;
            }
        },
        {
            name: 'Test 3: Valid request with backward compatibility (question field)',
            request: {
                path: '/api/ai/chat',
                method: 'POST',
                data: { 
                    question: 'What is the capital of France?',
                    context: 'Geography question'
                },
                headers: {}
            },
            expectedStatus: [200, 503],
            validate: (response) => {
                if (response.statusCode === 503) {
                    return response.body.success === false && 
                           response.body.message.includes('AI service is currently unavailable');
                } else if (response.statusCode === 200) {
                    return response.body.success === true && 
                           response.body.response && 
                           response.body.timestamp;
                }
                return false;
            }
        },
        {
            name: 'Test 4: Valid request with custom systemPrompt',
            request: {
                path: '/api/ai/chat',
                method: 'POST',
                data: { 
                    message: 'Explain photosynthesis',
                    context: 'Biology topic',
                    systemPrompt: 'You are a biology teacher. Explain in simple terms.'
                },
                headers: {}
            },
            expectedStatus: [200, 503],
            validate: (response) => {
                if (response.statusCode === 503) {
                    return response.body.success === false;
                } else if (response.statusCode === 200) {
                    return response.body.success === true && 
                           response.body.response && 
                           response.body.timestamp;
                }
                return false;
            }
        }
    ];

    let passed = 0;
    let failed = 0;

    for (const test of tests) {
        try {
            log(`\n${test.name}`, 'yellow');
            const response = await makeRequest(
                test.request.path,
                test.request.method,
                test.request.data,
                test.request.headers
            );

            const expectedStatuses = Array.isArray(test.expectedStatus) 
                ? test.expectedStatus 
                : [test.expectedStatus];

            const statusMatch = expectedStatuses.includes(response.statusCode);
            const validationPass = test.validate(response);

            if (statusMatch && validationPass) {
                log(`✅ PASSED`, 'green');
                log(`   Status: ${response.statusCode}`, 'green');
                log(`   Response: ${JSON.stringify(response.body).substring(0, 100)}...`, 'green');
                passed++;
            } else {
                log(`❌ FAILED`, 'red');
                log(`   Expected status: ${expectedStatuses.join(' or ')}`, 'red');
                log(`   Actual status: ${response.statusCode}`, 'red');
                log(`   Response: ${JSON.stringify(response.body)}`, 'red');
                log(`   Validation: ${validationPass ? 'PASS' : 'FAIL'}`, 'red');
                failed++;
            }
        } catch (error) {
            log(`❌ FAILED - ${error.message}`, 'red');
            failed++;
        }
    }

    log(`\n${'='.repeat(50)}`, 'blue');
    log(`\n📊 Test Summary:`, 'blue');
    log(`   Total: ${tests.length}`, 'blue');
    log(`   Passed: ${passed}`, 'green');
    log(`   Failed: ${failed}`, failed > 0 ? 'red' : 'green');
    log(`\n${'='.repeat(50)}\n`, 'blue');

    if (failed > 0) {
        log('⚠️  Some tests failed. Please check the endpoint implementation.', 'yellow');
        process.exit(1);
    } else {
        log('✅ All tests passed!', 'green');
        process.exit(0);
    }
}

// Check if server is running
log('🔍 Checking if server is running...', 'blue');
makeRequest('/health', 'GET', null)
    .then(() => {
        log('✅ Server is running\n', 'green');
        runTests().catch(console.error);
    })
    .catch((error) => {
        log(`❌ Server is not running on http://${TEST_HOST}:${TEST_PORT}`, 'red');
        log(`   Error: ${error.message}`, 'red');
        log('\n💡 Please start the server with: npm start', 'yellow');
        process.exit(1);
    });
