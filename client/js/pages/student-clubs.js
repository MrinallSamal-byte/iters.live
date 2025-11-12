// Student Clubs Page
(function() {
    'use strict';

    let allClubs = [];
    let myClubs = new Set();
    let currentUser = null;

    // Sample clubs data
    const sampleClubs = [
        {
            id: 1,
            name: 'Coding Club',
            category: 'tech',
            icon: '💻',
            description: 'Learn programming, participate in coding competitions, and build amazing projects together.',
            members: 234,
            events: 12,
            established: '2020'
        },
        {
            id: 2,
            name: 'Drama Society',
            category: 'cultural',
            icon: '🎭',
            description: 'Express yourself through theater, drama, and stage performances. Weekly rehearsals and annual shows.',
            members: 89,
            events: 8,
            established: '2018'
        },
        {
            id: 3,
            name: 'Cricket Club',
            category: 'sports',
            icon: '🏏',
            description: 'Play cricket, improve your skills, and represent college in inter-college tournaments.',
            members: 156,
            events: 15,
            established: '2017'
        },
        {
            id: 4,
            name: 'AI/ML Club',
            category: 'tech',
            icon: '🤖',
            description: 'Explore artificial intelligence and machine learning through workshops and hands-on projects.',
            members: 178,
            events: 10,
            established: '2021'
        },
        {
            id: 5,
            name: 'Music Society',
            category: 'cultural',
            icon: '🎵',
            description: 'For music lovers! Learn instruments, vocals, and perform at college events.',
            members: 123,
            events: 20,
            established: '2019'
        },
        {
            id: 6,
            name: 'Photography Club',
            category: 'hobby',
            icon: '📸',
            description: 'Capture moments, learn photography techniques, and showcase your work in exhibitions.',
            members: 95,
            events: 6,
            established: '2020'
        },
        {
            id: 7,
            name: 'Debate Society',
            category: 'academic',
            icon: '🗣️',
            description: 'Sharpen your speaking skills, participate in debates, and represent college at MUNs.',
            members: 67,
            events: 14,
            established: '2018'
        },
        {
            id: 8,
            name: 'Environmental Club',
            category: 'social',
            icon: '🌱',
            description: 'Work towards a greener campus through plantation drives, awareness campaigns, and sustainability projects.',
            members: 145,
            events: 18,
            established: '2019'
        },
        {
            id: 9,
            name: 'Robotics Club',
            category: 'tech',
            icon: '🤖',
            description: 'Build robots, participate in competitions, and explore automation and IoT.',
            members: 112,
            events: 9,
            established: '2020'
        },
        {
            id: 10,
            name: 'Dance Crew',
            category: 'cultural',
            icon: '💃',
            description: 'Learn various dance forms, choreograph routines, and perform at events.',
            members: 201,
            events: 16,
            established: '2017'
        },
        {
            id: 11,
            name: 'Chess Club',
            category: 'hobby',
            icon: '♟️',
            description: 'Strategic thinking and chess mastery. Regular tournaments and training sessions.',
            members: 56,
            events: 7,
            established: '2021'
        },
        {
            id: 12,
            name: 'Entrepreneurship Cell',
            category: 'academic',
            icon: '💼',
            description: 'For aspiring entrepreneurs! Learn business skills, attend startup talks, and launch your ideas.',
            members: 189,
            events: 11,
            established: '2019'
        }
    ];

    async function init() {
        await loadUserData();
        await loadClubs();
        updateStats();
    }

    async function loadUserData() {
        try {
            const token = localStorage.getItem('token');
            
            // Check authentication - use APP if available
            if (typeof APP !== 'undefined') {
                if (!APP.isAuthenticated()) {
                    console.warn('Not authenticated, returning to dashboard');
                    window.location.href = 'student.html';
                    return;
                }
                // Get user from APP
                currentUser = APP.Storage.get('user');
                return;
            }
            
            // Fallback to token check
            if (!token) {
                console.warn('No token, returning to dashboard');
                window.location.href = 'student.html';
                return;
            }

            const response = await fetch('/api/users/me', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) throw new Error('Failed to load user data');

            currentUser = await response.json();
        } catch (error) {
            console.error('Error loading user data:', error);
        }
    }

    async function loadClubs() {
        // Try to fetch from API
        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/api/clubs', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                allClubs = data.data || [];
            }
        } catch (error) {
            console.log('Using sample data');
        }

        // Use sample data for demonstration
        if (allClubs.length === 0) {
            allClubs = sampleClubs;
        }

        displayClubs();
        displayMyClubs();
    }

    function displayClubs() {
        const grid = document.getElementById('clubsGrid');
        if (!grid) return;

        if (allClubs.length === 0) {
            grid.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: 40px;">
                    <p style="color: #888;">No clubs available.</p>
                </div>
            `;
            return;
        }

        let html = '';
        allClubs.forEach(club => {
            const isJoined = myClubs.has(club.id);

            html += `
                <div class="club-card">
                    <div class="club-header ${club.category}">
                        <span style="z-index: 1;">${club.icon}</span>
                    </div>
                    <div class="club-content">
                        <div class="club-name">${club.name}</div>
                        <div class="club-category">${club.category}</div>
                        <div class="club-description">${club.description}</div>
                        <div class="club-stats">
                            <div class="club-stat">
                                <span>👥</span>
                                <span>${club.members} members</span>
                            </div>
                            <div class="club-stat">
                                <span>📅</span>
                                <span>${club.events} events</span>
                            </div>
                        </div>
                        <div class="club-footer">
                            <button 
                                class="join-btn ${isJoined ? 'joined' : ''}" 
                                data-club-id="${club.id}"
                                onclick="handleClubAction(${club.id}, ${isJoined})"
                            >
                                ${isJoined ? '✓ Joined' : 'Join Club'}
                            </button>
                        </div>
                    </div>
                </div>
            `;
        });

        grid.innerHTML = html;
    }

    function displayMyClubs() {
        const section = document.getElementById('myClubsSection');
        const listEl = document.getElementById('myClubsList');
        
        if (!section || !listEl) return;

        const joinedClubs = allClubs.filter(club => myClubs.has(club.id));

        if (joinedClubs.length === 0) {
            section.style.display = 'none';
            return;
        }

        section.style.display = 'block';

        let html = '';
        joinedClubs.forEach(club => {
            html += `
                <div class="my-club-item">
                    <div class="my-club-icon ${club.category}">
                        ${club.icon}
                    </div>
                    <div class="my-club-info">
                        <div class="my-club-name">${club.name}</div>
                        <div class="my-club-role">Member since ${new Date().getFullYear()}</div>
                    </div>
                    <button class="leave-btn" onclick="handleLeaveClub(${club.id})">
                        Leave
                    </button>
                </div>
            `;
        });

        listEl.innerHTML = html;
    }

    function updateStats() {
        const totalClubsEl = document.getElementById('totalClubs');
        const myClubsCountEl = document.getElementById('myClubsCount');
        const totalMembersEl = document.getElementById('totalMembers');
        const activeClubsEl = document.getElementById('activeClubs');

        if (totalClubsEl) totalClubsEl.textContent = allClubs.length;
        if (myClubsCountEl) myClubsCountEl.textContent = myClubs.size;
        
        const totalMembers = allClubs.reduce((sum, club) => sum + club.members, 0);
        if (totalMembersEl) totalMembersEl.textContent = totalMembers;
        if (activeClubsEl) activeClubsEl.textContent = allClubs.length;
    }

    // Make functions globally accessible
    window.handleClubAction = async function(clubId, isJoined) {
        if (isJoined) {
            return; // Already joined, do nothing
        }

        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`/api/clubs/${clubId}/join`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                myClubs.add(clubId);
                window.APP.showToast('Successfully joined the club!', 'success');
                
                // Update member count
                const club = allClubs.find(c => c.id === clubId);
                if (club) {
                    club.members++;
                }
                
                displayClubs();
                displayMyClubs();
                updateStats();
            } else {
                throw new Error('Failed to join club');
            }
        } catch (error) {
            console.error('Join club error:', error);
            
            // For demo purposes, still allow joining
            myClubs.add(clubId);
            const club = allClubs.find(c => c.id === clubId);
            if (club) {
                club.members++;
            }
            window.APP.showToast('Joined the club!', 'success');
            displayClubs();
            displayMyClubs();
            updateStats();
        }
    };

    window.handleLeaveClub = async function(clubId) {
        if (!confirm('Are you sure you want to leave this club?')) {
            return;
        }

        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`/api/clubs/${clubId}/leave`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                myClubs.delete(clubId);
                window.APP.showToast('Left the club', 'info');
                
                // Update member count
                const club = allClubs.find(c => c.id === clubId);
                if (club) {
                    club.members--;
                }
                
                displayClubs();
                displayMyClubs();
                updateStats();
            } else {
                throw new Error('Failed to leave club');
            }
        } catch (error) {
            console.error('Leave club error:', error);
            
            // For demo purposes, still allow leaving
            myClubs.delete(clubId);
            const club = allClubs.find(c => c.id === clubId);
            if (club) {
                club.members--;
            }
            window.APP.showToast('Left the club', 'info');
            displayClubs();
            displayMyClubs();
            updateStats();
        }
    };

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
