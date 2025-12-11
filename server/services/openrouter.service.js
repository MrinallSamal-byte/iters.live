/**
 * OpenRouter API Service
 * Provides AI model access through OpenRouter API
 * Supports multiple free models for different use cases
 */

class OpenRouterService {
    constructor() {
        this.apiKey = process.env.OPENROUTER_API_KEY || '';
        this.baseUrl = 'https://openrouter.ai/api/v1';
        
        // Model configurations for different use cases
        this.models = {
            // Models for captcha solving (vision + text understanding)
            // Only vision-capable models are included
            captcha: [
                'amazon/nova-2-lite-v1:free',
                'nvidia/nemotron-nano-12b-v2-vl:free'
            ],
            // Models for chatbot (general text understanding and generation)
            chatbot: [
                'mistralai/mistral-small-3.1-24b-instruct:free',
                'google/gemma-3-4b-it:free',
                'google/gemma-3-12b-it:free',
                'allenai/olmo-3-32b-think:free',
                'openai/gpt-oss-120b:free',
                'openai/gpt-oss-20b:free'
            ]
        };
        
        if (this.apiKey) {
            // Log partial key for verification (first 10 and last 4 characters)
            const keyPreview = this.apiKey.length > 14 
                ? `${this.apiKey.substring(0, 10)}...${this.apiKey.substring(this.apiKey.length - 4)}`
                : 'too-short';
            console.log(`✅ OpenRouter Service initialized with API key (${keyPreview})`);
        } else {
            console.log('⚠️ OpenRouter Service initialized without API key - features will use fallback');
            console.log('💡 Set OPENROUTER_API_KEY environment variable to enable AI features');
        }
    }

