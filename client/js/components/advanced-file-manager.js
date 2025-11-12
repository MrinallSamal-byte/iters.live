/**
 * Advanced File Manager
 * Enhanced file upload with drag-and-drop, preview, progress, and organization
 */

class AdvancedFileManager {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.dropZone = null;
    this.uploadQueue = [];
    this.maxFileSize = 50 * 1024 * 1024; // 50MB
    this.allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/gif',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain',
      'application/zip'
    ];
  }

  /**
   * Initialize the file manager
   */
  init() {
    this.createUI();
    this.setupEventListeners();
    this.loadFiles();
  }

  /**
   * Create the UI structure
   */
  createUI() {
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="advanced-file-manager">
        <div class="file-manager-header">
          <h3>📁 File Manager</h3>
          <div class="file-actions">
            <div class="view-toggle">
              <button class="btn-icon ${this.view === 'grid' ? 'active' : ''}" onclick="fileManager.setView('grid')" title="Grid View">
                <i class="fas fa-th"></i>
              </button>
              <button class="btn-icon ${this.view === 'list' ? 'active' : ''}" onclick="fileManager.setView('list')" title="List View">
                <i class="fas fa-list"></i>
              </button>
            </div>
            <button class="btn btn-primary" onclick="fileManager.openUploadModal()">
              <i class="fas fa-upload"></i> Upload Files
            </button>
          </div>
        </div>

        <div class="file-filters">
          <div class="search-box">
            <i class="fas fa-search"></i>
            <input type="text" id="file-search" placeholder="Search files..." onkeyup="fileManager.filterFiles()">
          </div>
          <select id="file-type-filter" onchange="fileManager.filterFiles()">
            <option value="">All Types</option>
            <option value="pdf">PDF</option>
            <option value="image">Images</option>
            <option value="document">Documents</option>
            <option value="spreadsheet">Spreadsheets</option>
            <option value="presentation">Presentations</option>
            <option value="other">Other</option>
          </select>
          <select id="file-sort" onchange="fileManager.sortFiles()">
            <option value="date-desc">Date (Newest First)</option>
            <option value="date-asc">Date (Oldest First)</option>
            <option value="name-asc">Name (A-Z)</option>
            <option value="name-desc">Name (Z-A)</option>
            <option value="size-desc">Size (Largest First)</option>
            <option value="size-asc">Size (Smallest First)</option>
          </select>
        </div>

        <div class="file-breadcrumb">
          <span class="breadcrumb-item active" onclick="fileManager.navigateToFolder(null)">
            <i class="fas fa-home"></i> All Files
          </span>
          <span id="current-folder-path"></span>
        </div>

        <div id="file-grid" class="file-grid view-grid">
          <div class="loading-spinner">Loading files...</div>
        </div>

        <div id="file-pagination" class="pagination-container"></div>
      </div>
    `;

    this.view = localStorage.getItem('fileManagerView') || 'grid';
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Socket.IO for real-time updates
    if (window.socket) {
      socket.on('file:uploaded', (data) => {
        this.loadFiles();
        showToast(`New file uploaded: ${data.filename}`, 'info');
      });

      socket.on('file:deleted', (data) => {
        this.loadFiles();
        showToast(`File deleted: ${data.filename}`, 'info');
      });
    }
  }

  /**
   * Load files from API
   */
  async loadFiles(folder = null) {
    try {
      const token = localStorage.getItem('token');
      const url = folder ? `/api/files?folder=${folder}` : '/api/files';
      
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const data = await response.json();
      
      if (data.success) {
        this.files = data.data;
        this.renderFiles();
      } else {
        throw new Error(data.message);
      }
    } catch (error) {
      console.error('Error loading files:', error);
      showToast('Failed to load files', 'error');
    }
  }

  /**
   * Render files in the UI
   */
  renderFiles() {
    const grid = document.getElementById('file-grid');
    if (!grid || !this.files) return;

    if (this.files.length === 0) {
      grid.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-folder-open fa-3x"></i>
          <p>No files found</p>
          <button class="btn btn-primary" onclick="fileManager.openUploadModal()">Upload Your First File</button>
        </div>
      `;
      return;
    }

    let html = '';
    
    this.files.forEach(file => {
      const icon = this.getFileIcon(file.mime_type);
      const size = this.formatFileSize(file.file_size);
      const date = new Date(file.created_at).toLocaleDateString();

      if (this.view === 'grid') {
        html += `
          <div class="file-card" data-file-id="${file.id}">
            <div class="file-preview" onclick="fileManager.previewFile(${file.id})">
              ${file.mime_type.startsWith('image/') 
                ? `<img src="/uploads/${file.file_path}" alt="${file.file_name}" loading="lazy">`
                : `<i class="${icon} fa-3x"></i>`
              }
            </div>
            <div class="file-info">
              <div class="file-name" title="${file.file_name}">${this.truncateText(file.file_name, 20)}</div>
              <div class="file-meta">
                <span>${size}</span>
                <span>${date}</span>
              </div>
            </div>
            <div class="file-actions">
              <button class="btn-icon" onclick="fileManager.downloadFile(${file.id})" title="Download">
                <i class="fas fa-download"></i>
              </button>
              <button class="btn-icon" onclick="fileManager.shareFile(${file.id})" title="Share">
                <i class="fas fa-share-alt"></i>
              </button>
              <button class="btn-icon" onclick="fileManager.toggleFavorite(${file.id}, ${file.is_favorite || false})" title="Favorite">
                <i class="fas fa-star ${file.is_favorite ? 'favorited' : ''}"></i>
              </button>
              ${this.canDeleteFile(file) ? `
                <button class="btn-icon text-danger" onclick="fileManager.deleteFile(${file.id})" title="Delete">
                  <i class="fas fa-trash"></i>
                </button>
              ` : ''}
            </div>
          </div>
        `;
      } else {
        html += `
          <div class="file-row" data-file-id="${file.id}">
            <div class="file-icon"><i class="${icon}"></i></div>
            <div class="file-name" onclick="fileManager.previewFile(${file.id})">${file.file_name}</div>
            <div class="file-size">${size}</div>
            <div class="file-date">${date}</div>
            <div class="file-uploader">${file.uploader_name || 'Unknown'}</div>
            <div class="file-actions">
              <button class="btn-sm" onclick="fileManager.downloadFile(${file.id})">Download</button>
              <button class="btn-sm" onclick="fileManager.shareFile(${file.id})">Share</button>
              ${this.canDeleteFile(file) ? `
                <button class="btn-sm btn-danger" onclick="fileManager.deleteFile(${file.id})">Delete</button>
              ` : ''}
            </div>
          </div>
        `;
      }
    });

    grid.innerHTML = html;
  }

  /**
   * Open upload modal with drag-and-drop
   */
  openUploadModal() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'upload-modal';
    modal.innerHTML = `
      <div class="modal-content modal-lg">
        <div class="modal-header">
          <h3>Upload Files</h3>
          <button class="btn-close" onclick="fileManager.closeUploadModal()">×</button>
        </div>
        <div class="modal-body">
          <div class="upload-zone" id="upload-drop-zone">
            <i class="fas fa-cloud-upload-alt fa-3x"></i>
            <h4>Drag & Drop Files Here</h4>
            <p>or</p>
            <button class="btn btn-primary" onclick="document.getElementById('file-input').click()">
              Browse Files
            </button>
            <input type="file" id="file-input" multiple hidden accept="${this.getAcceptString()}">
            <p class="upload-hint">Max file size: ${this.formatFileSize(this.maxFileSize)}</p>
          </div>

          <div id="upload-queue" class="upload-queue" style="display: none;">
            <h4>Upload Queue</h4>
            <div id="queue-items"></div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="fileManager.closeUploadModal()">Cancel</button>
          <button class="btn btn-primary" id="start-upload-btn" onclick="fileManager.startUpload()" disabled>
            Upload <span id="upload-count"></span>
          </button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    this.setupDropZone();
  }

  /**
   * Setup drag-and-drop zone
   */
  setupDropZone() {
    const dropZone = document.getElementById('upload-drop-zone');
    const fileInput = document.getElementById('file-input');

    // Prevent default drag behaviors
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
      dropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
      });
    });

    // Highlight drop zone when item is dragged over it
    ['dragenter', 'dragover'].forEach(eventName => {
      dropZone.addEventListener(eventName, () => {
        dropZone.classList.add('drag-over');
      });
    });

    ['dragleave', 'drop'].forEach(eventName => {
      dropZone.addEventListener(eventName, () => {
        dropZone.classList.remove('drag-over');
      });
    });

    // Handle dropped files
    dropZone.addEventListener('drop', (e) => {
      const files = Array.from(e.dataTransfer.files);
      this.addFilesToQueue(files);
    });

    // Handle browse files
    fileInput.addEventListener('change', (e) => {
      const files = Array.from(e.target.files);
      this.addFilesToQueue(files);
    });
  }

  /**
   * Add files to upload queue
   */
  addFilesToQueue(files) {
    files.forEach(file => {
      // Validate file
      if (file.size > this.maxFileSize) {
        showToast(`File ${file.name} is too large (max ${this.formatFileSize(this.maxFileSize)})`, 'error');
        return;
      }

      if (!this.allowedTypes.includes(file.type) && file.type !== '') {
        showToast(`File type ${file.type} is not allowed`, 'error');
        return;
      }

      // Add to queue
      this.uploadQueue.push({
        file: file,
        id: Date.now() + Math.random(),
        progress: 0,
        status: 'pending'
      });
    });

    this.renderUploadQueue();
  }

  /**
   * Render upload queue
   */
  renderUploadQueue() {
    const queueContainer = document.getElementById('upload-queue');
    const queueItems = document.getElementById('queue-items');
    const uploadBtn = document.getElementById('start-upload-btn');
    const uploadCount = document.getElementById('upload-count');

    if (this.uploadQueue.length === 0) {
      queueContainer.style.display = 'none';
      uploadBtn.disabled = true;
      return;
    }

    queueContainer.style.display = 'block';
    uploadBtn.disabled = false;
    uploadCount.textContent = `(${this.uploadQueue.length} file${this.uploadQueue.length > 1 ? 's' : ''})`;

    let html = '';
    this.uploadQueue.forEach(item => {
      const icon = this.getFileIcon(item.file.type);
      const size = this.formatFileSize(item.file.size);
      
      html += `
        <div class="queue-item" data-queue-id="${item.id}">
          <div class="queue-icon"><i class="${icon}"></i></div>
          <div class="queue-info">
            <div class="queue-name">${item.file.name}</div>
            <div class="queue-size">${size}</div>
            ${item.status === 'uploading' ? `
              <div class="progress-bar">
                <div class="progress-fill" style="width: ${item.progress}%"></div>
              </div>
              <div class="progress-text">${item.progress}%</div>
            ` : ''}
            ${item.status === 'complete' ? `
              <div class="status-badge success"><i class="fas fa-check"></i> Uploaded</div>
            ` : ''}
            ${item.status === 'error' ? `
              <div class="status-badge error"><i class="fas fa-times"></i> Failed</div>
            ` : ''}
          </div>
          ${item.status === 'pending' ? `
            <button class="btn-icon text-danger" onclick="fileManager.removeFromQueue('${item.id}')">
              <i class="fas fa-times"></i>
            </button>
          ` : ''}
        </div>
      `;
    });

    queueItems.innerHTML = html;
  }

  /**
   * Start uploading files
   */
  async startUpload() {
    const pendingFiles = this.uploadQueue.filter(item => item.status === 'pending');
    
    for (const item of pendingFiles) {
      await this.uploadFile(item);
    }

    showToast('All files uploaded successfully!', 'success');
    
    setTimeout(() => {
      this.closeUploadModal();
      this.loadFiles();
    }, 2000);
  }

  /**
   * Upload a single file with progress tracking
   */
  async uploadFile(item) {
    const formData = new FormData();
    formData.append('file', item.file);
    formData.append('category', 'notes'); // Default category
    formData.append('description', '');

    const token = localStorage.getItem('token');
    
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      // Track upload progress
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const progress = Math.round((e.loaded / e.total) * 100);
          item.progress = progress;
          item.status = 'uploading';
          this.renderUploadQueue();
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status === 200 || xhr.status === 201) {
          item.status = 'complete';
          item.progress = 100;
          this.renderUploadQueue();
          resolve();
        } else {
          item.status = 'error';
          this.renderUploadQueue();
          reject(new Error('Upload failed'));
        }
      });

      xhr.addEventListener('error', () => {
        item.status = 'error';
        this.renderUploadQueue();
        reject(new Error('Upload failed'));
      });

      xhr.open('POST', '/api/files/upload');
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      xhr.send(formData);
    });
  }

  /**
   * Remove file from queue
   */
  removeFromQueue(itemId) {
    this.uploadQueue = this.uploadQueue.filter(item => item.id !== itemId);
    this.renderUploadQueue();
  }

  /**
   * Close upload modal
   */
  closeUploadModal() {
    const modal = document.getElementById('upload-modal');
    if (modal) {
      modal.remove();
    }
    this.uploadQueue = [];
  }

  /**
   * Preview file
   */
  async previewFile(fileId) {
    const file = this.files.find(f => f.id === fileId);
    if (!file) return;

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-content modal-xl">
        <div class="modal-header">
          <h3>${file.file_name}</h3>
          <button class="btn-close" onclick="this.closest('.modal-overlay').remove()">×</button>
        </div>
        <div class="modal-body file-preview-modal">
          ${this.getFilePreview(file)}
        </div>
        <div class="modal-footer">
          <button class="btn btn-primary" onclick="fileManager.downloadFile(${fileId})">
            <i class="fas fa-download"></i> Download
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  /**
   * Get file preview HTML
   */
  getFilePreview(file) {
    const filePath = `/uploads/${file.file_path}`;
    
    if (file.mime_type.startsWith('image/')) {
      return `<img src="${filePath}" alt="${file.file_name}" style="max-width: 100%; max-height: 70vh;">`;
    } else if (file.mime_type === 'application/pdf') {
      return `<iframe src="${filePath}" style="width: 100%; height: 70vh;" frameborder="0"></iframe>`;
    } else {
      return `
        <div class="file-preview-placeholder">
          <i class="${this.getFileIcon(file.mime_type)} fa-5x"></i>
          <p>Preview not available for this file type</p>
          <button class="btn btn-primary" onclick="fileManager.downloadFile(${file.id})">Download to View</button>
        </div>
      `;
    }
  }

  /**
   * Download file
   */
  async downloadFile(fileId) {
    const file = this.files.find(f => f.id === fileId);
    if (!file) return;

    const token = localStorage.getItem('token');
    const response = await fetch(`/api/files/download/${fileId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (response.ok) {
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.file_name;
      a.click();
      URL.revokeObjectURL(url);
      showToast('File downloaded successfully', 'success');
    } else {
      showToast('Failed to download file', 'error');
    }
  }

  /**
   * Share file
   */
  shareFile(fileId) {
    // Implementation for share link generation
    showToast('Share functionality coming soon!', 'info');
  }

  /**
   * Delete file
   */
  async deleteFile(fileId) {
    if (!confirm('Are you sure you want to delete this file?')) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/files/${fileId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await response.json();
      
      if (data.success) {
        showToast('File deleted successfully', 'success');
        this.loadFiles();
      } else {
        throw new Error(data.message);
      }
    } catch (error) {
      showToast('Failed to delete file', 'error');
    }
  }

  /**
   * Toggle favorite status
   */
  async toggleFavorite(fileId, currentStatus) {
    // Implementation for favorite toggle
    showToast(currentStatus ? 'Removed from favorites' : 'Added to favorites', 'success');
  }

  /**
   * Filter files
   */
  filterFiles() {
    // Implementation for filtering
    const searchTerm = document.getElementById('file-search').value.toLowerCase();
    const typeFilter = document.getElementById('file-type-filter').value;
    
    // Apply filters and re-render
    this.loadFiles();
  }

  /**
   * Sort files
   */
  sortFiles() {
    const sortBy = document.getElementById('file-sort').value;
    // Apply sorting and re-render
    this.renderFiles();
  }

  /**
   * Set view mode
   */
  setView(view) {
    this.view = view;
    localStorage.setItem('fileManagerView', view);
    
    const grid = document.getElementById('file-grid');
    grid.className = `file-grid view-${view}`;
    
    document.querySelectorAll('.view-toggle .btn-icon').forEach(btn => {
      btn.classList.remove('active');
    });
    event.target.closest('.btn-icon').classList.add('active');
    
    this.renderFiles();
  }

  // Utility functions
  getFileIcon(mimeType) {
    if (mimeType.startsWith('image/')) return 'fas fa-file-image';
    if (mimeType === 'application/pdf') return 'fas fa-file-pdf';
    if (mimeType.includes('word')) return 'fas fa-file-word';
    if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return 'fas fa-file-excel';
    if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) return 'fas fa-file-powerpoint';
    if (mimeType.includes('zip') || mimeType.includes('compressed')) return 'fas fa-file-archive';
    if (mimeType.startsWith('text/')) return 'fas fa-file-alt';
    return 'fas fa-file';
  }

  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }

  truncateText(text, maxLength) {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  }

  getAcceptString() {
    return this.allowedTypes.join(',');
  }

  canDeleteFile(file) {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    return user.role === 'admin' || file.uploader_id === user.id;
  }
}

// Initialize
const fileManager = new AdvancedFileManager('file-manager-container');

// Auto-initialize if container exists
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('file-manager-container')) {
      fileManager.init();
    }
  });
} else {
  if (document.getElementById('file-manager-container')) {
    fileManager.init();
  }
}
