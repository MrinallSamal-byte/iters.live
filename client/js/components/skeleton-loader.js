/**
 * SkeletonLoader: replace content with shimmer placeholders
 * API:
 *  - show(elementId, type?)
 *  - hide(elementId)
 *  - createSkeleton(type): 'card' | 'list' | 'table' | 'chart'
 */
class SkeletonLoader {
  constructor() {
    this.originalContent = new Map();
    this.stylesInjected = false;
    this.injectStyles();
  }

  injectStyles() {
    if (this.stylesInjected) return;
    const css = `
      .skeleton-shimmer { position: relative; overflow: hidden; background: rgba(255,255,255,0.06); }
      .skeleton-shimmer::after { content: ""; position: absolute; inset: 0; transform: translateX(-100%);
        background: linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent);
        animation: skeleton-loading 3s infinite; }
      @keyframes skeleton-loading { 0% { transform: translateX(-100%);} 100% { transform: translateX(100%);} }
      .skeleton-card { border-radius: 12px; height: 120px; margin: 8px 0; }
      .skeleton-list { display: grid; gap: 10px; }
      .skeleton-list .row { height: 16px; border-radius: 8px; }
      .skeleton-table { display: grid; gap: 8px; }
      .skeleton-table .row { height: 18px; border-radius: 6px; }
      .skeleton-chart { height: 160px; border-radius: 12px; }
    `;
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
    this.stylesInjected = true;
  }

  show(elementId, type = 'list') {
    const el = typeof elementId === 'string' ? document.getElementById(elementId) : elementId;
    if (!el) return;
    if (!this.originalContent.has(el)) {
      this.originalContent.set(el, el.innerHTML);
    }
    el.setAttribute('aria-busy', 'true');
    el.innerHTML = '';
    el.appendChild(this.createSkeleton(type));
  }

  hide(elementId) {
    const el = typeof elementId === 'string' ? document.getElementById(elementId) : elementId;
    if (!el) return;
    el.removeAttribute('aria-busy');
    if (this.originalContent.has(el)) {
      el.innerHTML = this.originalContent.get(el);
      this.originalContent.delete(el);
    } else {
      el.innerHTML = '';
    }
  }

  createSkeleton(type = 'list') {
    const wrapper = document.createElement('div');
    switch (type) {
      case 'card':
        wrapper.className = 'skeleton-shimmer skeleton-card';
        break;
      case 'table': {
        wrapper.className = 'skeleton-table';
        for (let i = 0; i < 6; i++) {
          const r = document.createElement('div');
          r.className = 'skeleton-shimmer row';
          wrapper.appendChild(r);
        }
        break;
      }
      case 'chart':
        wrapper.className = 'skeleton-shimmer skeleton-chart';
        break;
      case 'list':
      default: {
        wrapper.className = 'skeleton-list';
        for (let i = 0; i < 5; i++) {
          const r = document.createElement('div');
          r.className = 'skeleton-shimmer row';
          r.style.width = `${60 + Math.floor(Math.random()*40)}%`;
          wrapper.appendChild(r);
        }
        break;
      }
    }
    return wrapper;
  }
}

// Global export
window.SkeletonLoader = SkeletonLoader;
if (typeof module !== 'undefined') module.exports = SkeletonLoader;
/**
 * Skeleton Loader Component
 * Shows placeholder content while data is loading
 */

class SkeletonLoader {
  constructor() {
    this.templates = {
      card: this.cardSkeleton,
      list: this.listSkeleton,
      table: this.tableSkeleton,
      profile: this.profileSkeleton,
      chart: this.chartSkeleton
    };
  }

  /**
   * Show skeleton for a container
   */
  show(containerId, type = 'card', count = 1) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.classList.add('skeleton-loading');
    
    const template = this.templates[type] || this.templates.card;
    const skeletons = Array(count).fill(null).map(() => template()).join('');
    
    container.innerHTML = `<div class="skeleton-wrapper">${skeletons}</div>`;
  }

  /**
   * Hide skeleton and show real content
   */
  hide(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.classList.remove('skeleton-loading');
    
    const wrapper = container.querySelector('.skeleton-wrapper');
    if (wrapper) {
      wrapper.remove();
    }
  }

  /**
   * Card skeleton template
   */
  cardSkeleton() {
    return `
      <div class="skeleton-card">
        <div class="skeleton skeleton-image"></div>
        <div class="skeleton-content">
          <div class="skeleton skeleton-title"></div>
          <div class="skeleton skeleton-text"></div>
          <div class="skeleton skeleton-text short"></div>
        </div>
      </div>
    `;
  }

  /**
   * List item skeleton template
   */
  listSkeleton() {
    return `
      <div class="skeleton-list-item">
        <div class="skeleton skeleton-avatar"></div>
        <div class="skeleton-list-content">
          <div class="skeleton skeleton-title short"></div>
          <div class="skeleton skeleton-text"></div>
        </div>
      </div>
    `;
  }

  /**
   * Table skeleton template
   */
  tableSkeleton() {
    return `
      <div class="skeleton-table">
        <div class="skeleton-table-header">
          ${Array(4).fill('<div class="skeleton skeleton-text"></div>').join('')}
        </div>
        ${Array(5).fill(`
          <div class="skeleton-table-row">
            ${Array(4).fill('<div class="skeleton skeleton-text"></div>').join('')}
          </div>
        `).join('')}
      </div>
    `;
  }

  /**
   * Profile skeleton template
   */
  profileSkeleton() {
    return `
      <div class="skeleton-profile">
        <div class="skeleton skeleton-profile-image"></div>
        <div class="skeleton skeleton-title centered"></div>
        <div class="skeleton skeleton-text centered short"></div>
        <div class="skeleton-profile-stats">
          ${Array(3).fill(`
            <div class="skeleton-stat">
              <div class="skeleton skeleton-number"></div>
              <div class="skeleton skeleton-text short"></div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  /**
   * Chart skeleton template
   */
  chartSkeleton() {
    return `
      <div class="skeleton-chart">
        <div class="skeleton skeleton-title"></div>
        <div class="skeleton-chart-bars">
          ${Array(6).fill(null).map((_, i) => `
            <div class="skeleton-chart-bar" style="height: ${30 + Math.random() * 60}%">
              <div class="skeleton skeleton-bar"></div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  /**
   * Create inline skeleton
   */
  createInline(type = 'text', className = '') {
    return `<div class="skeleton skeleton-${type} ${className}"></div>`;
  }
}

// Export singleton
const skeletonLoader = new SkeletonLoader();
window.skeletonLoader = skeletonLoader;

export default skeletonLoader;
