/**
 * Portal Scraper Service Tests
 * Tests for retry logic, availability checks, and error handling
 */

// Mock axios and dependencies before importing the scraper
jest.mock('axios');
jest.mock('axios-cookiejar-support', () => ({
    wrapper: (client) => client
}));
jest.mock('tough-cookie', () => ({
    CookieJar: jest.fn().mockImplementation(() => ({}))
}));
jest.mock('tesseract.js', () => ({
    createWorker: jest.fn().mockResolvedValue({
        loadLanguage: jest.fn().mockResolvedValue(undefined),
        initialize: jest.fn().mockResolvedValue(undefined),
        setParameters: jest.fn().mockResolvedValue(undefined),
        recognize: jest.fn().mockResolvedValue({ 
            data: { text: 'ABC123' } 
        }),
        terminate: jest.fn().mockResolvedValue(undefined)
    })
}));
jest.mock('sharp', () => {
    return jest.fn().mockReturnValue({
        greyscale: jest.fn().mockReturnThis(),
        normalize: jest.fn().mockReturnThis(),
        threshold: jest.fn().mockReturnThis(),
        sharpen: jest.fn().mockReturnThis(),
        toBuffer: jest.fn().mockResolvedValue(Buffer.from('test'))
    });
});

const axios = require('axios');
const { createScraper, STATUS_SUCCESS, STATUS_AUTH_FAILED, STATUS_PORTAL_UNREACHABLE } = require('../server/services/portal-scraper.service');

