/**
 * Session Middleware
 * Provides session validation and timeout enforcement on the backend.
 * Works in conjunction with the frontend session-timeout.js
 */

const NodeCache = require('node-cache');

// Session cache with 30-minute TTL (slightly longer than frontend timeout)
const sessionCache = new NodeCache({ 
    stdTTL: 30 * 60, // 30 minutes
    checkperiod: 60 // Check for expired entries every 60 seconds
});

// Configuration
const SESSION_TIMEOUT_MS = 20 * 60 * 1000; // 20 minutes

/**
 * Update session activity in cache
 * @param {string} userId - User ID
 * @param {string} sessionId - Session ID from client
 * @param {number} timestamp - Activity timestamp
 */
function updateSessionActivity(userId, sessionId, timestamp) {
    const sessionKey = `session:${userId}:${sessionId}`;
    const sessionData = sessionCache.get(sessionKey) || {};
    
    sessionData.lastActivity = timestamp || Date.now();
    sessionData.userId = userId;
    sessionData.sessionId = sessionId;
    
    sessionCache.set(sessionKey, sessionData);
    
    // Also store user's active session
    sessionCache.set(`user:${userId}:activeSession`, sessionId);
}

/**
 * Get session data from cache
 * @param {string} userId - User ID
 * @param {string} sessionId - Session ID
 * @returns {Object|null} Session data or null
 */
function getSessionData(userId, sessionId) {
    const sessionKey = `session:${userId}:${sessionId}`;
    return sessionCache.get(sessionKey) || null;
}

/**
 * Check if session is valid (not timed out)
 * @param {string} userId - User ID
 * @param {string} sessionId - Session ID
 * @param {number} clientLastActivity - Last activity from client
 * @returns {Object} Validation result
 */
function validateSession(userId, sessionId, clientLastActivity) {
    const sessionData = getSessionData(userId, sessionId);
    
    if (!sessionData) {
        // No server-side session, trust client activity if reasonable
        if (clientLastActivity) {
            const elapsed = Date.now() - clientLastActivity;
            if (elapsed < SESSION_TIMEOUT_MS) {
                // Create session from client data
                updateSessionActivity(userId, sessionId, clientLastActivity);
                return {
                    valid: true,
                    reason: 'created_from_client',
                    serverLastActivity: clientLastActivity
                };
            }
        }
        
        return {
            valid: false,
            reason: 'session_not_found'
        };
    }
    
    // Use the most recent activity (server or client)
    const serverLastActivity = sessionData.lastActivity;
    const safeClientActivity = clientLastActivity ?? 0;
    const mostRecentActivity = Math.max(serverLastActivity, safeClientActivity);
    const elapsed = Date.now() - mostRecentActivity;
    
    if (elapsed >= SESSION_TIMEOUT_MS) {
        // Session has timed out
        invalidateSession(userId, sessionId);
        return {
            valid: false,
            reason: 'session_timeout',
            elapsed: elapsed
        };
    }
    
    // Update with most recent activity
    if (clientLastActivity && clientLastActivity > serverLastActivity) {
        updateSessionActivity(userId, sessionId, clientLastActivity);
    }
    
    return {
        valid: true,
        reason: 'valid',
        serverLastActivity: mostRecentActivity,
        remainingTime: SESSION_TIMEOUT_MS - elapsed
    };
}

/**
 * Invalidate a session
 * @param {string} userId - User ID
 * @param {string} sessionId - Session ID
 */
function invalidateSession(userId, sessionId) {
    const sessionKey = `session:${userId}:${sessionId}`;
    sessionCache.del(sessionKey);
    
    // Check if this was the active session
    const activeSession = sessionCache.get(`user:${userId}:activeSession`);
    if (activeSession === sessionId) {
        sessionCache.del(`user:${userId}:activeSession`);
    }
}

module.exports = {
    SESSION_TIMEOUT_MS,
    updateSessionActivity,
    getSessionData,
    validateSession,
    invalidateSession,
    sessionCache
};
