/**
 * Profile Component JavaScript
 * Handles dropdown, photo upload, profile editing, and ID card modal
 */

class ProfileControl {
    constructor() {
        this.currentUser = null;
        this.socket = null;
        this.dropdownOpen = false;
        
        // DOM elements
        this.avatarBtn = document.getElementById('profileAvatarBtn');
        this.dropdown = document.getElementById('profileDropdown');
        this.avatarImg = document.getElementById('profileAvatarImg');
        this.dropdownAvatarImg = document.getElementById('dropdownAvatarImg');
        this.profileName = document.getElementById('profileName');
        this.profileRegNo = document.getElementById('profileRegNo');
        
        // Menu items
        this.viewProfileBtn = document.getElementById('viewProfileBtn');
        this.showIdCardBtn = document.getElementById('showIdCardBtn');
        this.changePhotoInput = document.getElementById('changePhotoInput');
        this.settingsBtn = document.getElementById('settingsBtn');
        this.logoutBtn = document.getElementById('logoutBtn');
        
        // Profile edit panel
        this.editPanel = document.getElementById('profileEditPanel');
        this.editForm = document.getElementById('profileEditForm');
        this.closePanelBtn = document.getElementById('closePanelBtn');
        this.cancelEditBtn = document.getElementById('cancelEditBtn');
        
        // ID Card modal
        this.idCardModal = document.getElementById('idCardModal');
        this.closeIdCardBtn = document.getElementById('closeIdCardBtn');
        
        // Upload progress
        this.uploadProgressContainer = document.getElementById('uploadProgressContainer');
        this.uploadProgressFill = document.getElementById('uploadProgressFill');
        this.uploadProgressPercent = document.getElementById('uploadProgressPercent');
        this.uploadProgressText = document.getElementById('uploadProgressText');
        
        // Success animation
        this.successContainer = document.getElementById('successAnimationContainer');
        this.successMessage = document.getElementById('successMessage');
        
        this.init();
    }
    
    /**
     * Initialize the profile control
     */
    async init() {
        try {
            // Load user data
            await this.loadUserProfile();
            
            // Setup event listeners
            this.setupEventListeners();
            
            // Initialize socket connection
            this.initSocket();
            
            console.log('✓ Profile control initialized');
        } catch (error) {
            console.error('Failed to initialize profile control:', error);
        }
    }
    
