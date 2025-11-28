/**
 * Feature Flags Configuration
 * 
 * This file contains feature flags for enabling/disabling various features
 * across the application. Use environment variables for production configuration.
 * 
 * TEMPORARILY DISABLED — DO NOT REMOVE
 * Portal-related features have been temporarily suspended as per requirement.
 * To re-enable, set PORTAL_FEATURES_ENABLED=true in environment variables.
 */

// TEMPORARILY DISABLED — DO NOT REMOVE
// Portal features are disabled until further notice
const PORTAL_FEATURES_ENABLED = process.env.PORTAL_FEATURES_ENABLED === 'true';

// Message to show users when portal features are disabled
const PORTAL_DISABLED_MESSAGE = 'Portal data syncing is temporarily suspended. Please try again later.';

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
  }
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
