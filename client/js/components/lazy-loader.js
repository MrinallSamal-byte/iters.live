/**
 * Lazy Loading Component
 * Uses Intersection Observer API for efficient lazy loading
 */

class LazyLoader {
  constructor(options = {}) {
    this.options = {
      root: null,
      rootMargin: '50px',
      threshold: 0.01,
      ...options
    };

    this.observer = null;
    this.init();
  }

  /**
   * Initialize Intersection Observer
   */
  init() {
    if (!('IntersectionObserver' in window)) {
      console.warn('IntersectionObserver not supported, falling back to immediate loading');
      this.loadAllImmediately();
      return;
    }

    this.observer = new IntersectionObserver(
      this.handleIntersection.bind(this),
      this.options
    );

    this.observeElements();
  }

  /**
   * Handle intersection events
   */
  handleIntersection(entries) {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const element = entry.target;
        this.loadElement(element);
        this.observer.unobserve(element);
      }
    });
  }

  /**
   * Observe all lazy elements
   */
  observeElements() {
    // Lazy images
    document.querySelectorAll('img[data-src], img[data-lazy]').forEach(img => {
      this.observer.observe(img);
    });

    // Lazy background images
    document.querySelectorAll('[data-bg]').forEach(el => {
      this.observer.observe(el);
    });

    // Lazy iframes (for videos, maps, etc.)
    document.querySelectorAll('iframe[data-src]').forEach(iframe => {
      this.observer.observe(iframe);
    });

    // Lazy content sections
    document.querySelectorAll('[data-lazy-content]').forEach(section => {
      this.observer.observe(section);
    });
  }

  /**
   * Load individual element
   */
  loadElement(element) {
    if (element.tagName === 'IMG') {
      this.loadImage(element);
    } else if (element.tagName === 'IFRAME') {
      this.loadIframe(element);
    } else if (element.hasAttribute('data-bg')) {
      this.loadBackgroundImage(element);
    } else if (element.hasAttribute('data-lazy-content')) {
      this.loadContent(element);
    }
  }

  /**
   * Load lazy image
   */
  loadImage(img) {
    const src = img.getAttribute('data-src') || img.getAttribute('data-lazy');
    if (!src) return;

    // Show skeleton while loading
    img.classList.add('lazy-loading');

    const tempImg = new Image();
    tempImg.onload = () => {
      img.src = src;
      img.classList.remove('lazy-loading');
      img.classList.add('lazy-loaded');
      
      // Load srcset if available
      const srcset = img.getAttribute('data-srcset');
      if (srcset) {
        img.srcset = srcset;
      }

      img.removeAttribute('data-src');
      img.removeAttribute('data-lazy');
      img.removeAttribute('data-srcset');
    };

    tempImg.onerror = () => {
      img.classList.remove('lazy-loading');
      img.classList.add('lazy-error');
      console.error('Failed to load image:', src);
    };

    tempImg.src = src;
  }

  /**
   * Load lazy background image
   */
  loadBackgroundImage(element) {
    const bg = element.getAttribute('data-bg');
    if (!bg) return;

    element.classList.add('lazy-loading');

    const tempImg = new Image();
    tempImg.onload = () => {
      element.style.backgroundImage = `url('${bg}')`;
      element.classList.remove('lazy-loading');
      element.classList.add('lazy-loaded');
      element.removeAttribute('data-bg');
    };

    tempImg.onerror = () => {
      element.classList.remove('lazy-loading');
      element.classList.add('lazy-error');
    };

    tempImg.src = bg;
  }

  /**
   * Load lazy iframe
   */
  loadIframe(iframe) {
    const src = iframe.getAttribute('data-src');
    if (!src) return;

    iframe.classList.add('lazy-loading');
    iframe.src = src;
    
    iframe.onload = () => {
      iframe.classList.remove('lazy-loading');
      iframe.classList.add('lazy-loaded');
      iframe.removeAttribute('data-src');
    };
  }

  /**
   * Load lazy content via AJAX
   */
  async loadContent(element) {
    const url = element.getAttribute('data-lazy-content');
    if (!url) return;

    element.classList.add('lazy-loading');

    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to load content');

      const html = await response.text();
      element.innerHTML = html;
      element.classList.remove('lazy-loading');
      element.classList.add('lazy-loaded');
      element.removeAttribute('data-lazy-content');

      // Dispatch custom event
      element.dispatchEvent(new CustomEvent('contentloaded', { detail: { url } }));
    } catch (error) {
      console.error('Failed to load content:', error);
      element.classList.remove('lazy-loading');
      element.classList.add('lazy-error');
      element.innerHTML = '<p>Failed to load content</p>';
    }
  }

  /**
   * Fallback for browsers without IntersectionObserver
   */
  loadAllImmediately() {
    document.querySelectorAll('img[data-src], img[data-lazy]').forEach(img => {
      img.src = img.getAttribute('data-src') || img.getAttribute('data-lazy');
    });

    document.querySelectorAll('[data-bg]').forEach(el => {
      el.style.backgroundImage = `url('${el.getAttribute('data-bg')}')`;
    });

    document.querySelectorAll('iframe[data-src]').forEach(iframe => {
      iframe.src = iframe.getAttribute('data-src');
    });
  }

  /**
   * Observe new elements dynamically added to DOM
   */
  observeNewElements() {
    this.observeElements();
  }

  /**
   * Preload critical images
   */
  preloadImages(urls) {
    urls.forEach(url => {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'image';
      link.href = url;
      document.head.appendChild(link);
    });
  }

  /**
   * Disconnect observer
   */
  destroy() {
    if (this.observer) {
      this.observer.disconnect();
    }
  }
}

// Export singleton
const lazyLoader = new LazyLoader();
window.lazyLoader = lazyLoader;

// Auto-initialize on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    lazyLoader.observeElements();
  });
} else {
  lazyLoader.observeElements();
}

export default lazyLoader;
