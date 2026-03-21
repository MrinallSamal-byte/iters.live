/**
 * @jest-environment node
 */

describe('OpenRouterService', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        jest.resetModules();
        process.env = {
            ...originalEnv,
            OPENROUTER_API_KEY: 'sk-or-v1-test-key-12345678901234567890'
        };
        global.fetch = jest.fn();
    });

    afterEach(() => {
        process.env = originalEnv;
        delete global.fetch;
        jest.restoreAllMocks();
    });

    it('resolves preferred chat models that still exist in the live catalog', async () => {
        global.fetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                data: [
                    {
                        id: 'nvidia/nemotron-3-super-120b-a12b:free',
                        architecture: {
                            input_modalities: ['text'],
                            output_modalities: ['text']
                        }
                    },
                    {
                        id: 'google/gemma-3-27b-it:free',
                        architecture: {
                            input_modalities: ['text', 'image'],
                            output_modalities: ['text']
                        }
                    }
                ]
            })
        });

        const service = require('../services/openrouter.service');
        const resolved = await service.getResolvedModels('chatbot');

        expect(resolved).toEqual([
            'nvidia/nemotron-3-super-120b-a12b:free',
            'google/gemma-3-27b-it:free'
        ]);
    });

    it('falls back to configured captcha models when the catalog lookup fails', async () => {
        global.fetch.mockRejectedValueOnce(new Error('network down'));

        const service = require('../services/openrouter.service');
        const resolved = await service.getResolvedModels('captcha');

        expect(resolved[0]).toBe('nvidia/nemotron-nano-12b-v2-vl:free');
        expect(resolved).toContain('google/gemma-3-27b-it:free');
    });
});
