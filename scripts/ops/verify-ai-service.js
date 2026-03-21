#!/usr/bin/env node

/**
 * AI Service Verification Script
 * 
 * This script verifies that the AI services are properly configured
 * and can communicate with OpenRouter API and Google's Gemini API.
 * 
 * Usage: node scripts/ops/verify-ai-service.js
 */

require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const openRouterService = require('../../server/services/openrouter.service');

console.log('╔════════════════════════════════════════════════════╗');
console.log('║     AI Service Configuration Verification         ║');
console.log('╚════════════════════════════════════════════════════╝');
console.log('');

// Check environment variables
const openRouterKey = process.env.OPENROUTER_API_KEY;
const geminiKey = process.env.GEMINI_API_KEY;
const geminiModel = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
const openRouterModel = openRouterService.getPreferredModels('chatbot')[0] || 'nvidia/nemotron-3-super-120b-a12b:free';

console.log('📋 Configuration Check:');
console.log('─────────────────────────────────────────────────────');
console.log(`✓ OPENROUTER_API_KEY: ${openRouterKey ? '✓ Set (length: ' + openRouterKey.length + ' characters) [PRIMARY]' : '❌ NOT SET [PRIMARY]'}`);
console.log(`✓ OPENROUTER_CHAT_MODEL: ${openRouterModel}`);
console.log(`✓ GEMINI_API_KEY: ${geminiKey ? '✓ Set (length: ' + geminiKey.length + ' characters) [FALLBACK]' : '❌ NOT SET [FALLBACK]'}`);
console.log(`✓ GEMINI_MODEL: ${geminiModel}`);
console.log('');

if (!openRouterKey && !geminiKey) {
    console.error('❌ ERROR: No AI service configured!');
    console.log('');
    console.log('At least one AI service must be configured:');
    console.log('  • OPENROUTER_API_KEY (recommended, primary)');
    console.log('  • GEMINI_API_KEY (fallback)');
    console.log('');
    console.log('📝 Quick Fix (3 steps):');
    console.log('');
    console.log('1. Create .env file:');
    console.log('   cp .env.example .env');
    console.log('');
    console.log('2. Get FREE API keys:');
    console.log('   • OpenRouter: https://openrouter.ai/keys (sign up → create key)');
    console.log('   • Gemini: https://makersuite.google.com/app/apikey (sign in → get key)');
    console.log('');
    console.log('3. Add keys to .env file:');
    console.log('   OPENROUTER_API_KEY=sk-or-v1-your-actual-key');
    console.log('   GEMINI_API_KEY=AIza-your-actual-key');
    console.log('');
    console.log('4. Run this script again to verify:');
    console.log('   node scripts/ops/verify-ai-service.js');
    console.log('');
    console.log('📖 Full guide: See RENDER_AI_SERVICE_SETUP.md for detailed instructions');
    console.log('🚀 For Render deployment: See AI_CHATBOT_RENDER_QUICKFIX.md');
    process.exit(1);
}

if (!openRouterKey) {
    console.warn('⚠️  WARNING: OPENROUTER_API_KEY is not configured!');
    console.log('OpenRouter is the primary AI service. Only Gemini fallback is available.');
    console.log('');
}

// Main verification function
(async () => {
    let openRouterSuccess = false;
    let geminiSuccess = false;

    // Test OpenRouter API
    if (openRouterKey) {
        console.log('🔧 Testing OpenRouter API (Primary)...');
        console.log('─────────────────────────────────────────────────────');
        
        try {
            const text = await openRouterService.answerQuestion(
                'Say "Hello!" in one short word only.',
                'Verification check for the production chatbot'
            );

            if (text && text.trim()) {
                console.log('✅ OpenRouter API Test Successful!');
                console.log(`Response: "${text.trim()}"`);
                console.log('');
                openRouterSuccess = true;
            } else {
                console.error('❌ OpenRouter API Test Failed!');
                console.error('Error: OpenRouter returned an empty response');
                console.log('');
            }
        } catch (error) {
            console.error('❌ OpenRouter API Test Failed!');
            console.error('Error:', error.message);
            console.log('');
        }
    }

    // Test Gemini API
    if (geminiKey) {
        console.log('🔧 Testing Google Gemini API (Fallback)...');
        console.log('─────────────────────────────────────────────────────');
        
        try {
            const genAI = new GoogleGenerativeAI(geminiKey);
            const model = genAI.getGenerativeModel({ model: geminiModel });
            console.log('✅ GoogleGenerativeAI initialized successfully');
            console.log('✅ Model configured: ' + geminiModel);
            console.log('Sending test query...');
            
            const result = await model.generateContent('Say "Hello!" in one word only.');
            const response = result.response;
            const text = response.text();
            
            console.log('✅ Gemini API Test Successful!');
            console.log(`Response: "${text.trim()}"`);
            console.log('');
            geminiSuccess = true;
        } catch (error) {
            console.error('❌ Gemini API Test Failed!');
            console.error('Error:', error.message);
            console.log('');
        }
    }

    // Final verdict
    console.log('╔════════════════════════════════════════════════════╗');
    if (openRouterSuccess || geminiSuccess) {
        console.log('║  ✅ AI Service is properly configured and working  ║');
        console.log('╚════════════════════════════════════════════════════╝');
        console.log('');
        console.log('📊 Service Status:');
        console.log(`  • OpenRouter (Primary): ${openRouterSuccess ? '✅ Working' : '❌ Failed or not configured'}`);
        console.log(`  • Gemini (Fallback): ${geminiSuccess ? '✅ Working' : '❌ Failed or not configured'}`);
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
        process.exit(0);
    } else {
        console.log('║  ❌ No working AI service found                    ║');
        console.log('╚════════════════════════════════════════════════════╝');
        console.log('');
        console.log('⚠️  Possible issues:');
        console.log('  • Invalid API keys');
        console.log('  • Network connectivity problems');
        console.log('  • API quota exceeded');
        console.log('  • Firewall blocking requests');
        console.log('');
        console.log('💡 Troubleshooting:');
        console.log('  1. Verify OpenRouter key: https://openrouter.ai/keys');
        console.log('  2. Verify Gemini key: https://aistudio.google.com/app/apikey');
        console.log('  3. Check your network connection');
        console.log('  4. Review API quota limits');
        console.log('  5. Check firewall settings');
        console.log('');
        console.log('📖 For more help, see RENDER_AI_SERVICE_SETUP.md');
        process.exit(1);
    }
})();
