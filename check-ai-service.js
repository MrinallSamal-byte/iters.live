#!/usr/bin/env node
/**
 * Quick Diagnostic Script for AI Service Configuration
 * 
 * This script checks if the AI service is properly configured
 * and provides actionable recommendations.
 * 
 * Usage: node check-ai-service.js
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { getSecureKeyPreview, isValidOpenRouterKey, isValidGeminiKey } = require('./server/utils/security.util');

console.log('╔════════════════════════════════════════════════════════════════╗');
console.log('║     AI Service Configuration Diagnostic Tool                   ║');
console.log('╚════════════════════════════════════════════════════════════════╝');
console.log('');

// Check 1: Environment file exists
console.log('📋 Step 1: Checking environment configuration...');
console.log('─────────────────────────────────────────────────────────────────');

const envExists = fs.existsSync(path.join(__dirname, '.env'));
if (envExists) {
    console.log('✅ .env file exists');
} else {
    console.log('❌ .env file not found');
    console.log('');
    console.log('💡 Quick Fix:');
    console.log('   cp .env.example .env');
    console.log('');
}

// Check 2: API Keys configured
console.log('');
console.log('📋 Step 2: Checking API keys...');
console.log('─────────────────────────────────────────────────────────────────');

const openRouterKey = process.env.OPENROUTER_API_KEY;
const geminiKey = process.env.GEMINI_API_KEY;

let configurationScore = 0;

if (openRouterKey) {
    const keyPreview = getSecureKeyPreview(openRouterKey);
    const isValid = isValidOpenRouterKey(openRouterKey);
    
    console.log(`${isValid ? '✅' : '⚠️'} OPENROUTER_API_KEY configured (${keyPreview})`);
    console.log(`   Length: ${openRouterKey.length} characters`);
    
    if (!isValid) {
        console.log('   ⚠️ Warning: Key format may be invalid');
        console.log('   Expected: starts with sk-or-v1- and 30+ characters');
    }
    
    configurationScore += isValid ? 50 : 25;
} else {
    console.log('❌ OPENROUTER_API_KEY not set');
    console.log('');
    console.log('💡 To fix:');
    console.log('   1. Get free key: https://openrouter.ai/keys');
    console.log('   2. Add to .env: OPENROUTER_API_KEY=sk-or-v1-your-key-here');
    console.log('');
}

if (geminiKey) {
    const keyPreview = getSecureKeyPreview(geminiKey);
    const isValid = isValidGeminiKey(geminiKey);
    
    console.log(`${isValid ? '✅' : '⚠️'} GEMINI_API_KEY configured (${keyPreview})`);
    console.log(`   Length: ${geminiKey.length} characters`);
    console.log(`   Model: ${process.env.GEMINI_MODEL || 'not-set'}`);
    
    if (!isValid) {
        console.log('   ⚠️ Warning: Key format may be invalid');
        console.log('   Expected: starts with AIza and 30+ characters');
    }
    
    configurationScore += isValid ? 30 : 15;
} else {
    console.log('⚠️  GEMINI_API_KEY not set (optional fallback)');
    console.log('');
    console.log('💡 To add fallback:');
    console.log('   1. Get free key: https://makersuite.google.com/app/apikey');
    console.log('   2. Add to .env: GEMINI_API_KEY=AIza-your-key-here');
    console.log('   3. Add to .env: GEMINI_MODEL=gemini-1.5-flash');
    console.log('');
}

// Check 3: Service files exist
console.log('');
console.log('📋 Step 3: Checking service files...');
console.log('─────────────────────────────────────────────────────────────────');

const serviceFiles = [
    'server/services/openrouter.service.js',
    'server/services/ai.service.js',
    'server/routes/ai.routes.js'
];

let allFilesExist = true;
serviceFiles.forEach(file => {
    const filePath = path.join(__dirname, file);
    if (fs.existsSync(filePath)) {
        console.log(`✅ ${file}`);
    } else {
        console.log(`❌ ${file} - missing!`);
        allFilesExist = false;
    }
});

if (allFilesExist) {
    configurationScore += 20;
}

// Final Report
console.log('');
console.log('╔════════════════════════════════════════════════════════════════╗');
console.log('║                        Final Report                            ║');
console.log('╚════════════════════════════════════════════════════════════════╝');
console.log('');

console.log(`Configuration Score: ${configurationScore}/100`);
console.log('');

if (configurationScore >= 90) {
    console.log('🎉 Excellent! Your AI service is fully configured.');
    console.log('');
    console.log('Next steps:');
    console.log('1. Start your server: npm start');
    console.log('2. Test the chatbot on your website');
    console.log('3. Verify with: node verify-ai-service.js');
} else if (configurationScore >= 70) {
    console.log('✅ Good! Your AI service is configured with primary support.');
    console.log('');
    console.log('Recommendations:');
    console.log('- Add GEMINI_API_KEY for fallback support (optional)');
    console.log('- Test the service: node verify-ai-service.js');
} else if (configurationScore >= 50) {
    console.log('⚠️  Partial configuration detected.');
    console.log('');
    console.log('Required actions:');
    if (!openRouterKey && geminiKey) {
        console.log('- Consider adding OPENROUTER_API_KEY (recommended primary)');
    } else if (!geminiKey && openRouterKey) {
        console.log('- Consider adding GEMINI_API_KEY for fallback');
    }
} else {
    console.log('❌ AI service is not properly configured.');
    console.log('');
    console.log('Required actions:');
    console.log('1. Create .env file: cp .env.example .env');
    console.log('2. Get OpenRouter key: https://openrouter.ai/keys');
    console.log('3. Add key to .env file');
    console.log('4. Run this script again to verify');
    console.log('');
    console.log('📖 Detailed guide: AI_SERVICE_RENDER_SETUP_GUIDE.md');
}

console.log('');
console.log('════════════════════════════════════════════════════════════════');
console.log('');

// Exit with appropriate code
process.exit(configurationScore >= 50 ? 0 : 1);
