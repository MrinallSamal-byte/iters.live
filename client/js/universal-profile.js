// Universal Profile Component - Complete Implementation
(function() {
    'use strict';

    const UniversalProfile = {
        currentUser: null,
        selectedFile: null,

        init() {
            this.createProfileMenu();
            this.loadUserData();
            this.setupEventListeners();
        },

        getInitials(name) {
            if (!name) return 'U';
            const parts = name.trim().split(' ');
            if (parts.length >= 2) {
                return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
            }
            return name[0].toUpperCase();
        },

        formatRole(role) {
            if (!role) return 'User';
            return role.charAt(0).toUpperCase() + role.slice(1);
        },

        loadUserData() {
            try {
                const user = JSON.parse(localStorage.getItem('user') || '{}');
                this.currentUser = user;
                
                const userName = user.name || 'User';
                const userRole = user.role || 'user';
                const userId = user.registration_number || user.id || '--';
                const userEmail = user.email || '--';
                const userDept = user.department || '--';
                const userYear = user.year || null;

                // Update avatar initials
                const initials = this.getInitials(userName);
                const profileAvatarInitials = document.getElementById('profileAvatarInitials');
                const profileDropdownInitials = document.getElementById('profileDropdownInitials');
                
                if (profileAvatarInitials) profileAvatarInitials.textContent = initials;
                if (profileDropdownInitials) profileDropdownInitials.textContent = initials;

                // Update dropdown info
                const profileDropdownName = document.getElementById('profileDropdownName');
                const profileDropdownRole = document.getElementById('profileDropdownRole');
                const profileDropdownId = document.getElementById('profileDropdownId');
                
                if (profileDropdownName) profileDropdownName.textContent = userName;
                if (profileDropdownRole) profileDropdownRole.textContent = this.formatRole(userRole);
                if (profileDropdownId) profileDropdownId.textContent = `ID: ${userId}`;

                // Load profile picture if exists
                this.loadProfilePicture();
            } catch (error) {
                console.error('Error loading user data:', error);
            }
        },

        loadProfilePicture() {
            const savedPicture = localStorage.getItem('profilePicture');
            if (savedPicture) {
                const profileAvatarImg = document.getElementById('profileAvatarImg');
                const profileDropdownImg = document.getElementById('profileDropdownImg');
                const profileAvatarInitials = document.getElementById('profileAvatarInitials');
                const profileDropdownInitials = document.getElementById('profileDropdownInitials');

                if (profileAvatarImg) {
                    profileAvatarImg.src = savedPicture;
                    profileAvatarImg.style.display = 'block';
                }
                if (profileDropdownImg) {
                    profileDropdownImg.src = savedPicture;
                    profileDropdownImg.style.display = 'block';
                }
                if (profileAvatarInitials) profileAvatarInitials.style.display = 'none';
                if (profileDropdownInitials) profileDropdownInitials.style.display = 'none';
            }
        },

        setupEventListeners() {
            const avatarBtn = document.getElementById('profileAvatarBtn');
            const dropdown = document.getElementById('profileDropdown');
            
            if (avatarBtn && dropdown) {
                avatarBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    dropdown.classList.toggle('active');
                });
            }

            document.addEventListener('click', (e) => {
                if (dropdown && !e.target.closest('.universal-profile')) {
                    dropdown.classList.remove('active');
                }
            });

            this.setupModalListeners();
        },

        setupModalListeners() {
            // Change Profile Picture
            const changeProfilePicBtn = document.getElementById('changeProfilePicBtn');
            if (changeProfilePicBtn) {
                changeProfilePicBtn.addEventListener('click', () => {
                    this.closeDropdown();
                    this.openModal('profilePicModal');
                });
            }

            const closeProfilePicModal = document.getElementById('closeProfilePicModal');
            if (closeProfilePicModal) {
                closeProfilePicModal.addEventListener('click', () => {
                    this.closeModal('profilePicModal');
                });
            }

            // Profile picture input
            const profilePicInput = document.getElementById('profilePicInput');
            if (profilePicInput) {
                profilePicInput.addEventListener('change', (e) => {
                    this.handleProfilePicSelect(e);
                });
            }

            const uploadProfilePicBtn = document.getElementById('uploadProfilePicBtn');
            if (uploadProfilePicBtn) {
                uploadProfilePicBtn.addEventListener('click', () => {
                    this.uploadProfilePic();
                });
            }

            // ID Card
            const viewIdCardBtn = document.getElementById('viewIdCardBtn');
            if (viewIdCardBtn) {
                viewIdCardBtn.addEventListener('click', () => {
                    this.closeDropdown();
                    this.openModal('idCardModal');
                    this.populateIdCard();
                });
            }

            const closeIdCardModal = document.getElementById('closeIdCardModal');
            if (closeIdCardModal) {
                closeIdCardModal.addEventListener('click', () => {
                    this.closeModal('idCardModal');
                });
            }

            // Settings
            const settingsBtn = document.getElementById('settingsBtn');
            if (settingsBtn) {
                settingsBtn.addEventListener('click', () => {
                    this.closeDropdown();
                    this.openModal('settingsModal');
                    this.populateSettings();
                });
            }

            const closeSettingsModal = document.getElementById('closeSettingsModal');
            if (closeSettingsModal) {
                closeSettingsModal.addEventListener('click', () => {
                    this.closeModal('settingsModal');
                });
            }

            const cancelSettingsBtn = document.getElementById('cancelSettingsBtn');
            if (cancelSettingsBtn) {
                cancelSettingsBtn.addEventListener('click', () => {
                    this.closeModal('settingsModal');
                });
            }

            const saveSettingsBtn = document.getElementById('saveSettingsBtn');
            if (saveSettingsBtn) {
                saveSettingsBtn.addEventListener('click', () => {
                    this.saveSettings();
                });
            }

            // Logout
            const logoutBtn = document.getElementById('logoutBtn');
            if (logoutBtn) {
                logoutBtn.addEventListener('click', () => {
                    this.logout();
                });
            }
        },

        closeDropdown() {
            const dropdown = document.getElementById('profileDropdown');
            if (dropdown) {
                dropdown.classList.remove('active');
            }
        },

        openModal(modalId) {
            const modal = document.getElementById(modalId);
            if (modal) {
                modal.style.display = 'flex';
            }
        },

        closeModal(modalId) {
            const modal = document.getElementById(modalId);
            if (modal) {
                modal.style.display = 'none';
            }
        },

        handleProfilePicSelect(e) {
            const file = e.target.files[0];
            if (file) {
                if (file.size > 5 * 1024 * 1024) {
                    alert('File size must be less than 5MB');
                    return;
                }

                if (!file.type.startsWith('image/')) {
                    alert('Please select an image file');
                    return;
                }

                this.selectedFile = file;
                const reader = new FileReader();
                
                reader.onload = (e) => {
                    const previewImg = document.getElementById('profilePreviewImg');
                    const placeholder = document.getElementById('profilePreviewPlaceholder');
                    const uploadBtn = document.getElementById('uploadProfilePicBtn');
                    
                    if (previewImg && placeholder && uploadBtn) {
                        previewImg.src = e.target.result;
                        previewImg.style.display = 'block';
                        placeholder.style.display = 'none';
                        uploadBtn.disabled = false;
                    }
                };
                
                reader.readAsDataURL(file);
            }
        },

        async uploadProfilePic() {
            if (!this.selectedFile) return;

            // Enforce server 2MB limit proactively
            const MAX = 2 * 1024 * 1024;
            if (this.selectedFile.size > MAX) {
                if (typeof Toast !== 'undefined') {
                    Toast.error('File too large. Max 2MB.');
                } else {
                    alert('File too large. Max 2MB.');
                }
                return;
            }

            const formData = new FormData();
            // Server expects 'avatar' field per profile.routes.js
            formData.append('avatar', this.selectedFile);

            try {
                const token = localStorage.getItem('token');
                const response = await fetch('/api/profile/photo', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    },
                    body: formData
                });

                const data = await response.json().catch(() => ({}));
                if (response.ok && data && data.success) {
                    // Prefer server public URL; fallback to data URL for immediate preview
                    if (data.data && data.data.profile_pic) {
                        localStorage.setItem('profilePicture', data.data.profile_pic);
                    } else {
                        const reader = new FileReader();
                        reader.onload = (e) => localStorage.setItem('profilePicture', e.target.result);
                        reader.readAsDataURL(this.selectedFile);
                    }
                    this.loadProfilePicture();
                    this.closeModal('profilePicModal');
                    if (typeof Toast !== 'undefined') {
                        Toast.success('Profile picture updated successfully!');
                    } else {
                        alert('Profile picture updated successfully!');
                    }
                } else {
                    const msg = (data && (data.error || data.message)) || 'Upload failed';
                    throw new Error(msg);
                }
            } catch (error) {
                console.error('Error uploading profile picture:', error);
                if (typeof Toast !== 'undefined') {
                    Toast.error(error.message || 'Failed to upload profile picture');
                } else {
                    alert(error.message || 'Failed to upload profile picture');
                }
            }
        },

        populateIdCard() {
            const user = this.currentUser || JSON.parse(localStorage.getItem('user') || '{}');
            
            const userName = user.name || 'User Name';
            const userId = user.registration_number || user.id || 'N/A';
            const userRole = this.formatRole(user.role || 'user');
            const userDept = user.department || 'N/A';
            const userYear = user.year || null;
            const userEmail = user.email || 'N/A';
            const bloodGroup = user.blood_group || 'O+';

            document.getElementById('idCardName').textContent = userName;
            document.getElementById('idCardId').textContent = userId;
            document.getElementById('idCardRole').textContent = userRole;
            document.getElementById('idCardDept').textContent = userDept;
            document.getElementById('idCardEmail').textContent = userEmail;
            document.getElementById('idCardBlood').textContent = bloodGroup;

            const idCardInitials = document.getElementById('idCardInitials');
            if (idCardInitials) {
                idCardInitials.textContent = this.getInitials(userName);
            }

            // Show year field only for students
            const yearField = document.getElementById('idCardYearField');
            const yearSpan = document.getElementById('idCardYear');
            if (user.role === 'student' && userYear && yearField && yearSpan) {
                yearField.style.display = 'flex';
                yearSpan.textContent = `Year ${userYear}`;
            } else if (yearField) {
                yearField.style.display = 'none';
            }

            // Load profile picture in ID card
            const savedPicture = localStorage.getItem('profilePicture');
            const idCardPhoto = document.getElementById('idCardPhoto');
            const idCardPhotoPlaceholder = document.getElementById('idCardPhotoPlaceholder');
            
            if (savedPicture && idCardPhoto && idCardPhotoPlaceholder) {
                idCardPhoto.src = savedPicture;
                idCardPhoto.style.display = 'block';
                idCardPhotoPlaceholder.style.display = 'none';
            } else if (idCardPhotoPlaceholder) {
                idCardPhotoPlaceholder.style.display = 'block';
            }
        },

        async downloadIdCard() {
            try {
                const node = document.getElementById('idCardContent');
                if (!node) {
                    throw new Error('ID Card element not found');
                }

                // Clone the node and inline computed styles so styles are preserved inside foreignObject
                const clone = node.cloneNode(true);

                const inlineAllStyles = (srcEl, dstEl) => {
                    const computed = window.getComputedStyle(srcEl);
                    dstEl.style.cssText = computed.cssText || Array.from(computed).map(k => `${k}: ${computed.getPropertyValue(k)};`).join('');
                    // Ensure images are visible
                    if (dstEl.tagName === 'IMG') {
                        dstEl.setAttribute('crossorigin', 'anonymous');
                    }
                    // Recurse
                    const srcChildren = Array.from(srcEl.children);
                    const dstChildren = Array.from(dstEl.children);
                    for (let i = 0; i < srcChildren.length; i++) {
                        inlineAllStyles(srcChildren[i], dstChildren[i]);
                    }
                };

                inlineAllStyles(node, clone);

                const rect = node.getBoundingClientRect();
                const width = Math.ceil(rect.width);
                const height = Math.ceil(rect.height);
                const scale = Math.min(window.devicePixelRatio || 2, 3); // limit scale to avoid huge files

                const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
                svg.setAttribute('width', String(width));
                svg.setAttribute('height', String(height));

                const foreignObject = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
                foreignObject.setAttribute('x', '0');
                foreignObject.setAttribute('y', '0');
                foreignObject.setAttribute('width', String(width));
                foreignObject.setAttribute('height', String(height));

                const container = document.createElement('div');
                container.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
                container.style.width = width + 'px';
                container.style.height = height + 'px';
                container.appendChild(clone);
                foreignObject.appendChild(container);
                svg.appendChild(foreignObject);

                const serializer = new XMLSerializer();
                const svgString = serializer.serializeToString(svg);
                const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
                const url = URL.createObjectURL(svgBlob);

                const img = new Image();
                const canvas = document.createElement('canvas');
                canvas.width = Math.ceil(width * scale);
                canvas.height = Math.ceil(height * scale);
                const ctx = canvas.getContext('2d');
                ctx.scale(scale, scale);

                await new Promise((resolve, reject) => {
                    img.onload = () => resolve();
                    img.onerror = reject;
                    img.src = url;
                });

                ctx.fillStyle = '#0b1020'; // fallback dark bg in case transparency exists
                ctx.fillRect(0, 0, width, height);
                ctx.drawImage(img, 0, 0, width, height);
                URL.revokeObjectURL(url);

                const dataUrl = canvas.toDataURL('image/png');
                const a = document.createElement('a');
                const user = JSON.parse(localStorage.getItem('user') || '{}');
                const id = user.registration_number || user.id || 'idcard';
                a.download = `ID_Card_${id}.png`;
                a.href = dataUrl;
                document.body.appendChild(a);
                a.click();
                a.remove();

                if (typeof Toast !== 'undefined') {
                    Toast.success('ID Card downloaded');
                }
            } catch (err) {
                console.error('ID Card download failed:', err);
                if (typeof Toast !== 'undefined') {
                    Toast.error('Failed to download ID Card');
                } else {
                    alert('Failed to download ID Card');
                }
            }
        },

        populateSettings() {
            const user = this.currentUser || JSON.parse(localStorage.getItem('user') || '{}');
            
            const settingsName = document.getElementById('settingsName');
            const settingsEmail = document.getElementById('settingsEmail');
            const settingsPhone = document.getElementById('settingsPhone');
            
            if (settingsName) settingsName.value = user.name || '';
            if (settingsEmail) settingsEmail.value = user.email || '';
            if (settingsPhone) settingsPhone.value = user.phone || '';

            // Email is not editable for regular users
            if (settingsEmail) {
                settingsEmail.readOnly = true;
                settingsEmail.title = 'Email can only be changed by an admin';
            }
            if (settingsName) {
                settingsName.readOnly = true; // Name changes are admin-managed only
            }

            // Load preferences
            const emailNotifications = document.getElementById('emailNotifications');
            const pushNotifications = document.getElementById('pushNotifications');
            
            if (emailNotifications) {
                emailNotifications.checked = localStorage.getItem('emailNotifications') !== 'false';
            }
            if (pushNotifications) {
                pushNotifications.checked = localStorage.getItem('pushNotifications') !== 'false';
            }
        },

    async saveSettings() {
            const currentPassword = document.getElementById('currentPassword').value;
            const newPassword = document.getElementById('newPassword').value;
            const confirmPassword = document.getElementById('confirmPassword').value;
            const name = document.getElementById('settingsName').value;
            const email = document.getElementById('settingsEmail').value; // read-only for non-admin
            const phone = document.getElementById('settingsPhone').value;
            const emailNotifications = document.getElementById('emailNotifications').checked;
            const pushNotifications = document.getElementById('pushNotifications').checked;

            // Validate password change if attempted
            if (currentPassword || newPassword || confirmPassword) {
                if (!currentPassword) {
                    alert('Please enter your current password');
                    return;
                }
                if (newPassword !== confirmPassword) {
                    alert('New passwords do not match');
                    return;
                }
                if (newPassword.length < 6) {
                    alert('New password must be at least 6 characters');
                    return;
                }
            }

            try {
                const token = localStorage.getItem('token');
                // Update name and phone only for self via profile controller
                const updateData = { name, phone };

                const response = await fetch('/api/users/me', {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(updateData)
                });

                if (response.ok) {
                    const data = await response.json().catch(() => ({}));
                    
                    // Update localStorage
                    const user = JSON.parse(localStorage.getItem('user') || '{}');
                    user.name = name;
                    user.phone = phone;
                    localStorage.setItem('user', JSON.stringify(user));
                    localStorage.setItem('emailNotifications', emailNotifications);
                    localStorage.setItem('pushNotifications', pushNotifications);

                    this.closeModal('settingsModal');
                    
                    if (typeof Toast !== 'undefined') {
                        Toast.success('Settings updated successfully!');
                    } else {
                        alert('Settings updated successfully!');
                    }

                    // Clear password fields
                    document.getElementById('currentPassword').value = '';
                    document.getElementById('newPassword').value = '';
                    document.getElementById('confirmPassword').value = '';
                } else {
                    if (response.status === 401) {
                        if (typeof Toast !== 'undefined') {
                            Toast.error('Session expired. Please log in again.');
                        }
                        setTimeout(() => { window.location.href = '../login.html'; }, 1000);
                        return;
                    }
                    const error = await response.json().catch(() => ({}));
                    throw new Error((error && (error.error || error.message)) || 'Update failed');
                }
            } catch (error) {
                console.error('Error saving settings:', error);
                if (typeof Toast !== 'undefined') {
                    Toast.error(error.message || 'Failed to update settings');
                } else {
                    alert(error.message || 'Failed to update settings');
                }
            }
        },

        logout() {
            if (confirm('Are you sure you want to logout?')) {
                // Clear all localStorage
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                localStorage.removeItem('profilePicture');
                
                // Redirect to login
                window.location.href = '../login.html';
            }
        },

        // Method to create profile menu HTML (moved from createProfileMenu to separate concerns)
        createProfileMenu() {
            // Check if already exists
            if (document.getElementById('universalProfileContainer')) {
                return;
            }

            const profileHTML = `
                <div id="universalProfileContainer" class="universal-profile">
                    <button class="profile-avatar-btn" id="profileAvatarBtn" title="Profile Menu">
                        <img src="" alt="Profile" class="profile-avatar-img" id="profileAvatarImg" style="display: none;">
                        <span class="profile-avatar-initials" id="profileAvatarInitials">U</span>
                        <span class="profile-status-indicator"></span>
                    </button>

                    <div class="profile-dropdown" id="profileDropdown">
                        <div class="profile-dropdown-header">
                            <div class="profile-dropdown-avatar">
                                <img src="" alt="Profile" class="profile-dropdown-img" id="profileDropdownImg" style="display: none;">
                                <span class="profile-dropdown-initials" id="profileDropdownInitials">U</span>
                            </div>
                            <div class="profile-dropdown-info">
                                <div class="profile-dropdown-name" id="profileDropdownName">User</div>
                                <div class="profile-dropdown-role" id="profileDropdownRole">Role</div>
                                <div class="profile-dropdown-id" id="profileDropdownId">ID: --</div>
                            </div>
                        </div>

                        <div class="profile-dropdown-divider"></div>

                        <ul class="profile-dropdown-menu">
                            <li>
                                <button class="profile-dropdown-item" id="changeProfilePicBtn">
                                    <span class="profile-dropdown-icon">📷</span>
                                    <span>Change Profile Picture</span>
                                </button>
                            </li>
                            <li>
                                <button class="profile-dropdown-item" id="viewIdCardBtn">
                                    <span class="profile-dropdown-icon">🎫</span>
                                    <span>View ID Card</span>
                                </button>
                            </li>
                            <li>
                                <button class="profile-dropdown-item" id="settingsBtn">
                                    <span class="profile-dropdown-icon">⚙️</span>
                                    <span>Settings</span>
                                </button>
                            </li>
                            <li>
                                <div class="profile-dropdown-divider"></div>
                            </li>
                            <li>
                                <button class="profile-dropdown-item profile-dropdown-item-danger" id="logoutBtn">
                                    <span class="profile-dropdown-icon">🚪</span>
                                    <span>Logout</span>
                                </button>
                            </li>
                        </ul>
                    </div>
                </div>

                <!-- Profile Picture Upload Modal -->
                <div class="profile-modal" id="profilePicModal" style="display: none;">
                    <div class="profile-modal-content">
                        <div class="profile-modal-header">
                            <h3>Change Profile Picture</h3>
                            <button class="profile-modal-close" id="closeProfilePicModal">&times;</button>
                        </div>
                        <div class="profile-modal-body">
                            <div class="profile-upload-preview">
                                <img src="" alt="Preview" id="profilePreviewImg" style="display: none;">
                                <div class="profile-preview-placeholder" id="profilePreviewPlaceholder">
                                    <span>📷</span>
                                    <p>No image selected</p>
                                </div>
                            </div>
                            <div style="text-align: center; display: flex; gap: 10px; justify-content: center;">
                                <input type="file" id="profilePicInput" accept="image/*" style="display: none;">
                                <button class="btn btn-secondary" onclick="document.getElementById('profilePicInput').click()">
                                    Choose Image
                                </button>
                                <button class="btn btn-primary" id="uploadProfilePicBtn" disabled>
                                    Upload
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- ID Card Modal -->
                <div class="profile-modal" id="idCardModal" style="display: none;">
                    <div class="profile-modal-content profile-modal-large">
                        <div class="profile-modal-header">
                            <h3>Digital ID Card</h3>
                            <button class="profile-modal-close" id="closeIdCardModal">&times;</button>
                        </div>
                        <div class="profile-modal-body">
                            <div class="id-card" id="idCardContent">
                                <div class="id-card-header">
                                    <img src="/assets/logo.png" alt="ITER Logo" class="id-card-logo" onerror="this.style.display='none'">
                                    <div class="id-card-college">
                                        <h4>ITER - Institute of Technical Education and Research</h4>
                                        <p>Siksha 'O' Anusandhan (Deemed to be University)</p>
                                    </div>
                                </div>
                                <div class="id-card-body">
                                    <div class="id-card-photo">
                                        <img src="" alt="Photo" id="idCardPhoto" style="display: none;">
                                        <div class="id-card-photo-placeholder" id="idCardPhotoPlaceholder">
                                            <span id="idCardInitials">U</span>
                                        </div>
                                    </div>
                                    <div class="id-card-details">
                                        <div class="id-card-field">
                                            <label>Name:</label>
                                            <span id="idCardName">--</span>
                                        </div>
                                        <div class="id-card-field">
                                            <label>ID:</label>
                                            <span id="idCardId">--</span>
                                        </div>
                                        <div class="id-card-field">
                                            <label>Role:</label>
                                            <span id="idCardRole">--</span>
                                        </div>
                                        <div class="id-card-field">
                                            <label>Department:</label>
                                            <span id="idCardDept">--</span>
                                        </div>
                                        <div class="id-card-field" id="idCardYearField" style="display: none;">
                                            <label>Year:</label>
                                            <span id="idCardYear">--</span>
                                        </div>
                                        <div class="id-card-field">
                                            <label>Email:</label>
                                            <span id="idCardEmail">--</span>
                                        </div>
                                        <div class="id-card-field">
                                            <label>Blood Group:</label>
                                            <span id="idCardBlood">O+</span>
                                        </div>
                                    </div>
                                </div>
                                <div class="id-card-footer">
                                    <p>Valid for Academic Year 2024-25</p>
                                    <div class="id-card-qr">
                                        <svg width="50" height="50" viewBox="0 0 50 50">
                                            <rect x="5" y="5" width="8" height="8" fill="#667eea"/>
                                            <rect x="17" y="5" width="4" height="8" fill="#667eea"/>
                                            <rect x="25" y="5" width="8" height="8" fill="#667eea"/>
                                            <rect x="37" y="5" width="8" height="8" fill="#667eea"/>
                                            <rect x="5" y="17" width="4" height="4" fill="#667eea"/>
                                            <rect x="13" y="17" width="4" height="4" fill="#667eea"/>
                                            <rect x="25" y="17" width="4" height="4" fill="#667eea"/>
                                            <rect x="37" y="17" width="8" height="4" fill="#667eea"/>
                                            <rect x="5" y="25" width="8" height="8" fill="#667eea"/>
                                            <rect x="17" y="25" width="4" height="8" fill="#667eea"/>
                                            <rect x="25" y="25" width="8" height="8" fill="#667eea"/>
                                            <rect x="37" y="25" width="4" height="8" fill="#667eea"/>
                                            <rect x="5" y="37" width="8" height="8" fill="#667eea"/>
                                            <rect x="17" y="37" width="8" height="8" fill="#667eea"/>
                                            <rect x="29" y="37" width="4" height="8" fill="#667eea"/>
                                            <rect x="37" y="37" width="8" height="8" fill="#667eea"/>
                                        </svg>
                                    </div>
                                </div>
                            </div>
                            <div style="text-align: center; margin-top: 20px;">
                                <button class="btn btn-primary" onclick="UniversalProfile.downloadIdCard()">
                                    📥 Download ID Card
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Settings Modal -->
                <div class="profile-modal" id="settingsModal" style="display: none;">
                    <div class="profile-modal-content">
                        <div class="profile-modal-header">
                            <h3>Settings</h3>
                            <button class="profile-modal-close" id="closeSettingsModal">&times;</button>
                        </div>
                        <div class="profile-modal-body">
                            <div class="settings-section">
                                <h4>Account Information</h4>
                                <div class="form-group">
                                    <label>Name</label>
                                    <input type="text" id="settingsName" class="form-control" readonly>
                                </div>
                                <div class="form-group">
                                    <label>Email</label>
                                    <input type="email" id="settingsEmail" class="form-control" readonly title="Email can only be changed by an admin">
                                </div>
                                <div class="form-group">
                                    <label>Phone</label>
                                    <input type="tel" id="settingsPhone" class="form-control" placeholder="Optional">
                                </div>
                            </div>
                            <div class="settings-section">
                                <h4>Change Password</h4>
                                <div class="form-group">
                                    <label>Current Password</label>
                                    <input type="password" id="currentPassword" class="form-control">
                                </div>
                                <div class="form-group">
                                    <label>New Password</label>
                                    <input type="password" id="newPassword" class="form-control">
                                </div>
                                <div class="form-group">
                                    <label>Confirm New Password</label>
                                    <input type="password" id="confirmPassword" class="form-control">
                                </div>
                            </div>
                            <div class="settings-section">
                                <h4>Preferences</h4>
                                <div class="form-group">
                                    <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                                        <input type="checkbox" id="emailNotifications" style="width: auto;">
                                        <span>Email Notifications</span>
                                    </label>
                                </div>
                                <div class="form-group">
                                    <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                                        <input type="checkbox" id="pushNotifications" style="width: auto;">
                                        <span>Push Notifications</span>
                                    </label>
                                </div>
                            </div>
                            <div style="display: flex; gap: 10px; justify-content: flex-end;">
                                <button class="btn btn-secondary" id="cancelSettingsBtn">Cancel</button>
                                <button class="btn btn-primary" id="saveSettingsBtn">Save Changes</button>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            document.body.insertAdjacentHTML('beforeend', profileHTML);

            // Inject CSS
            if (!document.getElementById('universalProfileStyles')) {
                this.injectStyles();
            }

            // Notify other scripts (e.g., universal-sidebar) that the global profile control exists
            try {
                window.dispatchEvent(new CustomEvent('profileControlLoaded', {
                    detail: { container: 'universalProfileContainer' }
                }));
            } catch (e) {
                // no-op
            }
        },

        injectStyles() {
            const link = document.createElement('link');
            link.id = 'universalProfileStyles';
            link.rel = 'stylesheet';
            // Use absolute path to work from any page (root or /dashboard/*)
            link.href = '/css/universal-profile.css';
            document.head.appendChild(link);
        }
    };

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            UniversalProfile.init();
        });
    } else {
        UniversalProfile.init();
    }

    // Expose globally
    window.UniversalProfile = UniversalProfile;
})();
