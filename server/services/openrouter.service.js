/**
 * OpenRouter API Service
 * Provides AI model access through OpenRouter API
 * Supports multiple free models for different use cases
 */

const { getSecureKeyPreview, isValidOpenRouterKey } = require('../utils/security.util');

const DEFAULT_BASE_URL = 'https://openrouter.ai/api/v1';
const DEFAULT_SITE_URL = 'https://iter-aio.onrender.com';
const DEFAULT_SITE_NAME = 'ITERasn hub';
const DEFAULT_TIMEOUT_MS = 20_000;
const DEFAULT_MODEL_CATALOG_TTL_MS = 30 * 60 * 1000;
const DEFAULT_MODELS = {
    captcha: [
        'nvidia/nemotron-nano-12b-v2-vl:free',
        'google/gemma-3-27b-it:free',
        'mistralai/mistral-small-3.1-24b-instruct:free',
        'google/gemma-3-12b-it:free',
        'google/gemma-3-4b-it:free'
    ],
    chatbot: [
        'nvidia/nemotron-3-super-120b-a12b:free',
        'google/gemma-3-27b-it:free',
        'arcee-ai/trinity-large-preview:free',
        'google/gemma-3-12b-it:free',
        'mistralai/mistral-small-3.1-24b-instruct:free',
        'google/gemma-3-4b-it:free'
    ]
};
const AVOIDED_PLAIN_CHAT_MODELS = new Set([
    'arcee-ai/trinity-mini:free',
    'nvidia/nemotron-nano-9b-v2:free',
    'stepfun/step-3.5-flash:free'
]);

function parsePositiveInteger(value, fallback) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseModelList(value) {
    if (!value || typeof value !== 'string') {
        return [];
    }

    return value
        .split(',')
        .map(model => model.trim())
        .filter(Boolean);
}

function dedupeModels(models) {
    return [...new Set((models || []).filter(Boolean))];
}

class OpenRouterService {
    constructor() {
        this.apiKey = process.env.OPENROUTER_API_KEY || '';
        this.baseUrl = process.env.OPENROUTER_BASE_URL || DEFAULT_BASE_URL;
        this.siteUrl = process.env.OPENROUTER_SITE_URL || process.env.CLIENT_URL || DEFAULT_SITE_URL;
        this.siteName = process.env.OPENROUTER_SITE_NAME || DEFAULT_SITE_NAME;
        this.requestTimeoutMs = parsePositiveInteger(process.env.OPENROUTER_TIMEOUT_MS, DEFAULT_TIMEOUT_MS);
        this.modelCatalogTtlMs = parsePositiveInteger(
            process.env.OPENROUTER_MODEL_CATALOG_TTL_MS,
            DEFAULT_MODEL_CATALOG_TTL_MS
        );
        this.modelCatalog = null;
        this.modelCatalogFetchedAt = 0;

        this.models = {
            captcha: this.buildConfiguredModelList('captcha'),
            chatbot: this.buildConfiguredModelList('chatbot')
        };
        
        if (this.apiKey) {
            if (isValidOpenRouterKey(this.apiKey)) {
                const keyPreview = getSecureKeyPreview(this.apiKey);
                console.log(`✅ OpenRouter Service initialized with API key (${keyPreview})`);
            } else {
                console.log('⚠️ OpenRouter API key format appears invalid');
                console.log('   Expected format: sk-or-v1-... with minimum 30 characters');
                console.log('   Get a valid key from: https://openrouter.ai/keys');
            }
        } else {
            console.log('⚠️ OpenRouter Service initialized without API key - features will use fallback');
            console.log('💡 Set OPENROUTER_API_KEY environment variable to enable AI features');
        }
    }

    buildConfiguredModelList(useCase) {
        const isCaptcha = useCase === 'captcha';
        const primaryEnvKey = isCaptcha ? 'OPENROUTER_CAPTCHA_MODEL' : 'OPENROUTER_CHAT_MODEL';
        const fallbackEnvKey = isCaptcha ? 'OPENROUTER_CAPTCHA_FALLBACK_MODELS' : 'OPENROUTER_CHAT_FALLBACK_MODELS';

        return dedupeModels([
            ...parseModelList(process.env[primaryEnvKey]),
            ...parseModelList(process.env[fallbackEnvKey]),
            ...DEFAULT_MODELS[useCase]
        ]);
    }

    getPreferredModels(useCase) {
        return [...(this.models[useCase] || [])];
    }

