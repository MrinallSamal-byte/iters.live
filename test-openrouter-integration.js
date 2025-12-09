/**
 * Test script for OpenRouter API integration
 * Tests both CAPTCHA solving and chatbot features
 */

require('dotenv').config();
const openRouterService = require('./server/services/openrouter.service');

async function testChatbot() {
    console.log('\n=== Testing Chatbot Feature ===');
    
    if (!openRouterService.isAvailable()) {
        console.log('⚠️  OpenRouter API key not configured');
        console.log('Please set OPENROUTER_API_KEY in your .env file');
        return false;
    }
    
    try {
        console.log('Testing with a simple question...');
        const answer = await openRouterService.answerQuestion(
            'What is 2 + 2?',
            '',
            'You are a helpful assistant. Answer briefly.'
        );
        
        console.log('✅ Chatbot Response:', answer);
        return true;
    } catch (error) {
        console.error('❌ Chatbot test failed:', error.message);
        return false;
    }
}

async function testStudyPlan() {
    console.log('\n=== Testing Study Plan Generation ===');
    
    if (!openRouterService.isAvailable()) {
        console.log('⚠️  OpenRouter API key not configured');
        return false;
    }
    
    try {
        console.log('Generating a sample study plan...');
        const studentData = {
            subjects: ['Mathematics', 'Physics'],
            attendance: [
                { subject: 'Mathematics', percentage: 85 },
                { subject: 'Physics', percentage: 78 }
            ],
            marks: [
                { subject: 'Mathematics', percentage: 75 },
                { subject: 'Physics', percentage: 65 }
            ],
            preferences: {
                studyHours: 4,
                preferredTime: 'morning'
            }
        };
        
        const studyPlan = await openRouterService.generateStudyPlan(studentData);
        console.log('✅ Study Plan Generated Successfully');
        console.log('Overview:', studyPlan.overallStrategy?.substring(0, 100) + '...');
        return true;
    } catch (error) {
        console.error('❌ Study plan test failed:', error.message);
        return false;
    }
}

async function testCaptchaSolving() {
    console.log('\n=== Testing CAPTCHA Solving Feature ===');
    console.log('Note: This requires an actual CAPTCHA image to test properly');
    console.log('For now, we\'ll just verify the service is configured');
    
    if (!openRouterService.isAvailable()) {
        console.log('⚠️  OpenRouter API key not configured');
        return false;
    }
    
    console.log('✅ OpenRouter service is configured for CAPTCHA solving');
    console.log('Available models:', openRouterService.models.captcha.join(', '));
    return true;
}

async function runTests() {
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║          OpenRouter API Integration Test Suite                ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');
    
    const results = {
        chatbot: false,
        studyPlan: false,
        captcha: false
    };
    
    // Test chatbot
    results.chatbot = await testChatbot();
    
    // Test study plan generation
    results.studyPlan = await testStudyPlan();
    
    // Test CAPTCHA configuration
    results.captcha = await testCaptchaSolving();
    
    // Summary
    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║                         Test Results                           ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');
    console.log(`Chatbot:    ${results.chatbot ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`Study Plan: ${results.studyPlan ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`CAPTCHA:    ${results.captcha ? '✅ CONFIGURED' : '⚠️  NOT CONFIGURED'}`);
    
    const allPassed = results.chatbot && results.studyPlan && results.captcha;
    
    if (allPassed) {
        console.log('\n🎉 All tests passed! OpenRouter integration is working correctly.');
    } else {
        console.log('\n⚠️  Some tests failed. Please check the configuration and try again.');
        console.log('\nTroubleshooting:');
        console.log('1. Make sure OPENROUTER_API_KEY is set in .env file');
        console.log('2. Verify your API key is valid at https://openrouter.ai/keys');
        console.log('3. Check your internet connection');
        console.log('4. Review the error messages above');
    }
    
    console.log('\n');
}

// Run tests
runTests().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
