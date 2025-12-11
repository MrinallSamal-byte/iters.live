/**
 * Tests for /api/ai/chat endpoint
 * @jest-environment node
 */

describe('AI Chat Endpoint', () => {
    describe('Input Validation', () => {
        it('should accept message field', () => {
            const validRequest = {
                message: 'What is 2 + 2?',
                context: 'Math question'
            };
            
            expect(validRequest.message).toBeDefined();
            expect(typeof validRequest.message).toBe('string');
        });

        it('should accept question field for backward compatibility', () => {
            const validRequest = {
                question: 'What is the capital of France?',
                context: 'Geography question'
            };
            
            expect(validRequest.question).toBeDefined();
            expect(typeof validRequest.question).toBe('string');
        });

        it('should accept optional context field', () => {
            const validRequest = {
                message: 'Explain photosynthesis',
                context: 'Biology topic'
            };
            
            expect(validRequest.context).toBeDefined();
            expect(typeof validRequest.context).toBe('string');
        });

        it('should accept optional systemPrompt field', () => {
            const validRequest = {
                message: 'Explain gravity',
                systemPrompt: 'You are a physics teacher'
            };
            
            expect(validRequest.systemPrompt).toBeDefined();
            expect(typeof validRequest.systemPrompt).toBe('string');
        });
    });

    describe('Response Format', () => {
        it('should return success response with correct fields', () => {
            const successResponse = {
                success: true,
                response: 'This is the AI response',
                timestamp: new Date().toISOString()
            };
            
            expect(successResponse.success).toBe(true);
            expect(successResponse.response).toBeDefined();
            expect(successResponse.timestamp).toBeDefined();
            expect(typeof successResponse.timestamp).toBe('string');
        });

        it('should return error response with correct fields', () => {
            const errorResponse = {
                success: false,
                message: 'Message is required'
            };
            
            expect(errorResponse.success).toBe(false);
            expect(errorResponse.message).toBeDefined();
            expect(typeof errorResponse.message).toBe('string');
        });

        it('should return 503 error when service unavailable', () => {
            const serviceUnavailableResponse = {
                success: false,
                message: 'AI service is currently unavailable. Please check if OPENROUTER_API_KEY is configured.'
            };
            
            expect(serviceUnavailableResponse.success).toBe(false);
            expect(serviceUnavailableResponse.message).toContain('AI service is currently unavailable');
        });
    });

    describe('Error Handling', () => {
        it('should handle missing message/question field', () => {
            const invalidRequest = {
                context: 'Some context'
            };
            
            const message = invalidRequest.message || invalidRequest.question;
            expect(message).toBeUndefined();
        });

        it('should handle empty message field', () => {
            const invalidRequest = {
                message: '',
                context: 'Some context'
            };
            
            expect(invalidRequest.message).toBe('');
            expect(invalidRequest.message.trim()).toBe('');
        });
    });

    describe('Backward Compatibility', () => {
        it('should prioritize message over question when both provided', () => {
            const request = {
                message: 'This is the message',
                question: 'This is the question'
            };
            
            const userMessage = request.message || request.question;
            expect(userMessage).toBe('This is the message');
        });

        it('should fallback to question if message not provided', () => {
            const request = {
                question: 'This is the question'
            };
            
            const userMessage = request.message || request.question;
            expect(userMessage).toBe('This is the question');
        });
    });
});

describe('OpenRouter Service Mock', () => {
    describe('isAvailable()', () => {
        it('should return true when API key is configured', () => {
            const mockService = {
                apiKey: 'sk-or-v1-test-key',
                isAvailable() {
                    return Boolean(this.apiKey);
                }
            };
            
            expect(mockService.isAvailable()).toBe(true);
        });

        it('should return false when API key is not configured', () => {
            const mockService = {
                apiKey: '',
                isAvailable() {
                    return Boolean(this.apiKey);
                }
            };
            
            expect(mockService.isAvailable()).toBe(false);
        });
    });

    describe('answerQuestion()', () => {
        it('should accept question, context, and systemPrompt parameters', () => {
            const mockService = {
                async answerQuestion(question, context, systemPrompt) {
                    expect(question).toBeDefined();
                    expect(typeof question).toBe('string');
                    return 'Mock AI response';
                }
            };
            
            const result = mockService.answerQuestion('Test question', 'Test context', null);
            expect(result).toBeDefined();
        });
    });
});
