// Student Admit Card Page - Enhanced
(function() {
    'use strict';

    let currentUser = null;

    async function init() {
        console.log('Admit Card Page - Initializing...');
        await loadUserData();
        setupEventListeners();
        
        // Show success message
        if (window.Toast) {
            Toast.success('Admit card page loaded successfully', 'Ready');
        }
    }

    async function loadUserData() {
        try {
            // Try to get user from localStorage first
            const storedUser = localStorage.getItem('user');
            if (storedUser) {
                currentUser = JSON.parse(storedUser);
                console.log('User loaded from storage:', currentUser);
                populateStudentInfo();
                return;
            }

            // If no stored user, check if we have a token
            const token = localStorage.getItem('token');
            if (token && token !== 'demo-token') {
                try {
                    const response = await fetch('/api/users/me', {
                        headers: {
                            'Authorization': `Bearer ${token}`
                        }
                    });

                    if (response.ok) {
                        currentUser = await response.json();
                        localStorage.setItem('user', JSON.stringify(currentUser));
                        populateStudentInfo();
                        return;
                    }
                } catch (e) {
                    console.warn('API call failed, using demo user');
                }
            }

            // Fallback to demo user
            currentUser = {
                id: 1001,
                name: 'Alex Johnson',
                email: 'alex.johnson@example.edu',
                role: 'student',
                registration_number: '24E112R17',
                department: 'Computer Science and Engineering',
                year: 3,
                section: 'B',
                semester: '6'
            };
            
            console.log('Using demo user:', currentUser);
            populateStudentInfo();
            
        } catch (error) {
            console.error('Error loading user data:', error);
            // Use fallback demo user
            currentUser = {
                id: 1001,
                name: 'Alex Johnson',
                registration_number: '24E112R17',
                department: 'Computer Science and Engineering',
                semester: '6'
            };
            populateStudentInfo();
        }
    }

    function populateStudentInfo() {
        if (!currentUser) {
            console.warn('No user data available');
            return;
        }

        console.log('Populating student info with:', currentUser);

        // Update all fields
        const fields = {
            'enrollmentNo': currentUser.registration_number || '24E112R17',
            'studentNameDisplay': currentUser.name || 'Student',
            'program': 'Bachelor of Technology (B.Tech)',
            'branch': currentUser.department || 'Computer Science and Engineering',
            'semester': currentUser.semester || '6',
            'academicYear': '2024-25'
        };

        Object.keys(fields).forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = fields[id];
                console.log(`Updated ${id} to:`, fields[id]);
            } else {
                console.warn(`Element not found: ${id}`);
            }
        });
    }

    function setupEventListeners() {
        const downloadBtn = document.getElementById('downloadBtn');
        if (downloadBtn) {
            downloadBtn.addEventListener('click', handleDownload);
            console.log('Download button event listener attached');
        } else {
            console.warn('Download button not found');
        }
    }

    async function handleDownload() {
        const regCode = document.getElementById('registrationCode').value;
        const examDesc = document.getElementById('examDescription').value;
        const examCode = document.getElementById('examCode').value;

        // Validation
        if (!regCode || !examDesc || !examCode) {
            if (window.Toast) {
                Toast.warning('Please fill all required fields', 'Validation Error');
            } else {
                alert('Please fill all required fields');
            }
            return;
        }

        try {
            // Show loading state
            const downloadBtn = document.getElementById('downloadBtn');
            const originalText = downloadBtn.innerHTML;
            downloadBtn.innerHTML = '⏳ Generating...';
            downloadBtn.disabled = true;

            // Simulate download (in real scenario, this would fetch from server)
            await simulateDownload();

            // Success
            if (window.Toast) {
                Toast.success('Admit card downloaded successfully!', 'Success');
            } else {
                alert('Admit card downloaded successfully!');
            }

            // Reset button
            downloadBtn.innerHTML = originalText;
            downloadBtn.disabled = false;

        } catch (error) {
            console.error('Error downloading admit card:', error);
            
            // Reset button
            const downloadBtn = document.getElementById('downloadBtn');
            downloadBtn.innerHTML = '📥 Download Admit Card';
            downloadBtn.disabled = false;

            if (window.Toast) {
                Toast.error('Failed to download admit card. Please try again.', 'Error');
            } else {
                alert('Failed to download admit card. Please try again.');
            }
        }
    }

    async function simulateDownload() {
        return new Promise((resolve) => {
            setTimeout(() => {
                // In a real scenario, you would fetch the PDF from the server
                // For now, we'll just simulate the download
                console.log('Admit card download simulated');
                resolve();
            }, 1500);
        });
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Log when script is loaded
    console.log('Admit Card script loaded');
})();
