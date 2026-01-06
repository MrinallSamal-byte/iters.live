/**
 * Test OpenRouter API Connectivity
 * Run this to verify the OpenRouter API key is configured correctly
 */

require('dotenv').config();

async function testOpenRouterAPI() {
    const apiKey = process.env.OPENROUTER_API_KEY;
    
    if (!apiKey) {
        console.error('❌ ERROR: OPENROUTER_API_KEY is not set in .env file');
        console.log('💡 Please add your OpenRouter API key to the .env file');
        console.log('   Get a key from: https://openrouter.ai/keys');
        process.exit(1);
    }
    
    // Validate key format
    if (!apiKey.startsWith('sk-or-v1-') || apiKey.length < 30) {
        console.error('⚠️ WARNING: OPENROUTER_API_KEY format appears invalid');
        console.log('   Expected format: sk-or-v1-... with minimum 30 characters');
        console.log('   Current format:', apiKey.substring(0, 15) + '...');
    } else {
        console.log('✅ API key format looks valid');
        console.log('   Key preview:', apiKey.substring(0, 20) + '...');
    }
    
    console.log('\n🔄 Testing API connection...\n');
    
    const testMessage = "Hello! This is a test message. Please respond with 'Test successful'.";
    
    try {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://iter.edu',
                'X-Title': 'ITER EduHub Test'
            },
            body: JSON.stringify({
                model: 'mistralai/mistral-small-3.1-24b-instruct:free',
                messages: [
                    {
                        role: 'user',
                        content: testMessage
                    }
                ],
                temperature: 0.7,
                max_tokens: 100
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('❌ API Request Failed');
            console.error('   Status:', response.status, response.statusText);
            console.error('   Error:', JSON.stringify(errorData, null, 2));
            
            if (response.status === 401) {
                console.log('\n💡 SOLUTION: The API key is invalid or expired');
                console.log('   1. Get a new key from: https://openrouter.ai/keys');
                console.log('   2. Update OPENROUTER_API_KEY in your .env file');
            } else if (response.status === 402) {
                console.log('\n💡 SOLUTION: Account needs credits or free tier limit reached');
                console.log('   1. Check your account at: https://openrouter.ai/settings/credits');
                console.log('   2. Add credits or wait for free tier reset');
            } else if (response.status === 429) {
                console.log('\n💡 SOLUTION: Rate limit exceeded');
                console.log('   1. Wait a few moments and try again');
                console.log('   2. Consider upgrading your plan');
            }
            
            process.exit(1);
        }
        
        const data = await response.json();
        
        if (data.choices && data.choices.length > 0) {
            const aiResponse = data.choices[0].message.content;
            console.log('✅ API Connection Successful!\n');
            console.log('📝 Test Response:');
            console.log('  ', aiResponse.substring(0, 200) + (aiResponse.length > 200 ? '...' : ''));
            console.log('\n✨ OpenRouter API is working correctly!');
            console.log('   The chatbot should be able to use AI features.');
            
            // Show usage if available
            if (data.usage) {
                console.log('\n📊 Token Usage:');
                console.log('   Prompt tokens:', data.usage.prompt_tokens || 0);
                console.log('   Completion tokens:', data.usage.completion_tokens || 0);
                console.log('   Total tokens:', data.usage.total_tokens || 0);
            }
            
            console.log('\n🎉 Test completed successfully!');
        } else {
            console.error('❌ Unexpected response format:', JSON.stringify(data, null, 2));
            process.exit(1);
        }
        
    } catch (error) {
        console.error('❌ Network or Connection Error');
        console.error('   Error:', error.message);
        console.log('\n💡 SOLUTION:');
        console.log('   1. Check your internet connection');
        console.log('   2. Verify firewall settings allow HTTPS connections');
        console.log('   3. Try again in a few moments');
        process.exit(1);
    }
}

// Run the test
console.log('🧪 OpenRouter API Test\n');
console.log('═'.repeat(50));
testOpenRouterAPI().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
