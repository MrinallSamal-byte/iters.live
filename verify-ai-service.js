#!/usr/bin/env node

/**
 * AI Service Verification Script
 * 
 * This script verifies that the AI services are properly configured
 * and can communicate with OpenRouter API and Google's Gemini API.
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
const openRouterKey = process.env.OPENROUTER_API_KEY;
const geminiKey = process.env.GEMINI_API_KEY;
const geminiModel = process.env.GEMINI_MODEL || 'gemini-1.5-flash';

console.log('📋 Configuration Check:');
console.log('─────────────────────────────────────────────────────');
console.log(`✓ OPENROUTER_API_KEY: ${openRouterKey ? '✓ Set (length: ' + openRouterKey.length + ' characters) [PRIMARY]' : '❌ NOT SET [PRIMARY]'}`);
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
    console.log('📝 To fix this:');
    console.log('1. Copy .env.example to .env:');
    console.log('   cp .env.example .env');
    console.log('');
    console.log('2. Add at least one API key to .env:');
    console.log('   OPENROUTER_API_KEY=sk-or-v1-your-key-here  (get from https://openrouter.ai/keys)');
    console.log('   GEMINI_API_KEY=your-gemini-key-here  (get from https://makersuite.google.com/app/apikey)');
    console.log('');
    console.log('See RENDER_AI_SERVICE_SETUP.md for detailed instructions.');
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
            const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${openRouterKey}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': 'https://iter.edu',
                    'X-Title': 'ITER EduHub'
                },
                body: JSON.stringify({
                    model: 'google/gemma-3-4b-it:free',
                    messages: [
                        { role: 'user', content: 'Say "Hello!" in one word only.' }
                    ],
                    max_tokens: 10
                })
            });

            if (response.ok) {
                const data = await response.json();
                const text = data.choices?.[0]?.message?.content || 'No response';
                console.log('✅ OpenRouter API Test Successful!');
                console.log(`Response: "${text.trim()}"`);
                console.log('');
                openRouterSuccess = true;
            } else {
                const errorData = await response.json().catch(() => ({}));
                console.error('❌ OpenRouter API Test Failed!');
                console.error('Status:', response.status);
                console.error('Error:', JSON.stringify(errorData, null, 2));
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
