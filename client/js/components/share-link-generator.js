/**
 * Share Link Generator Component
 * Create and manage file share links with expiry and password protection
 */

class ShareLinkGenerator {
  constructor(fileId, options = {}) {
    this.fileId = fileId;
    this.options = {
      apiUrl: '/api/files',
      onLinkCreated: null,
      ...options
    };

    this.shareData = null;
    this.init();
  }

  /**
   * Initialize the share link generator
   */
  init() {
    this.showModal();
  }

  /**
   * Show share modal
   */
  showModal() {
    const modal = document.createElement('div');
    modal.className = 'share-modal-overlay';
    modal.innerHTML = `
      <div class="share-modal">
        <div class="share-modal-header">
          <h3><i class="fas fa-share-alt"></i> Share File</h3>
          <button class="btn-close" id="close-share-modal">
            <i class="fas fa-times"></i>
          </button>
        </div>
        
        <div class="share-modal-content">
          ${this.shareData ? this.renderShareLink() : this.renderShareForm()}
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    this.attachModalListeners(modal);
  }

  /**
   * Render share form
   */
  renderShareForm() {
    return `
      <div class="share-form">
        <div class="form-group">
          <label>
            <i class="fas fa-clock"></i> Expiry Time
          </label>
          <select id="share-expiry" class="form-control">
            <option value="">No Expiry</option>
            <option value="1">1 Hour</option>
            <option value="24">24 Hours</option>
            <option value="168">7 Days</option>
            <option value="720">30 Days</option>
            <option value="custom">Custom...</option>
          </select>
        </div>

        <div class="form-group" id="custom-expiry-group" style="display: none;">
          <label>Custom Expiry Date & Time</label>
          <input type="datetime-local" id="custom-expiry" class="form-control">
        </div>

        <div class="form-group">
          <label>
            <input type="checkbox" id="password-enabled"> 
            <i class="fas fa-lock"></i> Password Protection
          </label>
        </div>

        <div class="form-group" id="password-group" style="display: none;">
          <label>Password</label>
          <input type="password" id="share-password" class="form-control" placeholder="Enter password">
        </div>

        <div class="form-group">
          <label>
            <i class="fas fa-download"></i> Max Downloads
          </label>
          <select id="max-downloads" class="form-control">
            <option value="">Unlimited</option>
            <option value="1">1 Download</option>
            <option value="5">5 Downloads</option>
            <option value="10">10 Downloads</option>
            <option value="50">50 Downloads</option>
            <option value="100">100 Downloads</option>
          </select>
        </div>

        <div class="share-actions">
          <button class="btn btn-primary" id="generate-link-btn">
            <i class="fas fa-link"></i> Generate Share Link
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Render generated share link
   */
  renderShareLink() {
    const shareUrl = `${window.location.origin}/share/${this.shareData.share_token}`;
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(shareUrl)}`;

    return `
      <div class="share-link-container">
        <div class="share-link-success">
          <i class="fas fa-check-circle"></i>
          <h4>Share Link Created!</h4>
        </div>

        <div class="share-link-box">
          <input type="text" id="share-url" class="share-url-input" value="${shareUrl}" readonly>
          <button class="btn btn-secondary" id="copy-link-btn">
            <i class="fas fa-copy"></i> Copy
          </button>
        </div>

        <div class="share-qr-code">
          <img src="${qrCodeUrl}" alt="QR Code">
          <p>Scan QR Code to access</p>
        </div>

        <div class="share-details">
          <h5>Share Details</h5>
          <div class="share-detail-item">
            <span class="detail-label"><i class="fas fa-clock"></i> Expires:</span>
            <span class="detail-value">${this.shareData.expires_at ? new Date(this.shareData.expires_at).toLocaleString() : 'Never'}</span>
          </div>
          <div class="share-detail-item">
            <span class="detail-label"><i class="fas fa-lock"></i> Password:</span>
            <span class="detail-value">${this.shareData.password_hash ? 'Yes' : 'No'}</span>
          </div>
          <div class="share-detail-item">
            <span class="detail-label"><i class="fas fa-download"></i> Max Downloads:</span>
            <span class="detail-value">${this.shareData.max_downloads || 'Unlimited'}</span>
          </div>
          <div class="share-detail-item">
            <span class="detail-label"><i class="fas fa-chart-line"></i> Downloads:</span>
            <span class="detail-value">${this.shareData.download_count || 0}</span>
          </div>
        </div>

        <div class="share-actions">
          <button class="btn btn-danger" id="revoke-link-btn">
            <i class="fas fa-ban"></i> Revoke Link
          </button>
          <button class="btn btn-secondary" id="share-another-btn">
            <i class="fas fa-plus"></i> Create Another
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Attach modal event listeners
   */
  attachModalListeners(modal) {
    // Close button
    modal.querySelector('#close-share-modal')?.addEventListener('click', () => {
      this.closeModal(modal);
    });

    // Click outside to close
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        this.closeModal(modal);
      }
    });

    // Expiry change
    modal.querySelector('#share-expiry')?.addEventListener('change', (e) => {
      const customGroup = modal.querySelector('#custom-expiry-group');
      customGroup.style.display = e.target.value === 'custom' ? 'block' : 'none';
    });

    // Password toggle
    modal.querySelector('#password-enabled')?.addEventListener('change', (e) => {
      const passwordGroup = modal.querySelector('#password-group');
      passwordGroup.style.display = e.target.checked ? 'block' : 'none';
    });

    // Generate link
    modal.querySelector('#generate-link-btn')?.addEventListener('click', () => {
      this.generateShareLink(modal);
    });

    // Copy link
    modal.querySelector('#copy-link-btn')?.addEventListener('click', () => {
      this.copyShareLink(modal);
    });

    // Revoke link
    modal.querySelector('#revoke-link-btn')?.addEventListener('click', () => {
      this.revokeShareLink(modal);
    });

    // Create another
    modal.querySelector('#share-another-btn')?.addEventListener('click', () => {
      this.shareData = null;
      this.closeModal(modal);
      this.showModal();
    });
  }

  /**
   * Generate share link
   */
  async generateShareLink(modal) {
    const expirySelect = modal.querySelector('#share-expiry');
    const customExpiry = modal.querySelector('#custom-expiry');
    const passwordEnabled = modal.querySelector('#password-enabled').checked;
    const password = modal.querySelector('#share-password')?.value;
    const maxDownloads = modal.querySelector('#max-downloads').value;

    // Calculate expiry
    let expiresAt = null;
    if (expirySelect.value === 'custom') {
      expiresAt = customExpiry.value ? new Date(customExpiry.value).toISOString() : null;
    } else if (expirySelect.value) {
      const hours = parseInt(expirySelect.value);
      expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
    }

    // Validate password if enabled
    if (passwordEnabled && !password) {
      this.showError('Please enter a password');
      return;
    }

    try {
      const response = await fetch(`${this.options.apiUrl}/files/${this.fileId}/share`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          expires_at: expiresAt,
          password: passwordEnabled ? password : null,
          max_downloads: maxDownloads ? parseInt(maxDownloads) : null
        })
      });

      if (!response.ok) throw new Error('Failed to generate share link');

      const data = await response.json();
      this.shareData = data.share;

      // Update modal content
      const content = modal.querySelector('.share-modal-content');
      content.innerHTML = this.renderShareLink();
      this.attachModalListeners(modal);

      if (this.options.onLinkCreated) {
        this.options.onLinkCreated(this.shareData);
      }

    } catch (error) {
      console.error('Generate share link error:', error);
      this.showError('Failed to generate share link');
    }
  }

  /**
   * Copy share link to clipboard
   */
  async copyShareLink(modal) {
    const urlInput = modal.querySelector('#share-url');
    
    try {
      await navigator.clipboard.writeText(urlInput.value);
      this.showSuccess('Link copied to clipboard!');
      
      // Visual feedback
      const btn = modal.querySelector('#copy-link-btn');
      const originalHTML = btn.innerHTML;
      btn.innerHTML = '<i class="fas fa-check"></i> Copied!';
      btn.classList.add('copied');
      
      setTimeout(() => {
        btn.innerHTML = originalHTML;
        btn.classList.remove('copied');
      }, 2000);

    } catch (error) {
      // Fallback for older browsers
      urlInput.select();
      document.execCommand('copy');
      this.showSuccess('Link copied to clipboard!');
    }
  }

  /**
   * Revoke share link
   */
  async revokeShareLink(modal) {
    if (!confirm('Are you sure you want to revoke this share link?')) {
      return;
    }

    try {
      const response = await fetch(`${this.options.apiUrl}/files/${this.fileId}/share/${this.shareData.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) throw new Error('Failed to revoke share link');

      this.showSuccess('Share link revoked successfully');
      this.closeModal(modal);

    } catch (error) {
      console.error('Revoke share link error:', error);
      this.showError('Failed to revoke share link');
    }
  }

  /**
   * Close modal
   */
  closeModal(modal) {
    modal.classList.add('closing');
    setTimeout(() => {
      modal.remove();
    }, 300);
  }

  /**
   * Show success message
   */
  showSuccess(message) {
    if (window.showToast) {
      window.showToast(message, 'success');
    } else {
      console.log('Success:', message);
    }
  }

  /**
   * Show error message
   */
  showError(message) {
    if (window.showToast) {
      window.showToast(message, 'error');
    } else {
      alert(message);
    }
  }
}

// Export
window.ShareLinkGenerator = ShareLinkGenerator;
export default ShareLinkGenerator;
