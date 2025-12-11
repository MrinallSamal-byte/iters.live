/**
 * Security Utilities for API Key Handling
 * Provides secure methods for validating and displaying API keys
 */

/**
 * Create a secure preview of an API key
 * Shows only first 6 and last 4 characters
 * @param {string} key - The API key to preview
 * @returns {string} Secure preview of the key
 */
function getSecureKeyPreview(key) {
    if (!key) {
        return 'not-set';
    }
    
    if (key.length < 14) {
        return 'invalid-length';
    }
    
    return `${key.substring(0, 6)}...${key.substring(key.length - 4)}`;
}

/**
 * Validate OpenRouter API key format
 * @param {string} key - The API key to validate
 * @returns {boolean} True if key appears valid
 */
function isValidOpenRouterKey(key) {
    if (!key || typeof key !== 'string') {
        return false;
    }
    
    // OpenRouter keys start with 'sk-or-v1-' and should be at least 30 characters
    // Note: Typical keys are around 70+ characters
    return key.startsWith('sk-or-v1-') && key.length >= 30;
}

/**
 * Validate Google Gemini API key format
 * @param {string} key - The API key to validate
 * @returns {boolean} True if key appears valid
 */
function isValidGeminiKey(key) {
    if (!key || typeof key !== 'string') {
        return false;
    }
    
    // Gemini keys start with 'AIza' and should be at least 30 characters
    // Note: Typical keys are exactly 39 characters
    return key.startsWith('AIza') && key.length >= 30;
}

module.exports = {
    getSecureKeyPreview,
    isValidOpenRouterKey,
    isValidGeminiKey
};
