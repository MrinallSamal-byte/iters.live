/**
 * Advanced File Uploader Component
 * Features: Drag-drop, chunked uploads, progress tracking, preview
 */

class FileUploader {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      throw new Error(`Container ${containerId} not found`);
    }

    this.options = {
      maxFileSize: 100 * 1024 * 1024, // 100MB default
      chunkSize: 5 * 1024 * 1024, // 5MB chunks
      allowedTypes: ['*/*'], // Allow all by default
      maxFiles: 10,
      uploadUrl: '/api/files/upload',
      chunkedUploadUrl: '/api/files/upload-chunk',
      previewImages: true,
      autoUpload: false,
      ...options
    };

    this.files = [];
    this.uploadQueue = [];
    this.activeUploads = new Map();

    this.init();
  }

  /**
   * Initialize the uploader
   */
  init() {
    this.render();
    this.attachEventListeners();
  }

  /**
   * Render the upload UI
   */
  render() {
    this.container.innerHTML = `
      <div class="file-uploader">
        <div class="upload-drop-zone" id="drop-zone">
          <div class="upload-icon">
            <i class="fas fa-cloud-upload-alt"></i>
          </div>
          <h3>Drag & Drop Files Here</h3>
          <p>or click to browse</p>
          <input 
            type="file" 
            id="file-input" 
            multiple 
            accept="${this.options.allowedTypes.join(',')}"
            style="display: none;"
          >
          <button class="btn btn-primary" onclick="document.getElementById('file-input').click()">
            <i class="fas fa-folder-open"></i> Browse Files
          </button>
        </div>

        <div class="upload-queue" id="upload-queue" style="display: none;">
          <div class="queue-header">
            <h4>Files to Upload (<span id="file-count">0</span>)</h4>
            <div class="queue-actions">
              <button class="btn btn-success btn-sm" id="upload-all">
                <i class="fas fa-upload"></i> Upload All
              </button>
              <button class="btn btn-danger btn-sm" id="clear-all">
                <i class="fas fa-trash"></i> Clear All
              </button>
            </div>
          </div>
          <div class="queue-list" id="queue-list"></div>
        </div>
      </div>
    `;
  }

  /**
   * Attach event listeners
   */
  attachEventListeners() {
    const dropZone = this.container.querySelector('#drop-zone');
    const fileInput = this.container.querySelector('#file-input');
    const uploadAllBtn = this.container.querySelector('#upload-all');
    const clearAllBtn = this.container.querySelector('#clear-all');

    // Drag and drop events
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
      dropZone.addEventListener(eventName, this.preventDefaults, false);
    });

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

    dropZone.addEventListener('drop', this.handleDrop.bind(this));

    // File input change
    fileInput.addEventListener('change', (e) => {
      this.handleFiles(Array.from(e.target.files));
    });

    // Bulk actions
    if (uploadAllBtn) {
      uploadAllBtn.addEventListener('click', () => this.uploadAll());
    }

    if (clearAllBtn) {
      clearAllBtn.addEventListener('click', () => this.clearAll());
    }
  }

  /**
   * Prevent default drag behaviors
   */
  preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  /**
   * Handle dropped files
   */
  handleDrop(e) {
    const dt = e.dataTransfer;
    const files = Array.from(dt.files);
    this.handleFiles(files);
  }

  /**
   * Handle selected/dropped files
   */
  handleFiles(files) {
    // Validate file count
    if (this.files.length + files.length > this.options.maxFiles) {
      this.showError(`Maximum ${this.options.maxFiles} files allowed`);
      return;
    }

    // Validate and add files
    const validFiles = files.filter(file => this.validateFile(file));
    
    validFiles.forEach(file => {
      const fileObj = {
        id: this.generateId(),
        file: file,
        name: file.name,
        size: file.size,
        type: file.type,
        status: 'pending',
        progress: 0,
        preview: null
      };

      this.files.push(fileObj);
      
      // Generate preview for images
      if (this.options.previewImages && file.type.startsWith('image/')) {
        this.generatePreview(fileObj);
      }
    });

    this.updateUI();

    // Auto-upload if enabled
    if (this.options.autoUpload && validFiles.length > 0) {
      this.uploadAll();
    }
  }

  /**
   * Validate individual file
   */
  validateFile(file) {
    // Check file size
    if (file.size > this.options.maxFileSize) {
      this.showError(`${file.name} exceeds maximum size of ${this.formatFileSize(this.options.maxFileSize)}`);
      return false;
    }

    // Check file type
    if (this.options.allowedTypes[0] !== '*/*') {
      const isAllowed = this.options.allowedTypes.some(type => {
        if (type.endsWith('/*')) {
          return file.type.startsWith(type.replace('/*', '/'));
        }
        return file.type === type;
      });

      if (!isAllowed) {
        this.showError(`${file.name} type not allowed`);
        return false;
      }
    }

    return true;
  }

  /**
   * Generate image preview
   */
  generatePreview(fileObj) {
    const reader = new FileReader();
    reader.onload = (e) => {
      fileObj.preview = e.target.result;
      this.updateFileItem(fileObj.id);
    };
    reader.readAsDataURL(fileObj.file);
  }

  /**
   * Update UI with current files
   */
  updateUI() {
    const queueContainer = this.container.querySelector('#upload-queue');
    const queueList = this.container.querySelector('#queue-list');
    const fileCount = this.container.querySelector('#file-count');

    if (this.files.length === 0) {
      queueContainer.style.display = 'none';
      return;
    }

    queueContainer.style.display = 'block';
    fileCount.textContent = this.files.length;

    queueList.innerHTML = this.files.map(file => this.renderFileItem(file)).join('');

    // Attach remove buttons
    this.files.forEach(file => {
      const removeBtn = this.container.querySelector(`#remove-${file.id}`);
      if (removeBtn) {
        removeBtn.addEventListener('click', () => this.removeFile(file.id));
      }
    });
  }

  /**
   * Render individual file item
   */
  renderFileItem(fileObj) {
    const statusIcon = this.getStatusIcon(fileObj.status);
    const progressBar = fileObj.status === 'uploading' 
      ? `<div class="upload-progress-bar">
           <div class="progress-fill" style="width: ${fileObj.progress}%"></div>
         </div>`
      : '';

    return `
      <div class="upload-item" id="item-${fileObj.id}">
        ${fileObj.preview ? `<img src="${fileObj.preview}" class="file-preview" alt="${fileObj.name}">` : ''}
        <div class="file-info">
          <div class="file-name">${fileObj.name}</div>
          <div class="file-meta">
            <span class="file-size">${this.formatFileSize(fileObj.size)}</span>
            <span class="file-status ${fileObj.status}">${statusIcon} ${fileObj.status}</span>
          </div>
          ${progressBar}
        </div>
        <button class="btn-icon btn-remove" id="remove-${fileObj.id}">
          <i class="fas fa-times"></i>
        </button>
      </div>
    `;
  }

  /**
   * Update specific file item
   */
  updateFileItem(fileId) {
    const fileObj = this.files.find(f => f.id === fileId);
    if (!fileObj) return;

    const item = this.container.querySelector(`#item-${fileId}`);
    if (item) {
      item.outerHTML = this.renderFileItem(fileObj);
    }
  }

  /**
   * Get status icon
   */
  getStatusIcon(status) {
    const icons = {
      pending: '<i class="fas fa-clock"></i>',
      uploading: '<i class="fas fa-spinner fa-spin"></i>',
      success: '<i class="fas fa-check-circle"></i>',
      error: '<i class="fas fa-exclamation-circle"></i>'
    };
    return icons[status] || '';
  }

  /**
   * Upload all pending files
   */
  async uploadAll() {
    const pendingFiles = this.files.filter(f => f.status === 'pending');
    
    for (const fileObj of pendingFiles) {
      await this.uploadFile(fileObj);
    }
  }

  /**
   * Upload individual file
   */
  async uploadFile(fileObj) {
    const file = fileObj.file;
    
    // Use chunked upload for large files
    if (file.size > this.options.chunkSize * 2) {
      return this.uploadChunked(fileObj);
    } else {
      return this.uploadDirect(fileObj);
    }
  }

  /**
   * Direct upload for small files
   */
  async uploadDirect(fileObj) {
    fileObj.status = 'uploading';
    this.updateFileItem(fileObj.id);

    const formData = new FormData();
    formData.append('file', fileObj.file);
    formData.append('filename', fileObj.name);

    try {
      const response = await fetch(this.options.uploadUrl, {
        method: 'POST',
        body: formData,
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) throw new Error('Upload failed');

      const result = await response.json();
      
      fileObj.status = 'success';
      fileObj.progress = 100;
      fileObj.uploadedData = result;
      
      this.updateFileItem(fileObj.id);
      this.onUploadSuccess(fileObj, result);
      
    } catch (error) {
      fileObj.status = 'error';
      this.updateFileItem(fileObj.id);
      this.onUploadError(fileObj, error);
    }
  }

  /**
   * Chunked upload for large files
   */
  async uploadChunked(fileObj) {
    fileObj.status = 'uploading';
    this.updateFileItem(fileObj.id);

    const file = fileObj.file;
    const chunks = Math.ceil(file.size / this.options.chunkSize);
    const uploadId = this.generateId();

    try {
      for (let i = 0; i < chunks; i++) {
        const start = i * this.options.chunkSize;
        const end = Math.min(start + this.options.chunkSize, file.size);
        const chunk = file.slice(start, end);

        const formData = new FormData();
        formData.append('chunk', chunk);
        formData.append('chunkIndex', i);
        formData.append('totalChunks', chunks);
        formData.append('uploadId', uploadId);
        formData.append('filename', fileObj.name);

        const response = await fetch(this.options.chunkedUploadUrl, {
          method: 'POST',
          body: formData,
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });

        if (!response.ok) throw new Error(`Chunk ${i + 1} upload failed`);

        // Update progress
        fileObj.progress = Math.round(((i + 1) / chunks) * 100);
        this.updateFileItem(fileObj.id);
      }

      const result = await response.json();
      
      fileObj.status = 'success';
      fileObj.progress = 100;
      fileObj.uploadedData = result;
      
      this.updateFileItem(fileObj.id);
      this.onUploadSuccess(fileObj, result);
      
    } catch (error) {
      fileObj.status = 'error';
      this.updateFileItem(fileObj.id);
      this.onUploadError(fileObj, error);
    }
  }

  /**
   * Remove file from queue
   */
  removeFile(fileId) {
    this.files = this.files.filter(f => f.id !== fileId);
    this.updateUI();
  }

  /**
   * Clear all files
   */
  clearAll() {
    this.files = [];
    this.updateUI();
  }

  /**
   * Callbacks
   */
  onUploadSuccess(fileObj, result) {
    console.log('Upload success:', fileObj.name, result);
    if (this.options.onSuccess) {
      this.options.onSuccess(fileObj, result);
    }
  }

  onUploadError(fileObj, error) {
    console.error('Upload error:', fileObj.name, error);
    if (this.options.onError) {
      this.options.onError(fileObj, error);
    }
  }

  /**
   * Utility methods
   */
  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }

  generateId() {
    return `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  showError(message) {
    // Use toast notification if available
    if (window.showToast) {
      window.showToast(message, 'error');
    } else {
      alert(message);
    }
  }
}

// Export
window.FileUploader = FileUploader;
export default FileUploader;
