/**
 * Test script to verify AI Service initialization and functionality
 */
require('dotenv').config();

console.log('🧪 Testing AI Service Configuration...\n');

// Check environment variables
console.log('Environment Variables:');
console.log('- GEMINI_API_KEY:', process.env.GEMINI_API_KEY ? '✅ Set (' + process.env.GEMINI_API_KEY.substring(0, 6) + '...)' : '❌ Not set');
console.log('- GEMINI_MODEL:', process.env.GEMINI_MODEL || 'gemini-1.5-flash (default)');
console.log();

// Try to load the AI service
try {
    const aiService = require('./server/services/ai.service');
    console.log('✅ AI Service module loaded successfully');
    
    // Check if genAI is initialized
    if (aiService.genAI) {
        console.log('✅ Gemini AI client initialized');
    } else {
        console.log('❌ Gemini AI client NOT initialized - API key may be missing');
    }
    console.log();
    
    // Test a simple question
    console.log('Testing AI response with a simple question...');
    const RESPONSE_PREVIEW_LENGTH = 100;
    (async () => {
        try {
            const answer = await aiService.answerQuestion('What is 2+2?', '');
            console.log('Response:', answer.substring(0, RESPONSE_PREVIEW_LENGTH) + (answer.length > RESPONSE_PREVIEW_LENGTH ? '...' : ''));
            console.log();
            
            if (answer.includes("currently unable")) {
                console.log('⚠️ AI service returned fallback response - API may not be working');
            } else {
                console.log('✅ AI service is working and generating responses!');
            }
        } catch (error) {
            console.error('❌ Error testing AI response:', error.message);
        }
    })();
    
} catch (error) {
    console.error('❌ Error loading AI Service:', error.message);
    console.error('Stack:', error.stack);
}
