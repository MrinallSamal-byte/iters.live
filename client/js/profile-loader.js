/**
 * Profile Control Loader - Universal Integration Script (Unified)
 * Drop this on any page to automatically load the new universal profile control
 * (uses the same student dashboard profile icon/UI everywhere).
 *
 * Usage (container is optional and ignored by the universal component):
 * <script src="/js/profile-loader.js" data-container="profileControlContainer"></script>
 */

(function() {
    'use strict';
    
    // Configuration (unified to the universal profile component)
    const config = {
        universalCssUrl: '/css/universal-profile.css',
        universalJsUrl: '/js/universal-profile.js',
        defaultContainer: 'profileControlContainer'
    };
    
    // Get container ID from script tag data attribute
    const scriptTag = document.currentScript;
    const containerId = scriptTag?.getAttribute('data-container') || config.defaultContainer;
    
    /**
     * Load CSS file
     */
    function loadCSS(url) {
        return new Promise((resolve, reject) => {
            // Check if already loaded
            if (document.querySelector(`link[href="${url}"]`)) {
                resolve();
                return;
            }
            
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = url;
            link.onload = resolve;
            link.onerror = reject;
            document.head.appendChild(link);
        });
    }
    
    /**
     * Load JavaScript file
     */
    function loadScript(url) {
        return new Promise((resolve, reject) => {
            // Check if already loaded
            if (document.querySelector(`script[src="${url}"]`)) {
                resolve();
                return;
            }
            
            const script = document.createElement('script');
            script.src = url;
            script.onload = resolve;
            script.onerror = reject;
            document.body.appendChild(script);
        });
    }
    
    /**
     * Initialize profile control
     */
    async function init() {
        try {
            console.log('🔄 Loading universal profile control...');

            // If universal is already on the page, just dispatch the event and exit
            if (window.UniversalProfile || document.getElementById('universalProfileContainer')) {
                try {
                    window.dispatchEvent(new CustomEvent('profileControlLoaded', {
                        detail: { container: containerId, source: 'profile-loader' }
                    }));
                } catch (e) { /* no-op */ }
                console.log('✓ Universal profile already present');
                return;
            }

            // Load universal CSS (non-blocking; the component also injects it, but this avoids FOUC)
            loadCSS(config.universalCssUrl).catch(err => {
                console.warn('Failed to preload universal profile CSS:', err);
            });

            // Load universal profile script (it will self-initialize and inject its HTML)
            await loadScript(config.universalJsUrl);
            console.log('✓ Universal profile initialized');

            // Dispatch custom event for other scripts to listen
            window.dispatchEvent(new CustomEvent('profileControlLoaded', {
                detail: { container: containerId, source: 'profile-loader' }
            }));
            
        } catch (error) {
            console.error('❌ Failed to initialize universal profile control:', error);
        }
    }
    
    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
    
    // Export for manual initialization if needed
    window.ProfileControlLoader = { init, config, loadCSS, loadScript };
    
})();
