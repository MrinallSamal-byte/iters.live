#!/usr/bin/env node

/**
 * AI Service Verification Script
 * 
 * This script verifies that the AI service is properly configured
 * and can communicate with Google's Gemini API.
 * 
 * Usage: node verify-ai-service.js
 */

require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

console.log('╔════════════════════════════════════════════════════╗');
console.log('║     AI Service Configuration Verification         ║');
console.log('╚════════════════════════════════════════════════════╝');
console.log('');

// Check environment variables
const geminiKey = process.env.GEMINI_API_KEY;
const geminiModel = process.env.GEMINI_MODEL || 'gemini-1.5-flash';

console.log('📋 Configuration Check:');
console.log('─────────────────────────────────────────────────────');
console.log(`✓ GEMINI_API_KEY: ${geminiKey ? 'Set (' + geminiKey.substring(0, 15) + '...)' : '❌ NOT SET'}`);
console.log(`✓ GEMINI_MODEL: ${geminiModel}`);
console.log('');

if (!geminiKey) {
    console.error('❌ ERROR: GEMINI_API_KEY is not configured!');
    console.log('');
    console.log('📝 To fix this:');
    console.log('1. Copy .env.example to .env:');
    console.log('   cp .env.example .env');
    console.log('');
    console.log('2. Ensure GEMINI_API_KEY is set in .env:');
    console.log('   GEMINI_API_KEY=AIzaSyB5aszVVX1UQuv0MEJOt0QumbnSa4x5z5A');
    console.log('');
    console.log('See AI_SERVICE_SETUP.md for more details.');
    process.exit(1);
}

// Initialize AI Service
console.log('🔧 Initializing AI Service...');
console.log('─────────────────────────────────────────────────────');

try {
    const genAI = new GoogleGenerativeAI(geminiKey);
    const model = genAI.getGenerativeModel({ model: geminiModel });
    console.log('✅ GoogleGenerativeAI initialized successfully');
    console.log('✅ Model configured: ' + geminiModel);
    console.log('');

    // Test API connectivity
    console.log('🌐 Testing API Connectivity...');
    console.log('─────────────────────────────────────────────────────');
    console.log('Sending test query to Google Gemini API...');
    
    model.generateContent('Say "Hello!" in one word only.')
        .then(result => {
            const response = result.response;
            const text = response.text();
            
            console.log('✅ API Test Successful!');
            console.log(`Response: "${text.trim()}"`);
            console.log('');
            console.log('╔════════════════════════════════════════════════════╗');
            console.log('║  ✅ AI Service is properly configured and working  ║');
            console.log('╚════════════════════════════════════════════════════╝');
            console.log('');
            console.log('📚 Available AI Features:');
            console.log('  • Answer student questions (general and academic)');
            console.log('  • Generate personalized study plans');
            console.log('  • Provide subject recommendations');
            console.log('  • Predict exam performance');
            console.log('  • Give assignment feedback');
            console.log('  • Solve math problems with explanations');
            console.log('');
            console.log('🤖 The chatbot is ready to use on your platform!');
            console.log('');
        })
        .catch(error => {
            console.error('❌ API Test Failed!');
            console.error('Error:', error.message);
            console.log('');
            console.log('⚠️  Possible issues:');
            console.log('  • Invalid API key');
            console.log('  • Network connectivity problems');
            console.log('  • API quota exceeded');
            console.log('  • Firewall blocking requests');
            console.log('');
            console.log('💡 Troubleshooting:');
            console.log('  1. Verify your API key at: https://aistudio.google.com/app/apikey');
            console.log('  2. Check your network connection');
            console.log('  3. Review quota limits at: https://ai.google.dev/pricing');
            console.log('  4. Check firewall settings');
            console.log('');
            console.log('📖 For more help, see AI_SERVICE_SETUP.md');
            process.exit(1);
        });

} catch (error) {
    console.error('❌ Failed to initialize AI service!');
    console.error('Error:', error.message);
    console.log('');
    console.log('This usually means:');
    console.log('  • @google/generative-ai package is not installed');
    console.log('  • There\'s a code error in the configuration');
    console.log('');
    console.log('To fix:');
    console.log('  npm install @google/generative-ai');
    process.exit(1);
}