    /**
     * Load current user profile
     */
    async loadUserProfile() {
        try {
            const token = this.getAuthToken();
            let data = null;
            if (token) {
                try {
                    const response = await fetch('/api/users/me', {
                        headers: {
                            'Authorization': `Bearer ${token}`
                        }
                    });
                    if (response.ok) {
                        data = await response.json();
                    }
                } catch (e) {
                    // ignore; will fallback below
                }
            }

            if (data && data.data) {
                this.currentUser = data.data;
            } else {
                // Fallback: prototype/demo user from storage
                const stored = (function() {
                    try { return JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user') || 'null'); } catch(e) { return null; }
                })();
                this.currentUser = stored || {
                    name: 'Student User',
                    registration_number: 'CSE-XXXX',
                    profile_pic: '/uploads/avatars/default-avatar.svg'
                };
            }

            // Update UI
            this.updateProfileUI();
            
        } catch (error) {
            console.error('Load profile error:', error);
            // Still show a basic profile in prototype mode
            if (!this.currentUser) {
                this.currentUser = {
                    name: 'Student User',
                    registration_number: 'CSE-XXXX',
                    profile_pic: '/uploads/avatars/default-avatar.svg'
                };
                this.updateProfileUI();
            }
        }
    }
    
    /**
     * Update profile UI elements
     */
    updateProfileUI() {
        if (!this.currentUser) return;
        
        const { name, registration_number, profile_pic } = this.currentUser;
        
        // Update avatar images
        if (profile_pic) {
            this.avatarImg.src = profile_pic;
            this.dropdownAvatarImg.src = profile_pic;
        }
        
        // Update name and reg no
        this.profileName.textContent = name;
        this.profileRegNo.textContent = registration_number;
    }
    
    /**
     * Setup all event listeners
     */
    setupEventListeners() {
        // Avatar button click - toggle dropdown
        this.avatarBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleDropdown();
        });
        
        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (this.dropdownOpen && !this.dropdown.contains(e.target) && e.target !== this.avatarBtn) {
                this.closeDropdown();
            }
        });
        
        // Keyboard navigation for dropdown
        this.avatarBtn.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.toggleDropdown();
            }
        });
        
        // Close dropdown on Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (this.dropdownOpen) {
                    this.closeDropdown();
                    this.avatarBtn.focus();
                }
                if (this.editPanel.getAttribute('aria-hidden') === 'false') {
                    this.closeEditPanel();
                }
                if (this.idCardModal.getAttribute('aria-hidden') === 'false') {
                    this.closeIdCardModal();
                }
            }
        });
        
        // Menu item clicks
        this.viewProfileBtn?.addEventListener('click', () => {
            this.closeDropdown();
            this.openEditPanel();
        });
        
        this.showIdCardBtn?.addEventListener('click', () => {
            this.closeDropdown();
            this.openIdCardModal();
        });
        
        this.changePhotoInput?.addEventListener('change', (e) => {
            this.handlePhotoUpload(e);
        });
        
        this.settingsBtn?.addEventListener('click', () => {
            this.closeDropdown();
            window.location.href = '/settings.html';
        });
        
        this.logoutBtn?.addEventListener('click', () => {
            this.handleLogout();
        });
        
        // Edit panel
        this.closePanelBtn?.addEventListener('click', () => this.closeEditPanel());
        this.cancelEditBtn?.addEventListener('click', () => this.closeEditPanel());
        this.editPanel?.querySelector('.profile-panel-overlay')?.addEventListener('click', () => this.closeEditPanel());
        
        this.editForm?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleProfileUpdate();
        });
        
        // ID Card modal
        this.closeIdCardBtn?.addEventListener('click', () => this.closeIdCardModal());
        this.idCardModal?.querySelector('.idcard-modal-backdrop')?.addEventListener('click', () => this.closeIdCardModal());
        
        const downloadBtn = document.getElementById('downloadIdCardBtn');
        downloadBtn?.addEventListener('click', () => this.downloadAdmitCard());
        
        const printBtn = document.getElementById('printIdCardBtn');
        printBtn?.addEventListener('click', () => this.printAdmitCard());
        
        const retryBtn = document.getElementById('retryLoadIdCard');
        retryBtn?.addEventListener('click', () => this.loadAdmitCard());
    }
    
    /**
     * Initialize Socket.IO connection
     */
    initSocket() {
        const token = this.getAuthToken();
        if (!token) return;
        
        try {
            this.socket = io({
                auth: { token }
            });
            
            this.socket.on('connect', () => {
                console.log('✓ Socket connected');
                
                // Join user-specific room
                if (this.currentUser) {
                    this.socket.emit('join:department', {
                        department: this.currentUser.department,
                        year: this.currentUser.year,
                        section: this.currentUser.section
                    });
                }
            });
            
            // Listen for profile photo changes
            this.socket.on('user:photo:changed', (data) => {
                if (data.userId === this.currentUser?.id) {
                    this.handlePhotoChanged(data.profile_pic);
                }
            });
            
            // Listen for profile updates
            this.socket.on('user:updated', (data) => {
                if (data.userId === this.currentUser?.id) {
                    this.handleProfileUpdated(data);
                }
            });
            
            // Listen for admit card uploads
            this.socket.on('admitcard:uploaded', (data) => {
                this.showNotification('New admit card available!', 'success');
            });
            
            this.socket.on('disconnect', () => {
                console.log('Socket disconnected');
            });
            
        } catch (error) {
            console.error('Socket initialization error:', error);
        }
    }
    
    /**
     * Toggle dropdown open/close
     */
    toggleDropdown() {
        if (this.dropdownOpen) {
            this.closeDropdown();
        } else {
            this.openDropdown();
        }
    }
    
    /**
     * Open dropdown menu
     */
    openDropdown() {
        this.dropdown.setAttribute('aria-hidden', 'false');
        this.avatarBtn.setAttribute('aria-expanded', 'true');
        this.dropdownOpen = true;
        
        // Focus first menu item
        setTimeout(() => {
            this.dropdown.querySelector('.profile-menu-item')?.focus();
        }, 100);
    }
    
    /**
     * Close dropdown menu
     */
    closeDropdown() {
        this.dropdown.setAttribute('aria-hidden', 'true');
        this.avatarBtn.setAttribute('aria-expanded', 'false');
        this.dropdownOpen = false;
    }
    
    /**
     * Open profile edit panel
     */
    openEditPanel() {
        if (!this.currentUser) return;
        
        // Populate form
        document.getElementById('editName').value = this.currentUser.name || '';
        document.getElementById('editPhone').value = this.currentUser.phone || '';
        document.getElementById('editDepartment').value = this.currentUser.department || '';
        document.getElementById('editYear').value = this.currentUser.year || '1';
        document.getElementById('editSection').value = this.currentUser.section || 'A';
        
        // Show panel
        this.editPanel.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
        
        // Focus first input
        setTimeout(() => {
            document.getElementById('editName')?.focus();
        }, 300);
    }
    
    /**
     * Close profile edit panel
     */
    closeEditPanel() {
        this.editPanel.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
    }
    
    /**
     * Handle profile update form submission
     */
    async handleProfileUpdate() {
        const saveBtn = document.getElementById('saveProfileBtn');
        if (!saveBtn) return;
        
        try {
            // Show loading
            saveBtn.classList.add('loading');
            saveBtn.disabled = true;
            
            const formData = {
                name: document.getElementById('editName').value.trim(),
                phone: document.getElementById('editPhone').value.trim(),
                department: document.getElementById('editDepartment').value,
                year: parseInt(document.getElementById('editYear').value),
                section: document.getElementById('editSection').value
            };
            
            const token = this.getAuthToken();
            const response = await fetch('/api/users/me', {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Failed to update profile');
            }
            
            // Update current user
            this.currentUser = data.data;
            this.updateProfileUI();
            
            // Close panel
            this.closeEditPanel();
            
            // Show success
            this.showSuccess('Profile updated successfully!');
            
        } catch (error) {
            console.error('Profile update error:', error);
            alert(error.message);
        } finally {
            const saveBtn = document.getElementById('saveProfileBtn');
            saveBtn?.classList.remove('loading');
            if (saveBtn) saveBtn.disabled = false;
        }
    }
    
    /**
     * Handle photo upload
     */
    async handlePhotoUpload(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        // Validate file type
        const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
        if (!validTypes.includes(file.type)) {
            alert('Please select a valid image file (JPG, PNG, WEBP, or GIF)');
            return;
        }
        
        // Validate file size (2MB)
        if (file.size > 2 * 1024 * 1024) {
            alert('Image size must be less than 2MB');
            return;
        }
        
        this.closeDropdown();
        
        try {
            // Show upload progress
            this.showUploadProgress();
            
            // Create form data
            const formData = new FormData();
            formData.append('avatar', file);
            
            const token = this.getAuthToken();
            
            // Upload with XHR for progress tracking
            await this.uploadWithProgress(formData, token);
            
            // Clear file input
            this.changePhotoInput.value = '';
            
        } catch (error) {
            console.error('Photo upload error:', error);
            this.hideUploadProgress();
            alert(error.message || 'Failed to upload photo');
        }
    }
    
    /**
     * Upload file with progress tracking
     */
    uploadWithProgress(formData, token) {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            
            // Progress event
            xhr.upload.addEventListener('progress', (e) => {
                if (e.lengthComputable) {
                    const percent = Math.round((e.loaded / e.total) * 100);
                    this.updateUploadProgress(percent);
                }
            });
            
            // Load event
            xhr.addEventListener('load', () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    const data = JSON.parse(xhr.responseText);
                    
                    if (data.success) {
                        // Update avatar
                        const newAvatar = data.data.profile_pic;
                        this.avatarImg.src = newAvatar;
                        this.dropdownAvatarImg.src = newAvatar;
                        
                        // Update current user
                        if (this.currentUser) {
                            this.currentUser.profile_pic = newAvatar;
                        }
                        
                        // Hide progress and show success
                        setTimeout(() => {
                            this.hideUploadProgress();
                            this.showSuccess('Profile photo updated!');
                        }, 500);
                        
                        resolve(data);
                    } else {
                        reject(new Error(data.error || 'Upload failed'));
                    }
                } else {
                    const error = JSON.parse(xhr.responseText);
                    reject(new Error(error.error || 'Upload failed'));
                }
            });
            
            // Error event
            xhr.addEventListener('error', () => {
                reject(new Error('Network error during upload'));
            });
            
            // Send request
            xhr.open('POST', '/api/profile/photo');
            xhr.setRequestHeader('Authorization', `Bearer ${token}`);
            xhr.send(formData);
        });
    }
    
    /**
     * Show upload progress
     */
    showUploadProgress() {
        this.uploadProgressContainer.style.display = 'block';
        this.uploadProgressFill.style.width = '0%';
        this.uploadProgressPercent.textContent = '0%';
        this.uploadProgressText.textContent = 'Uploading photo...';
    }
    
    /**
     * Update upload progress
     */
    updateUploadProgress(percent) {
        this.uploadProgressFill.style.width = `${percent}%`;
        this.uploadProgressPercent.textContent = `${percent}%`;
        
        if (percent === 100) {
            this.uploadProgressText.textContent = 'Processing...';
        }
    }
    
    /**
     * Hide upload progress
     */
    hideUploadProgress() {
        setTimeout(() => {
            this.uploadProgressContainer.style.display = 'none';
        }, 300);
    }
    
    /**
     * Show success animation
     */
    showSuccess(message) {
        this.successMessage.textContent = message;
        this.successContainer.style.display = 'flex';
        
        // Hide after 2 seconds
        setTimeout(() => {
            this.successContainer.style.display = 'none';
        }, 2000);
    }
    
    /**
     * Show notification toast
     */
    showNotification(message, type = 'info') {
        // Simple toast notification
        const toast = document.createElement('div');
        toast.className = `notification-toast notification-${type}`;
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed;
            top: 24px;
            right: 24px;
            background: ${type === 'success' ? '#10b981' : '#6366f1'};
            color: white;
            padding: 16px 24px;
            border-radius: 12px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 10000;
            animation: slideInDown 0.3s ease;
        `;
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.style.animation = 'fadeOut 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
    
    /**
     * Handle photo changed event from socket
     */
    handlePhotoChanged(newPhotoUrl) {
        // Smooth transition
        this.avatarImg.style.opacity = '0';
        this.dropdownAvatarImg.style.opacity = '0';
        
        setTimeout(() => {
            this.avatarImg.src = newPhotoUrl;
            this.dropdownAvatarImg.src = newPhotoUrl;
            this.avatarImg.style.transition = 'opacity 0.3s ease';
            this.dropdownAvatarImg.style.transition = 'opacity 0.3s ease';
            this.avatarImg.style.opacity = '1';
            this.dropdownAvatarImg.style.opacity = '1';
        }, 150);
    }
    
    /**
     * Handle profile updated event from socket
     */
    handleProfileUpdated(data) {
        if (data.name) {
            this.profileName.textContent = data.name;
        }
        this.showNotification('Profile updated', 'success');
    }
    
    /**
     * Open ID Card modal
     */
    async openIdCardModal() {
        this.idCardModal.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
        
        // Load admit card data
        await this.loadAdmitCard();
    }
    
    /**
     * Close ID Card modal
     */
    closeIdCardModal() {
        this.idCardModal.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
    }
    
    /**
     * Load admit card data
     */
    async loadAdmitCard() {
        if (!this.currentUser) return;
        
        const loadingEl = document.getElementById('idCardLoading');
        const errorEl = document.getElementById('idCardError');
        const contentEl = document.getElementById('idCardContent');
        
        // Show loading
        loadingEl.style.display = 'flex';
        errorEl.style.display = 'none';
        contentEl.style.display = 'none';
        
        try {
            const token = this.getAuthToken();
            const response = await fetch(`/api/admitcard/${this.currentUser.id}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (!response.ok) {
                // Fallback to generic ID card for non-students or when admit card is unavailable
                this.showGenericIdCard();
                return;
            }
            
            const data = await response.json();
            const admitCard = data.data;
            
            // Make sure preview section and exam fields are visible (in case a generic view hid them earlier)
            const previewSection = document.querySelector('.idcard-preview-section');
            if (previewSection) previewSection.style.display = '';
            const showParentOf = (id) => {
                const el = document.getElementById(id);
                if (el && el.closest('.idcard-info-item')) {
                    el.closest('.idcard-info-item').style.display = '';
                }
            };
            showParentOf('idCardExamName');
            showParentOf('idCardExamCode');
            showParentOf('idCardExamDate');
            showParentOf('idCardDownloadCount');

            // Populate admit card info
            document.getElementById('idCardStudentName').textContent = admitCard.student_name || '-';
            document.getElementById('idCardRegNo').textContent = admitCard.registration_number || '-';
            document.getElementById('idCardDepartment').textContent = admitCard.department || '-';
            document.getElementById('idCardYearSection').textContent = 
                `Year ${admitCard.year} - Section ${admitCard.section}` || '-';
            document.getElementById('idCardExamName').textContent = admitCard.exam_name || '-';
            document.getElementById('idCardExamCode').textContent = admitCard.exam_code || '-';
            document.getElementById('idCardExamDate').textContent = 
                admitCard.exam_date ? new Date(admitCard.exam_date).toLocaleDateString() : '-';
            document.getElementById('idCardDownloadCount').textContent = admitCard.download_count || '0';
            document.getElementById('idCardFileSize').textContent = this.formatFileSize(admitCard.size);
            
            // Show preview based on file type
            this.showAdmitCardPreview(admitCard);
            
            // Enable buttons
            document.getElementById('downloadIdCardBtn').disabled = false;
            document.getElementById('printIdCardBtn').disabled = false;
            
            // Set title for admit card mode
            const titleEl = document.getElementById('idCardTitle');
            if (titleEl) titleEl.childNodes[1] ? titleEl.childNodes[1].textContent = 'Admit Card' : (titleEl.textContent = 'Admit Card');

            // Show content
            loadingEl.style.display = 'none';
            contentEl.style.display = 'block';
            
        } catch (error) {
            console.error('Load admit card error:', error);
            
            // On error, still show generic ID as a graceful fallback
            this.showGenericIdCard();
        }
    }

    /**
     * Show a generic ID Card for any user (teachers/admins/no admit card)
     */
    showGenericIdCard() {
        const loadingEl = document.getElementById('idCardLoading');
        const errorEl = document.getElementById('idCardError');
        const contentEl = document.getElementById('idCardContent');
        const titleEl = document.getElementById('idCardTitle');

        // Update title to ID Card
        if (titleEl) {
            // Keep the icon as first child, change the text node after it
            const textNode = Array.from(titleEl.childNodes).find(n => n.nodeType === Node.TEXT_NODE);
            if (textNode) {
                textNode.textContent = ' ID Card';
            } else {
                titleEl.appendChild(document.createTextNode(' ID Card'));
            }
        }

        // Populate basic user info
        const u = this.currentUser || {};
        const name = u.name || '-';
        const regNo = u.registration_number || u.id || '-';
        const dept = u.department || '-';
        const role = (u.role || 'user').toString().charAt(0).toUpperCase() + (u.role || 'user').toString().slice(1);
        const year = u.year ? `Year ${u.year}` : '';
        const section = u.section ? `Section ${u.section}` : '';

        const yx = (u.role === 'student')
            ? [year, section].filter(Boolean).join(' - ') || '-'
            : `Role ${role}`;

        const setText = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.textContent = val;
        };

        setText('idCardStudentName', name);
        setText('idCardRegNo', `${regNo}`);
        setText('idCardDepartment', dept);
        setText('idCardYearSection', yx);

        // Hide exam-specific fields and downloads counter
        const hideParentOf = (id) => {
            const el = document.getElementById(id);
            if (el && el.closest('.idcard-info-item')) {
                el.closest('.idcard-info-item').style.display = 'none';
            }
        };
        hideParentOf('idCardExamName');
        hideParentOf('idCardExamCode');
        hideParentOf('idCardExamDate');
        hideParentOf('idCardDownloadCount');

        // Hide the preview section entirely (no file for generic ID)
        const previewSection = document.querySelector('.idcard-preview-section');
        if (previewSection) previewSection.style.display = 'none';

        // Disable download (no file), allow print (prints the modal content)
        const downloadBtn = document.getElementById('downloadIdCardBtn');
        if (downloadBtn) downloadBtn.disabled = true;
        const printBtn = document.getElementById('printIdCardBtn');
        if (printBtn) printBtn.disabled = false;

        // Show content
        if (loadingEl) loadingEl.style.display = 'none';
        if (errorEl) errorEl.style.display = 'none';
        if (contentEl) contentEl.style.display = 'block';
    }
    
    /**
     * Show admit card preview
     */
    showAdmitCardPreview(admitCard) {
        const pdfPreview = document.getElementById('idCardPdfPreview');
        const imagePreview = document.getElementById('idCardImagePreview');
        const textPreview = document.getElementById('idCardTextPreview');
        
        // Hide all previews
        pdfPreview.style.display = 'none';
        imagePreview.style.display = 'none';
        textPreview.style.display = 'none';
        
        if (admitCard.mime === 'application/pdf') {
            document.getElementById('idCardPdfEmbed').src = admitCard.public_url;
            pdfPreview.style.display = 'block';
        } else if (admitCard.mime.startsWith('image/')) {
            document.getElementById('idCardImage').src = admitCard.public_url;
            imagePreview.style.display = 'block';
        } else {
            // Fallback: fetch and show text content
            this.loadTextContent(admitCard.public_url);
        }
    }
    
    /**
     * Load text content for preview
     */
    async loadTextContent(url) {
        try {
            const response = await fetch(url);
            const text = await response.text();
            document.getElementById('idCardTextContent').textContent = text;
            document.getElementById('idCardTextPreview').style.display = 'block';
        } catch (error) {
            console.error('Failed to load text content:', error);
        }
    }
    
    /**
     * Download admit card
     */
    async downloadAdmitCard() {
        if (!this.currentUser) return;
        
        const downloadBtn = document.getElementById('downloadIdCardBtn');
        downloadBtn.classList.add('loading');
        downloadBtn.disabled = true;
        
        try {
            const token = this.getAuthToken();
            const response = await fetch(`/api/admitcard/${this.currentUser.id}/download`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (!response.ok) {
                throw new Error('Download failed');
            }
            
            // Create blob and download
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `AdmitCard_${this.currentUser.registration_number}.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            
            this.showNotification('Admit card downloaded', 'success');
            
        } catch (error) {
            console.error('Download error:', error);
            alert('Failed to download admit card');
        } finally {
            downloadBtn.classList.remove('loading');
            downloadBtn.disabled = false;
        }
    }
    
    /**
     * Print admit card
     */
    printAdmitCard() {
        const pdfEmbed = document.getElementById('idCardPdfEmbed');
        if (pdfEmbed.src) {
            const printWindow = window.open(pdfEmbed.src, '_blank');
            if (printWindow) {
                printWindow.onload = () => {
                    printWindow.print();
                };
            }
        } else {
            window.print();
        }
    }
    
    /**
     * Handle logout
     */
    async handleLogout() {
        if (!confirm('Are you sure you want to logout?')) {
            return;
        }
        
        this.closeDropdown();
        
        try {
            const token = this.getAuthToken();
            
            // Call logout endpoint
            await fetch('/api/auth/logout', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            // Clear token
            localStorage.removeItem('token');
            sessionStorage.removeItem('token');
            
            // Disconnect socket
            if (this.socket) {
                this.socket.disconnect();
            }
            
            // Animate and redirect
            document.body.style.animation = 'fadeOut 0.3s ease';
            setTimeout(() => {
                window.location.href = '/login.html';
            }, 300);
            
        } catch (error) {
            console.error('Logout error:', error);
            // Clear token anyway
            localStorage.removeItem('token');
            window.location.href = '/login.html';
        }
    }
    
    /**
     * Get auth token from storage
     */
    getAuthToken() {
        return localStorage.getItem('token') || sessionStorage.getItem('token');
    }
    
    /**
     * Format file size
     */
    formatFileSize(bytes) {
        if (!bytes) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
    }
}

// Initialize profile control when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.profileControl = new ProfileControl();
    });
} else {
    window.profileControl = new ProfileControl();
}
