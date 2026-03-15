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

            // Fallback to realistic demo user
            currentUser = {
                id: 10001,
                name: 'Aarav Sharma',
                email: 'aarav.sharma@iter.edu',
                role: 'student',
                registration_number: 'STU20250001',
                department: 'Computer Science & Engineering',
                year: 3,
                section: 'A',
                semester: '6'
            };
            populateStudentInfo();

        } catch (error) {
            console.error('Error loading user data:', error);
            currentUser = {
                id: 10001,
                name: 'Aarav Sharma',
                registration_number: 'STU20250001',
                department: 'Computer Science & Engineering',
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
                const u = currentUser || {};
                const regCode   = document.getElementById('registrationCode')?.value || 'REG2025-01';
                const examDesc  = document.getElementById('examDescription')?.value  || 'End Semester 2025';
                const examCode  = document.getElementById('examCode')?.value          || 'EXAM-2025-END';
                const now       = new Date();

                const content = [
                    ''.padEnd(60, '='),
                    'SIKSHA \'O\' ANUSANDHAN UNIVERSITY',
                    'ITER - Institute of Technical Education & Research',
                    'Jagamara, Khandagiri, Bhubaneswar - 751030',
                    ''.padEnd(60, '='),
                    '',
                    'EXAMINATION ADMIT CARD',
                    '',
                    ''.padEnd(60, '-'),
                    `Student Name        : ${u.name || 'Student'}`,
                    `Registration Number : ${u.registration_number || 'STU20250001'}`,
                    `Department          : ${u.department || 'CSE'}`,
                    `Year / Semester     : Year ${u.year || 3} / Sem ${u.semester || 6}`,
                    `Section             : ${u.section || 'A'}`,
                    `Academic Year       : 2024-25`,
                    ''.padEnd(60, '-'),
                    '',
                    `Registration Code   : ${regCode}`,
                    `Examination         : ${examDesc}`,
                    `Exam Code           : ${examCode}`,
                    '',
                    `Generated On        : ${now.toLocaleString('en-IN')}`,
                    '',
                    ''.padEnd(60, '-'),
                    'IMPORTANT INSTRUCTIONS:',
                    '1. Carry this admit card to the examination hall.',
                    '2. Produce a valid photo ID along with this card.',
                    '3. Mobile phones are strictly prohibited.',
                    '4. Maintain silence and discipline in the exam hall.',
                    ''.padEnd(60, '='),
                    'This is a computer-generated document. No signature required.',
                    ''.padEnd(60, '='),
                ].join('\n');

                const blob = new Blob([content], { type: 'text/plain' });
                const url  = URL.createObjectURL(blob);
                const a    = document.createElement('a');
                a.href     = url;
                a.download = `AdmitCard_${u.registration_number || 'STU20250001'}_${examCode}.txt`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                resolve();
            }, 800);
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
