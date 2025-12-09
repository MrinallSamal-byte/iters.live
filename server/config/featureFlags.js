/**
 * Feature Flags Configuration
 * 
 * This file contains feature flags for enabling/disabling various features
 * across the application. Use environment variables for production configuration.
 * 
 * Portal Features:
 * - On memory-constrained environments (like Render free tier), portal scraping
 *   should be disabled to avoid crashes due to Puppeteer memory usage.
 * - Set PORTAL_FEATURES_ENABLED=true to enable portal scraping (requires adequate memory)
 * - Set PORTAL_FEATURES_ENABLED=false to disable portal scraping and use demo data
 */

// Check if running on a memory-constrained environment
const isMemoryConstrained = () => {
  // Render free tier has 512MB limit
  const maxOldSpaceSize = process.env.NODE_OPTIONS?.includes('--max-old-space-size=');
  const isRenderFreeTier = process.env.RENDER === 'true' && !process.env.RENDER_PAID;
  return maxOldSpaceSize || isRenderFreeTier;
};

// Portal features - disabled by default on memory-constrained environments
// Set PORTAL_FEATURES_ENABLED=true to enable portal scraping (requires adequate memory)
const PORTAL_FEATURES_ENABLED = process.env.PORTAL_FEATURES_ENABLED === 'true';

// Message to show users when portal features are disabled
const PORTAL_DISABLED_MESSAGE = 'Portal data syncing is temporarily unavailable. Please use demo data to explore all features.';

// Feature flags object for easy access
const featureFlags = {
  // Portal-related features
  portal: {
    enabled: PORTAL_FEATURES_ENABLED,
    disabledMessage: PORTAL_DISABLED_MESSAGE,
    
    // Sub-features (all disabled when main portal is disabled)
    login: PORTAL_FEATURES_ENABLED,
    sync: PORTAL_FEATURES_ENABLED,
    fetch: PORTAL_FEATURES_ENABLED,
    backup: PORTAL_FEATURES_ENABLED,
    recover: PORTAL_FEATURES_ENABLED,
    googleDriveBackup: PORTAL_FEATURES_ENABLED,
    googleSheetsSync: PORTAL_FEATURES_ENABLED,
  },
  
  // Demo data is always available as fallback
  demoData: {
    enabled: true,
  },

  // Memory optimization
  memoryConstrained: isMemoryConstrained()
};

/**
 * Check if portal features are enabled
 * @returns {boolean} - True if portal features are enabled
 */
function isPortalEnabled() {
  return featureFlags.portal.enabled;
}

/**
 * Get the disabled message for portal features
 * @returns {string} - The disabled message
 */
function getPortalDisabledMessage() {
  return featureFlags.portal.disabledMessage;
}

/**
 * Get the disabled response object for API endpoints
 * @returns {Object} - Standard response object for disabled portal
 */
function getPortalDisabledResponse() {
  return {
    success: false,
    status: 'PORTAL_DISABLED',
    message: PORTAL_DISABLED_MESSAGE,
    portalEnabled: false
  };
}

module.exports = {
  featureFlags,
  isPortalEnabled,
  getPortalDisabledMessage,
  getPortalDisabledResponse,
  PORTAL_FEATURES_ENABLED,
  PORTAL_DISABLED_MESSAGE
};