describe('Portal Scraper Service', () => {
    let scraper;
    
    beforeEach(() => {
        jest.clearAllMocks();
        scraper = createScraper();
        // Mock axios.create to return a mock client
        axios.create = jest.fn().mockReturnValue({
            get: axios.get,
            post: axios.post
        });
    });
    
    afterEach(async () => {
        if (scraper) {
            await scraper.cleanup();
        }
    });
    
    describe('checkPortalReachability', () => {
        it('should return reachable true when portal responds with 200', async () => {
            axios.get.mockResolvedValueOnce({ status: 200 });
            
            const result = await scraper.checkPortalReachability();
            
            expect(result.reachable).toBe(true);
            expect(result.statusCode).toBe(200);
            expect(result.error).toBeNull();
        });
        
        it('should return reachable true when portal responds with 302', async () => {
            axios.get.mockResolvedValueOnce({ status: 302 });
            
            const result = await scraper.checkPortalReachability();
            
            expect(result.reachable).toBe(true);
            expect(result.statusCode).toBe(302);
            expect(result.error).toBeNull();
        });
        
        it('should return reachable false when portal is unreachable', async () => {
            const error = new Error('ENOTFOUND');
            error.code = 'ENOTFOUND';
            axios.get.mockRejectedValueOnce(error);
            
            const result = await scraper.checkPortalReachability();
            
            expect(result.reachable).toBe(false);
            expect(result.statusCode).toBeNull();
            expect(result.error).toBe('ENOTFOUND');
        });
    });
    
    describe('scrape - retry logic', () => {
        it('should succeed on first attempt when portal is reachable', async () => {
            // Mock reachability check
            axios.get.mockResolvedValueOnce({ status: 200 });
            
            // Mock CAPTCHA image
            axios.get.mockResolvedValueOnce({ 
                status: 200, 
                data: Buffer.from('captcha-image') 
            });
            
            // Mock login
            axios.post.mockResolvedValueOnce({ 
                status: 200, 
                data: { success: true, token: 'test-token' } 
            });
            
            // Mock data fetches (5 endpoints)
            for (let i = 0; i < 5; i++) {
                axios.get.mockResolvedValueOnce({ 
                    status: 200, 
                    data: {} 
                });
            }
            
            const result = await scraper.scrape('TEST123', 'password');
            
            expect(result.status).toBe(STATUS_SUCCESS);
            expect(result.data).toBeDefined();
            expect(result.data.profile).toBeDefined();
        });
        
        it('should retry 3 times when portal is unreachable', async () => {
            const error = new Error('ENOTFOUND');
            error.code = 'ENOTFOUND';
            
            // All 3 reachability checks fail
            axios.get.mockRejectedValue(error);
            
            const result = await scraper.scrape('TEST123', 'password');
            
            expect(result.status).toBe(STATUS_PORTAL_UNREACHABLE);
            expect(result.message).toContain('Cannot fetch data from college website after 3 attempts');
            expect(result.failureReasons).toHaveLength(3);
            expect(result.failureReasons[0]).toContain('Attempt 1');
            expect(result.failureReasons[1]).toContain('Attempt 2');
            expect(result.failureReasons[2]).toContain('Attempt 3');
        });
        
        it('should not retry on authentication failure', async () => {
            // Portal is reachable
            axios.get.mockResolvedValueOnce({ status: 200 });
            
            // CAPTCHA solved
            axios.get.mockResolvedValueOnce({ 
                status: 200, 
                data: Buffer.from('captcha-image') 
            });
            
            // Login fails with 401
            axios.post.mockResolvedValueOnce({ 
                status: 401, 
                data: { error: 'Invalid credentials' } 
            });
            
            const result = await scraper.scrape('TEST123', 'wrongpassword');
            
            expect(result.status).toBe(STATUS_AUTH_FAILED);
            expect(result.failureReasons).toHaveLength(1);
        });
        
        it('should apply incremental delays between retries', async () => {
            const error = new Error('ECONNREFUSED');
            error.code = 'ECONNREFUSED';
            axios.get.mockRejectedValue(error);
            
            const startTime = Date.now();
            await scraper.scrape('TEST123', 'password');
            const duration = Date.now() - startTime;
            
            // Should have delays: 500ms + 1000ms = 1500ms minimum
            // Allow some margin for processing time
            expect(duration).toBeGreaterThanOrEqual(1400);
            expect(duration).toBeLessThan(3000);
        });
        
        it('should return error status after all retries exhausted', async () => {
            // Portal reachable but login fails with network error
            axios.get.mockResolvedValue({ status: 200 });
            
            // CAPTCHA fails
            axios.get.mockResolvedValue({ status: 500 });
            
            const result = await scraper.scrape('TEST123', 'password');
            
            expect(result.status).toBe('error');
            expect(result.message).toContain('after 3 attempts');
            expect(result.failureReasons).toHaveLength(3);
        });
    });
    
    describe('response format standardization', () => {
        it('should return standardized success response', async () => {
            // Mock successful flow
            axios.get.mockResolvedValue({ status: 200, data: {} });
            axios.post.mockResolvedValue({ 
                status: 200, 
                data: { success: true, token: 'test-token' } 
            });
            
            const result = await scraper.scrape('TEST123', 'password');
            
            expect(result).toHaveProperty('status');
            expect(result.status).toBe(STATUS_SUCCESS);
            expect(result).toHaveProperty('data');
            expect(result.data).toHaveProperty('profile');
            expect(result.data).toHaveProperty('attendance');
            expect(result.data).toHaveProperty('marks');
        });
        
        it('should return standardized error response', async () => {
            const error = new Error('Network error');
            axios.get.mockRejectedValue(error);
            
            const result = await scraper.scrape('TEST123', 'password');
            
            expect(result).toHaveProperty('status');
            expect(result).toHaveProperty('message');
            expect(result).toHaveProperty('failureReasons');
            expect(Array.isArray(result.failureReasons)).toBe(true);
        });
    });
    
    describe('sleep utility', () => {
        it('should wait for specified milliseconds', async () => {
            const startTime = Date.now();
            await scraper.sleep(100);
            const duration = Date.now() - startTime;
            
            expect(duration).toBeGreaterThanOrEqual(95);
            expect(duration).toBeLessThan(150);
        });
    });
});
