/**
 * Skeleton Loader Component
 * Provides lightweight placeholder states for classic scripts and demo pages.
 */

(function initSkeletonLoader(global) {
  class SkeletonLoader {
    constructor() {
      this.templates = {
        card: this.cardSkeleton.bind(this),
        list: this.listSkeleton.bind(this),
        table: this.tableSkeleton.bind(this),
        profile: this.profileSkeleton.bind(this),
        chart: this.chartSkeleton.bind(this)
      };
      this.stylesInjected = false;
      this.injectStyles();
    }

    injectStyles() {
      if (this.stylesInjected || document.getElementById('skeleton-loader-styles')) {
        this.stylesInjected = true;
        return;
      }

      const style = document.createElement('style');
      style.id = 'skeleton-loader-styles';
      style.textContent = `
        .skeleton-wrapper { display: grid; gap: 1rem; width: 100%; }
        .skeleton-loading { position: relative; min-height: 80px; }
        .skeleton {
          position: relative;
          overflow: hidden;
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.08);
        }
        .skeleton::after {
          content: '';
          position: absolute;
          inset: 0;
          transform: translateX(-100%);
          background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.12), transparent);
          animation: skeleton-loading 1.5s ease-in-out infinite;
        }
        .skeleton-card,
        .skeleton-list-item,
        .skeleton-profile,
        .skeleton-table-row,
        .skeleton-table-header,
        .skeleton-chart {
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 20px;
          background: rgba(255, 255, 255, 0.03);
        }
        .skeleton-card { padding: 1.25rem; display: grid; gap: 0.85rem; min-height: 148px; }
        .skeleton-image,
        .skeleton-profile-image { width: 72px; height: 72px; border-radius: 18px; }
        .skeleton-content,
        .skeleton-list-content { display: grid; gap: 0.75rem; }
        .skeleton-title { height: 20px; width: 72%; }
        .skeleton-text { height: 14px; width: 100%; }
        .skeleton-text.short { width: 58%; }
        .skeleton-text.centered,
        .skeleton-title.centered { margin-inline: auto; }
        .skeleton-list-item {
          display: grid;
          grid-template-columns: 56px 1fr;
          gap: 1rem;
          align-items: center;
          padding: 1rem 1.1rem;
        }
        .skeleton-avatar { width: 56px; height: 56px; border-radius: 50%; }
        .skeleton-table { display: grid; gap: 0.8rem; }
        .skeleton-table-header,
        .skeleton-table-row {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 0.75rem;
          padding: 0.95rem;
        }
        .skeleton-profile { padding: 1.4rem; display: grid; gap: 1rem; text-align: center; }
        .skeleton-profile-image { margin-inline: auto; width: 92px; height: 92px; border-radius: 22px; }
        .skeleton-profile-stats {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 0.85rem;
        }
        .skeleton-stat { display: grid; gap: 0.5rem; }
        .skeleton-number { height: 24px; width: 60%; margin-inline: auto; }
        .skeleton-chart { padding: 1.25rem; display: grid; gap: 1rem; }
        .skeleton-chart-bars {
          display: grid;
          grid-template-columns: repeat(6, minmax(0, 1fr));
          gap: 0.75rem;
          align-items: end;
          min-height: 160px;
        }
        .skeleton-chart-bar { display: flex; align-items: end; min-height: 100px; }
        .skeleton-bar { width: 100%; height: 100%; border-radius: 12px; }
        @keyframes skeleton-loading {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `;
      document.head.appendChild(style);
      this.stylesInjected = true;
    }

    resolveContainer(containerOrId) {
      if (typeof containerOrId === 'string') {
        return document.getElementById(containerOrId);
      }
      return containerOrId || null;
    }

    show(containerOrId, type = 'card', count = 1) {
      const container = this.resolveContainer(containerOrId);
      if (!container) return;

      container.classList.add('skeleton-loading');
      const template = this.templates[type] || this.templates.card;
      const skeletons = Array.from({ length: Math.max(1, count) }, () => template()).join('');
      container.innerHTML = `<div class="skeleton-wrapper">${skeletons}</div>`;
    }

    hide(containerOrId) {
      const container = this.resolveContainer(containerOrId);
      if (!container) return;

      container.classList.remove('skeleton-loading');
      const wrapper = container.querySelector('.skeleton-wrapper');
      if (wrapper) {
        wrapper.remove();
      }
    }

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

    chartSkeleton() {
      return `
        <div class="skeleton-chart">
          <div class="skeleton skeleton-title"></div>
          <div class="skeleton-chart-bars">
            ${Array.from({ length: 6 }, () => `
              <div class="skeleton-chart-bar" style="height: ${30 + Math.random() * 60}%">
                <div class="skeleton skeleton-bar"></div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    createInline(type = 'text', className = '') {
      return `<div class="skeleton skeleton-${type} ${className}"></div>`;
    }
  }

  const skeletonLoader = new SkeletonLoader();
  global.SkeletonLoader = SkeletonLoader;
  global.skeletonLoader = skeletonLoader;

  if (typeof module !== 'undefined') {
    module.exports = skeletonLoader;
    module.exports.SkeletonLoader = SkeletonLoader;
    module.exports.skeletonLoader = skeletonLoader;
  }
})(typeof window !== 'undefined' ? window : globalThis);
