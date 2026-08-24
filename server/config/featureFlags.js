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
  // Check if max-old-space-size is set to 400MB or less
  const nodeOptions = process.env.NODE_OPTIONS || '';
  const maxOldSpaceMatch = nodeOptions.match(/--max-old-space-size=(\d+)/);
  if (maxOldSpaceMatch) {
    const maxOldSpaceSize = parseInt(maxOldSpaceMatch[1], 10);
    if (maxOldSpaceSize <= 400) {
      return true;
    }
  }
  // Check for Render environment
  const isRenderFreeTier = process.env.RENDER === 'true' && !process.env.RENDER_PAID;
  return isRenderFreeTier;
};

// Portal features - disabled by default (opt-in via env)
// Set PORTAL_FEATURES_ENABLED=true to enable portal scraping
const PORTAL_FEATURES_ENABLED = process.env.PORTAL_FEATURES_ENABLED === 'true';

// Message to show users when portal features are disabled
const PORTAL_DISABLED_MESSAGE = 'Portal data syncing is temporarily unavailable. Please use demo data to explore all features.';

// Feature flags object for easy access
const featureFlags = {
  // Portal-related features
  portal: {
    enabled: PORTAL_FEATURES_ENABLED,
    disabledMessage: PORTAL_DISABLED_MESSAGE,
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
  getPortalDisabledResponse,
  PORTAL_FEATURES_ENABLED,
  PORTAL_DISABLED_MESSAGE
};