    isFreeModel(model) {
        return Boolean(model?.id && model.id.endsWith(':free'));
    }

    isModelSuitable(model, useCase) {
        if (!this.isFreeModel(model)) {
            return false;
        }

        const inputModalities = model.architecture?.input_modalities || [];
        const outputModalities = model.architecture?.output_modalities || [];
        const supportsTextOutput = outputModalities.includes('text');
        if (!supportsTextOutput) {
            return false;
        }

        if (useCase === 'captcha') {
            return inputModalities.includes('image');
        }

        return inputModalities.includes('text') && !AVOIDED_PLAIN_CHAT_MODELS.has(model.id);
    }

    async fetchModelCatalog() {
        const hasFreshCache = this.modelCatalog && (Date.now() - this.modelCatalogFetchedAt) < this.modelCatalogTtlMs;
        if (hasFreshCache) {
            return this.modelCatalog;
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), Math.min(this.requestTimeoutMs, 10_000));

        try {
            const response = await fetch(`${this.baseUrl}/models`, {
                headers: { 'Accept': 'application/json' },
                signal: controller.signal
            });

            if (!response.ok) {
                throw new Error(`OpenRouter models API returned ${response.status}`);
            }

            const payload = await response.json();
            this.modelCatalog = Array.isArray(payload?.data) ? payload.data : [];
            this.modelCatalogFetchedAt = Date.now();
            return this.modelCatalog;
        } finally {
            clearTimeout(timeout);
        }
    }

    async getModelsForUseCase(useCase) {
        const preferredModels = this.getPreferredModels(useCase);

        try {
            const catalog = await this.fetchModelCatalog();
            const byId = new Map(catalog.map(model => [model.id, model]));
            const availablePreferredModels = preferredModels.filter(modelId => {
                const metadata = byId.get(modelId);
                return metadata && this.isModelSuitable(metadata, useCase);
            });

            if (availablePreferredModels.length > 0) {
                return availablePreferredModels;
            }

            const discoveredFreeModels = catalog
                .filter(model => this.isModelSuitable(model, useCase))
                .map(model => model.id);

            if (discoveredFreeModels.length > 0) {
                return dedupeModels(discoveredFreeModels);
            }
        } catch (error) {
            console.warn(`⚠️ OpenRouter model catalog lookup failed for ${useCase}: ${error.message}`);
        }

        return preferredModels;
    }

    async getResolvedModels(useCase) {
        return this.getModelsForUseCase(useCase);
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
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), this.requestTimeoutMs);
            const response = await fetch(`${this.baseUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': options.referer || this.siteUrl,
                    'X-Title': options.title || this.siteName
                },
                body: JSON.stringify({
                    model,
                    messages,
                    temperature: typeof options.temperature === 'number' ? options.temperature : 0.7,
                    max_tokens: options.maxTokens || 2000,
                    ...options.extraParams
                }),
                signal: controller.signal
            }).finally(() => {
                clearTimeout(timeout);
            });

            if (!response.ok) {
                const errorText = await response.text();
                let errorData = errorText;
                try {
                    errorData = JSON.parse(errorText);
                } catch (error) {
                    // Keep text fallback when the provider returns non-JSON output.
                }
                console.error(`❌ OpenRouter API error: ${response.status}`, errorData);
                throw new Error(`OpenRouter API error: ${response.status} - ${JSON.stringify(errorData)}`);
            }

            const data = await response.json();
            const content = data.choices?.[0]?.message?.content;
            if (typeof content !== 'string' || !content.trim()) {
                throw new Error(`OpenRouter model ${model} returned empty content`);
            }
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
            const models = await this.getModelsForUseCase('captcha');
            const response = await this.makeRequestWithFallback(
                models,
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
        const defaultSystemPrompt = `You are a helpful educational assistant for college students.
Answer clearly, accurately, and concisely.
For general questions, reply in 1 to 3 short sentences or up to 3 short bullet points.
For study or problem-solving questions, stay concise by default and only include steps when they help.
For website or navigation questions, give the direct action first.
Avoid filler, repeated disclaimers, and long introductions.
If unsure, say so briefly.`;

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
            const models = await this.getModelsForUseCase('chatbot');
            const response = await this.makeRequestWithFallback(
                models,
                messages,
                { temperature: 0.5, maxTokens: 900 }
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
            const models = await this.getModelsForUseCase('chatbot');
            const response = await this.makeRequestWithFallback(
                models,
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
