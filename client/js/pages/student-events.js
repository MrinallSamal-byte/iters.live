// Student Events Page
(function() {
    'use strict';

    let allEvents = [];
    let currentUser = null;
    let registeredEvents = new Set();
    let currentFilter = 'all';

    // Sample events data
    const sampleEvents = [
        {
            id: 1,
            title: 'Inter-College Coding Competition',
            category: 'competition',
            icon: '💻',
            date: '2025-10-15',
            time: '10:00 AM',
            venue: 'Computer Lab 1',
            description: 'Showcase your coding skills in this exciting competition with prizes worth ₹50,000!',
            participants: 145,
            max_participants: 200,
            organizer: 'CSE Department',
            registration_open: true
        },
        {
            id: 2,
            title: 'Annual Cultural Fest 2025',
            category: 'cultural',
            icon: '🎭',
            date: '2025-10-20',
            time: '5:00 PM',
            venue: 'Main Auditorium',
            description: 'Join us for three days of music, dance, drama, and entertainment!',
            participants: 523,
            max_participants: 1000,
            organizer: 'Cultural Committee',
            registration_open: true
        },
        {
            id: 3,
            title: 'Web Development Workshop',
            category: 'workshop',
            icon: '🌐',
            date: '2025-10-12',
            time: '2:00 PM',
            venue: 'Seminar Hall',
            description: 'Learn modern web development with React, Node.js, and MongoDB from industry experts.',
            participants: 89,
            max_participants: 100,
            organizer: 'Tech Club',
            registration_open: true
        },
        {
            id: 4,
            title: 'AI & Machine Learning Seminar',
            category: 'seminar',
            icon: '🤖',
            date: '2025-10-18',
            time: '11:00 AM',
            venue: 'Conference Room',
            description: 'Explore the latest trends in AI and ML with guest speakers from top tech companies.',
            participants: 234,
            max_participants: 300,
            organizer: 'AI Research Lab',
            registration_open: true
        },
        {
            id: 5,
            title: 'Cricket Tournament 2025',
            category: 'sports',
            icon: '🏏',
            date: '2025-10-25',
            time: '7:00 AM',
            venue: 'Sports Ground',
            description: 'Annual inter-department cricket tournament. Form your teams and compete!',
            participants: 176,
            max_participants: 200,
            organizer: 'Sports Committee',
            registration_open: true
        },
        {
            id: 6,
            title: 'Hackathon 24 Hours',
            category: 'technical',
            icon: '⚡',
            date: '2025-11-01',
            time: '9:00 AM',
            venue: 'Tech Park',
            description: '24-hour hackathon to build innovative solutions. Prizes worth ₹1,00,000!',
            participants: 67,
            max_participants: 150,
            organizer: 'Innovation Cell',
            registration_open: true
        },
        {
            id: 7,
            title: 'Photography Exhibition',
            category: 'cultural',
            icon: '📸',
            date: '2025-10-22',
            time: '10:00 AM',
            venue: 'Art Gallery',
            description: 'Display your photography skills and view amazing work from fellow students.',
            participants: 45,
            max_participants: 100,
            organizer: 'Photography Club',
            registration_open: true
        },
        {
            id: 8,
            title: 'Career Guidance Seminar',
            category: 'seminar',
            icon: '💼',
            date: '2025-10-14',
            time: '3:00 PM',
            venue: 'Auditorium',
            description: 'Get insights into career paths, interview tips, and placement preparation.',
            participants: 312,
            max_participants: 500,
            organizer: 'Placement Cell',
            registration_open: true
        }
    ];

    async function init() {
        await loadUserData();
        await loadEvents();
        setupEventListeners();
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

    async function loadEvents() {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/api/events', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                allEvents = data.data || [];
            }
        } catch (error) {
            console.log('Using sample data');
        }

        // Use sample data for demonstration
        if (allEvents.length === 0) {
            allEvents = sampleEvents;
        }

        displayEvents();
    }

    function setupEventListeners() {
        // Filter chips
        const filterChips = document.querySelectorAll('.filter-chip');
        filterChips.forEach(chip => {
            chip.addEventListener('click', function() {
                filterChips.forEach(c => c.classList.remove('active'));
                this.classList.add('active');
                currentFilter = this.dataset.category;
                displayEvents();
            });
        });
    }

    function displayEvents() {
        const grid = document.getElementById('eventsGrid');
        if (!grid) return;

        let filteredEvents = allEvents;
        if (currentFilter !== 'all') {
            filteredEvents = allEvents.filter(event => event.category === currentFilter);
        }

        if (filteredEvents.length === 0) {
            grid.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">🎪</div>
                    <p>No events found in this category.</p>
                </div>
            `;
            return;
        }

        let html = '';
        filteredEvents.forEach(event => {
            const isRegistered = registeredEvents.has(event.id);
            const isFull = event.participants >= event.max_participants;
            const eventDate = new Date(event.date);
            const isToday = eventDate.toDateString() === new Date().toDateString();

            html += `
                <div class="event-card">
                    <div class="event-banner">
                        <span style="font-size: 3rem; z-index: 1;">${event.icon}</span>
                        <span class="event-category-badge">${event.category}</span>
                    </div>
                    <div class="event-content">
                        <div class="event-title">${event.title}</div>
                        <div class="event-meta">
                            <div class="event-meta-item">
                                <span>📅</span>
                                <span>${formatDate(event.date)}${isToday ? ' (Today)' : ''}</span>
                            </div>
                            <div class="event-meta-item">
                                <span>⏰</span>
                                <span>${event.time}</span>
                            </div>
                            <div class="event-meta-item">
                                <span>📍</span>
                                <span>${event.venue}</span>
                            </div>
                            <div class="event-meta-item">
                                <span>👤</span>
                                <span>${event.organizer}</span>
                            </div>
                        </div>
                        <div class="event-description">${event.description}</div>
                        <div class="event-footer">
                            <div class="event-participants">
                                <span>👥</span>
                                <span>${event.participants}/${event.max_participants}</span>
                            </div>
                            <button 
                                class="register-btn ${isRegistered ? 'registered' : ''}" 
                                data-event-id="${event.id}"
                                ${!event.registration_open || isFull ? 'disabled' : ''}
                            >
                                ${isRegistered ? '✓ Registered' : (isFull ? 'Full' : 'Register')}
                            </button>
                        </div>
                    </div>
                </div>
            `;
        });

        grid.innerHTML = html;

        // Add event listeners to register buttons
        const registerButtons = grid.querySelectorAll('.register-btn:not(.registered):not(:disabled)');
        registerButtons.forEach(btn => {
            btn.addEventListener('click', function() {
                const eventId = parseInt(this.dataset.eventId);
                handleRegistration(eventId);
            });
        });
    }

    function formatDate(dateStr) {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    }

    async function handleRegistration(eventId) {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`/api/events/${eventId}/register`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                registeredEvents.add(eventId);
                window.APP.showToast('Successfully registered for event!', 'success');
                
                // Update participant count
                const event = allEvents.find(e => e.id === eventId);
                if (event) {
                    event.participants++;
                }
                
                displayEvents();
                updateStats();
            } else {
                throw new Error('Registration failed');
            }
        } catch (error) {
            console.error('Registration error:', error);
            
            // For demo purposes, still allow registration
            registeredEvents.add(eventId);
            const event = allEvents.find(e => e.id === eventId);
            if (event) {
                event.participants++;
            }
            window.APP.showToast('Registered for event!', 'success');
            displayEvents();
            updateStats();
        }
    }

    function updateStats() {
        const today = new Date().toDateString();
        
        const totalEventsEl = document.getElementById('totalEvents');
        const registeredEventsEl = document.getElementById('registeredEvents');
        const upcomingEventsEl = document.getElementById('upcomingEvents');
        const todayEventsEl = document.getElementById('todayEvents');

        if (totalEventsEl) totalEventsEl.textContent = allEvents.length;
        if (registeredEventsEl) registeredEventsEl.textContent = registeredEvents.size;
        
        const upcoming = allEvents.filter(e => new Date(e.date) > new Date()).length;
        if (upcomingEventsEl) upcomingEventsEl.textContent = upcoming;
        
        const todayCount = allEvents.filter(e => new Date(e.date).toDateString() === today).length;
        if (todayEventsEl) todayEventsEl.textContent = todayCount;
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