    /**
     * Make a request to OpenRouter API
     * @param {string} model - Model identifier
     * @param {Array} messages - Array of message objects
     * @param {Object} options - Additional options
     * @returns {Promise<string>} Response text
     */
    async makeRequest(model, messages, options = {}) {
        if (!this.apiKey) {
            console.error('❌ OpenRouter API key not configured - check OPENROUTER_API_KEY environment variable');
            throw new Error('OpenRouter API key not configured');
        }

        console.log(`🔄 Making OpenRouter API request with model: ${model}`);
        
        try {
            const response = await fetch(`${this.baseUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': options.referer || 'https://iter.edu',
                    'X-Title': options.title || 'ITER EduHub'
                },
                body: JSON.stringify({
                    model,
                    messages,
                    temperature: options.temperature || 0.7,
                    max_tokens: options.maxTokens || 2000,
                    ...options.extraParams
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.error(`❌ OpenRouter API error: ${response.status}`, errorData);
                throw new Error(`OpenRouter API error: ${response.status} - ${JSON.stringify(errorData)}`);
            }

            const data = await response.json();
            const content = data.choices?.[0]?.message?.content || '';
            console.log(`✅ OpenRouter API request successful (${content.length} chars)`);
            return content;
        } catch (error) {
            console.error('❌ OpenRouter API request error:', error.message);
            throw error;
        }
    }

    /**
     * Make request with fallback to multiple models
     * @param {Array<string>} models - Array of model identifiers to try
     * @param {Array} messages - Array of message objects
     * @param {Object} options - Additional options
     * @returns {Promise<string>} Response text
     */
    async makeRequestWithFallback(models, messages, options = {}) {
        let lastError = null;

        for (const model of models) {
            try {
                console.log(`Trying OpenRouter model: ${model}`);
                const response = await this.makeRequest(model, messages, options);
                if (response) {
                    console.log(`✅ Success with model: ${model}`);
                    return response;
                }
            } catch (error) {
                console.log(`❌ Failed with model ${model}: ${error.message}`);
                lastError = error;
                // Continue to next model
            }
        }

        throw lastError || new Error('All OpenRouter models failed');
    }

    /**
     * Solve CAPTCHA using vision models
     * @param {string} imageBase64 - Base64 encoded image
     * @returns {Promise<string>} Extracted CAPTCHA text
     */
    async solveCaptcha(imageBase64) {
        const messages = [
            {
                role: 'user',
                content: [
                    {
                        type: 'text',
                        text: 'Extract the text from this CAPTCHA image. Return ONLY the text you see, nothing else. The text is typically 5-6 alphanumeric characters.'
                    },
                    {
                        type: 'image_url',
                        image_url: {
                            url: `data:image/png;base64,${imageBase64}`
                        }
                    }
                ]
            }
        ];

        try {
            const response = await this.makeRequestWithFallback(
                this.models.captcha,
                messages,
                { temperature: 0.1, maxTokens: 50 }
            );
            
            // Clean up the response to extract just the CAPTCHA text
            const cleaned = response.trim()
                .replace(/[^a-zA-Z0-9]/g, '')
                .toUpperCase()
                .substring(0, 6);
            
            return cleaned;
        } catch (error) {
            console.error('OpenRouter CAPTCHA solving error:', error.message);
            throw error;
        }
    }

    /**
     * Answer a question using chatbot models
     * @param {string} question - User's question
     * @param {string} context - Optional context
     * @param {string} systemPrompt - Optional system prompt
     * @returns {Promise<string>} AI response
     */
    async answerQuestion(question, context = '', systemPrompt = null) {
        const defaultSystemPrompt = `You are a helpful and knowledgeable educational assistant for college students. 
Your primary focus is helping with study-related questions, but you can also help with general questions.
Always aim to be educational and help students learn.
Include step-by-step explanations for complex problems.
Provide examples when they would help understanding.`;

        const messages = [
            {
                role: 'system',
                content: systemPrompt || defaultSystemPrompt
            },
            {
                role: 'user',
                content: context 
                    ? `Context: ${context}\n\nQuestion: ${question}` 
                    : question
            }
        ];

        try {
            const response = await this.makeRequestWithFallback(
                this.models.chatbot,
                messages,
                { temperature: 0.7, maxTokens: 2000 }
            );
            
            return response;
        } catch (error) {
            console.error('OpenRouter chatbot error:', error.message);
            throw error;
        }
    }

    /**
     * Generate a study plan using chatbot models
     * @param {Object} studentData - Student performance data
     * @returns {Promise<Object>} Study plan
     */
    async generateStudyPlan(studentData) {
        const { subjects, attendance, marks, preferences } = studentData;
        
        const prompt = `As an educational AI assistant, create a personalized 2-week study plan for a college student with the following profile:

Subjects: ${subjects.join(', ')}
Attendance: ${JSON.stringify(attendance)}
Recent Marks: ${JSON.stringify(marks)}
Study Preferences: ${preferences.studyHours}h/day, preferred time: ${preferences.preferredTime}

Generate a detailed study plan with:
1. Daily study schedule
2. Priority subjects based on weak areas
3. Recommended study techniques
4. Break times and activities
5. Weekly revision schedule

Format as JSON with structure:
{
    "weeks": [
        {
            "weekNumber": 1,
            "days": [
                {
                    "day": "Monday",
                    "sessions": [
                        {
                            "time": "9:00-11:00",
                            "subject": "",
                            "topics": [],
                            "technique": ""
                        }
                    ],
                    "goals": []
                }
            ]
        }
    ],
    "overallStrategy": "",
    "weeklyGoals": []
}`;

        const messages = [
            {
                role: 'system',
                content: 'You are an expert educational planner. Always respond with valid JSON only, no additional text.'
            },
            {
                role: 'user',
                content: prompt
            }
        ];

        try {
            const response = await this.makeRequestWithFallback(
                this.models.chatbot,
                messages,
                { temperature: 0.5, maxTokens: 3000 }
            );
            
            // Extract JSON from response
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
            
            throw new Error('Failed to parse study plan JSON');
        } catch (error) {
            console.error('OpenRouter study plan error:', error.message);
            throw error;
        }
    }

    /**
     * Check if OpenRouter service is available
     * @returns {boolean}
     */
    isAvailable() {
        return Boolean(this.apiKey);
    }
}

module.exports = new OpenRouterService();
