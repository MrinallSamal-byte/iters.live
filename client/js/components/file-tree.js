/**
 * File Tree Component
 * Hierarchical folder navigation with drag-drop support
 */

class FileTree {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      throw new Error(`Container ${containerId} not found`);
    }

    this.options = {
      apiUrl: '/api/files',
      allowDragDrop: true,
      allowRename: true,
      allowDelete: true,
      onFolderClick: null,
      onFileClick: null,
      ...options
    };

    this.folders = [];
    this.files = [];
    this.currentFolder = null;
    this.expandedFolders = new Set();

    this.init();
  }

  /**
   * Initialize the file tree
   */
  async init() {
    this.render();
    await this.loadFolders();
    if (this.options.allowDragDrop) {
      this.initDragDrop();
    }
  }

  /**
   * Render the file tree structure
   */
  render() {
    this.container.innerHTML = `
      <div class="file-tree">
        <div class="file-tree-header">
          <h3><i class="fas fa-folder-tree"></i> File Browser</h3>
          <div class="file-tree-actions">
            <button class="btn-icon" id="new-folder-btn" title="New Folder">
              <i class="fas fa-folder-plus"></i>
            </button>
            <button class="btn-icon" id="upload-file-btn" title="Upload Files">
              <i class="fas fa-upload"></i>
            </button>
            <button class="btn-icon" id="refresh-tree-btn" title="Refresh">
              <i class="fas fa-sync-alt"></i>
            </button>
          </div>
        </div>
        
        <div class="file-tree-breadcrumb" id="breadcrumb">
          <span class="breadcrumb-item" data-folder-id="null">
            <i class="fas fa-home"></i> Home
          </span>
        </div>

        <div class="file-tree-content" id="tree-content">
          <div class="loading-spinner">
            <i class="fas fa-spinner fa-spin"></i> Loading...
          </div>
        </div>
      </div>
    `;

    this.attachEventListeners();
  }

  /**
   * Attach event listeners
   */
  attachEventListeners() {
    // New folder button
    document.getElementById('new-folder-btn')?.addEventListener('click', () => {
      this.createFolder();
    });

    // Upload button
    document.getElementById('upload-file-btn')?.addEventListener('click', () => {
      if (this.options.onUploadClick) {
        this.options.onUploadClick(this.currentFolder);
      }
    });

    // Refresh button
    document.getElementById('refresh-tree-btn')?.addEventListener('click', () => {
      this.refresh();
    });

    // Breadcrumb navigation
    document.getElementById('breadcrumb')?.addEventListener('click', (e) => {
      const item = e.target.closest('.breadcrumb-item');
      if (item) {
        const folderId = item.getAttribute('data-folder-id');
        this.navigateToFolder(folderId === 'null' ? null : folderId);
      }
    });
  }

  /**
   * Load folders from API
   */
  async loadFolders() {
    try {
      const response = await fetch(`${this.options.apiUrl}/folders`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) throw new Error('Failed to load folders');

      const data = await response.json();
      this.folders = data.folders || [];
      this.renderTree();

    } catch (error) {
      console.error('Load folders error:', error);
      this.showError('Failed to load folders');
    }
  }

  /**
   * Load files for current folder
   */
  async loadFiles(folderId = null) {
    try {
      const url = folderId 
        ? `${this.options.apiUrl}?folder=${folderId}`
        : `${this.options.apiUrl}?folder=root`;

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) throw new Error('Failed to load files');

      const data = await response.json();
      this.files = data.files || [];
      this.renderTree();

    } catch (error) {
      console.error('Load files error:', error);
      this.showError('Failed to load files');
    }
  }

  /**
   * Render the tree structure
   */
  renderTree() {
    const content = document.getElementById('tree-content');
    if (!content) return;

    const currentFolders = this.folders.filter(f => 
      f.parent_id === this.currentFolder
    );

    const html = `
      ${currentFolders.length === 0 && this.files.length === 0 ? 
        '<div class="empty-state"><i class="fas fa-inbox"></i><p>No files or folders</p></div>' : ''}
      
      ${currentFolders.map(folder => this.renderFolder(folder)).join('')}
      ${this.files.map(file => this.renderFile(file)).join('')}
    `;

    content.innerHTML = html;

    // Attach item event listeners
    this.attachItemListeners();
  }

  /**
   * Render folder item
   */
  renderFolder(folder) {
    const childCount = this.folders.filter(f => f.parent_id === folder.id).length;
    
    return `
      <div class="tree-item folder-item" 
           data-id="${folder.id}" 
           data-type="folder"
           draggable="${this.options.allowDragDrop}">
        <div class="tree-item-content">
          <i class="fas fa-folder folder-icon"></i>
          <span class="tree-item-name">${this.escapeHtml(folder.name)}</span>
          ${childCount > 0 ? `<span class="item-count">${childCount}</span>` : ''}
        </div>
        <div class="tree-item-actions">
          ${this.options.allowRename ? 
            '<button class="btn-icon-sm rename-btn" title="Rename"><i class="fas fa-edit"></i></button>' : ''}
          ${this.options.allowDelete ? 
            '<button class="btn-icon-sm delete-btn" title="Delete"><i class="fas fa-trash"></i></button>' : ''}
        </div>
      </div>
    `;
  }

  /**
   * Render file item
   */
  renderFile(file) {
    const icon = this.getFileIcon(file.mime_type);
    const size = this.formatFileSize(file.size);
    
    return `
      <div class="tree-item file-item" 
           data-id="${file.id}" 
           data-type="file"
           draggable="${this.options.allowDragDrop}">
        <div class="tree-item-content">
          <i class="fas ${icon} file-icon"></i>
          <span class="tree-item-name">${this.escapeHtml(file.original_name)}</span>
          <span class="file-size">${size}</span>
        </div>
        <div class="tree-item-actions">
          <button class="btn-icon-sm download-btn" title="Download">
            <i class="fas fa-download"></i>
          </button>
          <button class="btn-icon-sm share-btn" title="Share">
            <i class="fas fa-share-alt"></i>
          </button>
          ${this.options.allowDelete ? 
            '<button class="btn-icon-sm delete-btn" title="Delete"><i class="fas fa-trash"></i></button>' : ''}
        </div>
      </div>
    `;
  }

  /**
   * Attach listeners to tree items
   */
  attachItemListeners() {
    // Folder clicks
    document.querySelectorAll('.folder-item').forEach(item => {
      item.addEventListener('click', (e) => {
        if (e.target.closest('.tree-item-actions')) return;
        const folderId = item.getAttribute('data-id');
        this.navigateToFolder(folderId);
      });
    });

    // File clicks
    document.querySelectorAll('.file-item').forEach(item => {
      item.addEventListener('click', (e) => {
        if (e.target.closest('.tree-item-actions')) return;
        const fileId = item.getAttribute('data-id');
        if (this.options.onFileClick) {
          const file = this.files.find(f => f.id === fileId);
          this.options.onFileClick(file);
        }
      });
    });

    // Rename buttons
    document.querySelectorAll('.rename-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const item = e.target.closest('.tree-item');
        const id = item.getAttribute('data-id');
        const type = item.getAttribute('data-type');
        this.renameItem(id, type);
      });
    });

    // Delete buttons
    document.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const item = e.target.closest('.tree-item');
        const id = item.getAttribute('data-id');
        const type = item.getAttribute('data-type');
        this.deleteItem(id, type);
      });
    });

    // Download buttons
    document.querySelectorAll('.download-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const item = e.target.closest('.tree-item');
        const fileId = item.getAttribute('data-id');
        this.downloadFile(fileId);
      });
    });

    // Share buttons
    document.querySelectorAll('.share-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const item = e.target.closest('.tree-item');
        const fileId = item.getAttribute('data-id');
        this.shareFile(fileId);
      });
    });
  }

  /**
   * Navigate to folder
   */
  async navigateToFolder(folderId) {
    this.currentFolder = folderId;
    await this.loadFiles(folderId);
    this.updateBreadcrumb();

    if (this.options.onFolderClick) {
      this.options.onFolderClick(folderId);
    }
  }

  /**
   * Update breadcrumb navigation
   */
  updateBreadcrumb() {
    const breadcrumb = document.getElementById('breadcrumb');
    if (!breadcrumb) return;

    const path = this.getFolderPath(this.currentFolder);
    
    const html = path.map((folder, index) => {
      const isLast = index === path.length - 1;
      return `
        <span class="breadcrumb-item ${isLast ? 'active' : ''}" 
              data-folder-id="${folder.id || 'null'}">
          ${folder.icon ? `<i class="fas ${folder.icon}"></i>` : ''} 
          ${folder.name}
          ${!isLast ? '<i class="fas fa-chevron-right"></i>' : ''}
        </span>
      `;
    }).join('');

    breadcrumb.innerHTML = html;
  }

  /**
   * Get folder path for breadcrumb
   */
  getFolderPath(folderId) {
    const path = [{ id: null, name: 'Home', icon: 'fa-home' }];
    
    if (!folderId) return path;

    let currentId = folderId;
    const visited = new Set();

    while (currentId && !visited.has(currentId)) {
      visited.add(currentId);
      const folder = this.folders.find(f => f.id === currentId);
      if (!folder) break;
      
      path.push({ id: folder.id, name: folder.name });
      currentId = folder.parent_id;
    }

    return path;
  }

  /**
   * Create new folder
   */
  async createFolder() {
    const name = prompt('Enter folder name:');
    if (!name) return;

    try {
      const response = await fetch(`${this.options.apiUrl}/folders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          name: name,
          parent_id: this.currentFolder
        })
      });

      if (!response.ok) throw new Error('Failed to create folder');

      const data = await response.json();
      this.folders.push(data.folder);
      this.renderTree();
      this.showSuccess('Folder created successfully');

    } catch (error) {
      console.error('Create folder error:', error);
      this.showError('Failed to create folder');
    }
  }

  /**
   * Rename item
   */
  async renameItem(id, type) {
    const item = type === 'folder' 
      ? this.folders.find(f => f.id === id)
      : this.files.find(f => f.id === id);

    if (!item) return;

    const currentName = type === 'folder' ? item.name : item.original_name;
    const newName = prompt('Enter new name:', currentName);
    
    if (!newName || newName === currentName) return;

    try {
      const endpoint = type === 'folder' 
        ? `${this.options.apiUrl}/folders/${id}`
        : `${this.options.apiUrl}/${id}`;

      const response = await fetch(endpoint, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ name: newName })
      });

      if (!response.ok) throw new Error('Failed to rename');

      if (type === 'folder') {
        item.name = newName;
      } else {
        item.original_name = newName;
      }

      this.renderTree();
      this.showSuccess('Renamed successfully');

    } catch (error) {
      console.error('Rename error:', error);
      this.showError('Failed to rename');
    }
  }

  /**
   * Delete item
   */
  async deleteItem(id, type) {
    const item = type === 'folder'
      ? this.folders.find(f => f.id === id)
      : this.files.find(f => f.id === id);

    if (!item) return;

    const name = type === 'folder' ? item.name : item.original_name;
    if (!confirm(`Delete "${name}"?`)) return;

    try {
      const endpoint = type === 'folder'
        ? `${this.options.apiUrl}/folders/${id}`
        : `${this.options.apiUrl}/files/${id}`;

      const response = await fetch(endpoint, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) throw new Error('Failed to delete');

      if (type === 'folder') {
        this.folders = this.folders.filter(f => f.id !== id);
      } else {
        this.files = this.files.filter(f => f.id !== id);
      }

      this.renderTree();
      this.showSuccess('Deleted successfully');

    } catch (error) {
      console.error('Delete error:', error);
      this.showError('Failed to delete');
    }
  }

  /**
   * Download file
   */
  async downloadFile(fileId) {
    try {
      window.location.href = `${this.options.apiUrl}/files/${fileId}/download`;
    } catch (error) {
      console.error('Download error:', error);
      this.showError('Failed to download file');
    }
  }

  /**
   * Share file
   */
  shareFile(fileId) {
    if (this.options.onShareClick) {
      const file = this.files.find(f => f.id === fileId);
      this.options.onShareClick(file);
    }
  }

  /**
   * Initialize drag and drop
   */
  initDragDrop() {
    let draggedItem = null;

    document.addEventListener('dragstart', (e) => {
      const item = e.target.closest('.tree-item');
      if (item) {
        draggedItem = {
          id: item.getAttribute('data-id'),
          type: item.getAttribute('data-type')
        };
        item.classList.add('dragging');
      }
    });

    document.addEventListener('dragend', (e) => {
      const item = e.target.closest('.tree-item');
      if (item) {
        item.classList.remove('dragging');
      }
      draggedItem = null;
    });

    document.addEventListener('dragover', (e) => {
      e.preventDefault();
      const folderItem = e.target.closest('.folder-item');
      if (folderItem && draggedItem) {
        folderItem.classList.add('drag-over');
      }
    });

    document.addEventListener('dragleave', (e) => {
      const folderItem = e.target.closest('.folder-item');
      if (folderItem) {
        folderItem.classList.remove('drag-over');
      }
    });

    document.addEventListener('drop', async (e) => {
      e.preventDefault();
      const folderItem = e.target.closest('.folder-item');
      
      if (folderItem && draggedItem) {
        folderItem.classList.remove('drag-over');
        const targetFolderId = folderItem.getAttribute('data-id');
        await this.moveItem(draggedItem.id, draggedItem.type, targetFolderId);
      }
    });
  }

  /**
   * Move item to folder
   */
  async moveItem(itemId, itemType, targetFolderId) {
    try {
      const endpoint = itemType === 'folder'
        ? `${this.options.apiUrl}/folders/${itemId}/move`
        : `${this.options.apiUrl}/${itemId}/move`;

      const response = await fetch(endpoint, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ folder_id: targetFolderId })
      });

      if (!response.ok) throw new Error('Failed to move');

      this.showSuccess('Moved successfully');
      this.refresh();

    } catch (error) {
      console.error('Move error:', error);
      this.showError('Failed to move item');
    }
  }

  /**
   * Refresh tree
   */
  async refresh() {
    await this.loadFolders();
    await this.loadFiles(this.currentFolder);
  }

  /**
   * Utility: Get file icon
   */
  getFileIcon(mimeType) {
    if (mimeType.startsWith('image/')) return 'fa-file-image';
    if (mimeType.startsWith('video/')) return 'fa-file-video';
    if (mimeType.startsWith('audio/')) return 'fa-file-audio';
    if (mimeType.includes('pdf')) return 'fa-file-pdf';
    if (mimeType.includes('word')) return 'fa-file-word';
    if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return 'fa-file-excel';
    if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) return 'fa-file-powerpoint';
    if (mimeType.includes('zip') || mimeType.includes('rar')) return 'fa-file-archive';
    if (mimeType.includes('text')) return 'fa-file-alt';
    return 'fa-file';
  }

  /**
   * Utility: Format file size
   */
  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * Utility: Escape HTML
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
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
      console.error('Error:', message);
    }
  }
}

// Export
window.FileTree = FileTree;
export default FileTree;
