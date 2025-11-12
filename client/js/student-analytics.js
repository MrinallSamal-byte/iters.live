// Student Analytics Dashboard - Comprehensive Overview Module
(function() {
    'use strict';

    // Get current user
    const user = window.APP?.Storage?.get('user') || {};
    
    // Analytics data store
    const analyticsData = {
        attendance: null,
        marks: null,
        events: null,
        clubs: null,
        hostel: null,
        timetable: null,
        assignments: null
    };

    /**
     * Load all analytics data from different modules
     */
    async function loadAllAnalytics() {
        console.log('📊 Loading comprehensive analytics...');
        
        await Promise.all([
            loadAttendanceAnalytics(),
            loadMarksAnalytics(),
            loadEventsAnalytics(),
            loadClubsAnalytics(),
            loadHostelAnalytics(),
            loadTimetableAnalytics(),
            loadAssignmentsAnalytics()
        ]);

        displayComprehensiveAnalytics();
    }

    /**
     * Load Attendance Analytics
     */
    async function loadAttendanceAnalytics() {
        try {
            const response = await fetch(`/api/attendance/student/${user.id}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                analyticsData.attendance = data.data;
            } else {
                // Use sample data
                analyticsData.attendance = getSampleAttendance();
            }
        } catch (error) {
            console.warn('Using sample attendance data');
            analyticsData.attendance = getSampleAttendance();
        }
    }

    /**
     * Load Marks Analytics
     */
    async function loadMarksAnalytics() {
        try {
            const response = await fetch(`/api/marks/student/${user.id}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                analyticsData.marks = data.data;
            } else {
                analyticsData.marks = getSampleMarks();
            }
        } catch (error) {
            console.warn('Using sample marks data');
            analyticsData.marks = getSampleMarks();
        }
    }

    /**
     * Load Events Analytics
     */
    async function loadEventsAnalytics() {
        try {
            const response = await fetch('/api/events', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                analyticsData.events = data.data || data;
            } else {
                analyticsData.events = getSampleEvents();
            }
        } catch (error) {
            console.warn('Using sample events data');
            analyticsData.events = getSampleEvents();
        }
    }

    /**
     * Load Clubs Analytics
     */
    async function loadClubsAnalytics() {
        try {
            const response = await fetch('/api/clubs', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                analyticsData.clubs = data.data || data;
            } else {
                analyticsData.clubs = getSampleClubs();
            }
        } catch (error) {
            console.warn('Using sample clubs data');
            analyticsData.clubs = getSampleClubs();
        }
    }

    /**
     * Load Hostel Analytics
     */
    async function loadHostelAnalytics() {
        try {
            const today = new Date().toISOString().split('T')[0];
            const response = await fetch(`/api/hostel/menu?date=${today}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                analyticsData.hostel = data.data;
            } else {
                analyticsData.hostel = getSampleHostel();
            }
        } catch (error) {
            console.warn('Using sample hostel data');
            analyticsData.hostel = getSampleHostel();
        }
    }

    /**
     * Load Timetable Analytics
     */
    async function loadTimetableAnalytics() {
        try {
            const response = await fetch('/api/timetable', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                analyticsData.timetable = data.data;
            } else {
                analyticsData.timetable = getSampleTimetable();
            }
        } catch (error) {
            console.warn('Using sample timetable data');
            analyticsData.timetable = getSampleTimetable();
        }
    }

    /**
     * Load Assignments Analytics
     */
    async function loadAssignmentsAnalytics() {
        try {
            const response = await fetch('/api/assignments/student', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                analyticsData.assignments = data.data || data;
            } else {
                analyticsData.assignments = getSampleAssignments();
            }
        } catch (error) {
            console.warn('Using sample assignments data');
            analyticsData.assignments = getSampleAssignments();
        }
    }

    /**
     * Display Comprehensive Analytics
     */
    function displayComprehensiveAnalytics() {
        updateHeroStats();
        updateQuickStats();
        updateAttendanceChart();
        updateMarksChart();
        updatePerformanceTable();
        updateUpcomingEvents();
        updateClubsParticipation();
        updateActivityTimeline();
        updateProgressMetrics();
    }

    /**
     * Update Hero Stats
     */
    function updateHeroStats() {
        // Calculate overall attendance
        const attendance = calculateOverallAttendance();
        const el1 = document.getElementById('heroAttendance');
        if (el1) el1.textContent = attendance + '%';

        // Calculate CGPA
        const cgpa = calculateCGPA();
        const el2 = document.getElementById('heroCGPA');
        if (el2) el2.textContent = cgpa;

        // Count active clubs
        const clubsCount = analyticsData.clubs ? 
            (Array.isArray(analyticsData.clubs) ? analyticsData.clubs.length : 0) : 0;
        const el3 = document.getElementById('heroClubs');
        if (el3) el3.textContent = clubsCount;

        // Count upcoming events
        const eventsCount = analyticsData.events ? 
            (Array.isArray(analyticsData.events) ? analyticsData.events.filter(e => new Date(e.date) > new Date()).length : 0) : 0;
        const el4 = document.getElementById('heroEvents');
        if (el4) el4.textContent = eventsCount;
    }

    /**
     * Update Quick Stats
     */
    function updateQuickStats() {
        // Total Classes
        const totalClasses = calculateTotalClasses();
        const el1 = document.getElementById('statTotalClasses');
        if (el1) el1.textContent = totalClasses;

        // Assignments Pending
        const pending = countPendingAssignments();
        const el2 = document.getElementById('statPendingAssignments');
        if (el2) el2.textContent = pending;

        // Current Rank (placeholder)
        const el3 = document.getElementById('statClassRank');
        if (el3) el3.textContent = '12';

        // Activities this week
        const activities = countWeeklyActivities();
        const el4 = document.getElementById('statWeeklyActivities');
        if (el4) el4.textContent = activities;
    }

    /**
     * Update Attendance Chart
     */
    function updateAttendanceChart() {
        const canvas = document.getElementById('attendanceAnalyticsChart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const attendance = analyticsData.attendance;
        
        if (!attendance || !attendance.summary) return;

        const labels = attendance.summary.map(s => s.subject_name || 'Subject');
        const present = attendance.summary.map(s => s.present_count || 0);
        const absent = attendance.summary.map(s => (s.total_classes || 0) - (s.present_count || 0));

        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Present',
                        data: present,
                        backgroundColor: 'rgba(34, 197, 94, 0.8)',
                    },
                    {
                        label: 'Absent',
                        data: absent,
                        backgroundColor: 'rgba(239, 68, 68, 0.8)',
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'bottom',
                        labels: { color: '#e5e7eb' }
                    }
                },
                scales: {
                    x: { 
                        stacked: true,
                        ticks: { color: '#9ca3af' },
                        grid: { color: 'rgba(255, 255, 255, 0.05)' }
                    },
                    y: { 
                        stacked: true,
                        ticks: { color: '#9ca3af' },
                        grid: { color: 'rgba(255, 255, 255, 0.05)' }
                    }
                }
            }
        });
    }

    /**
     * Update Marks Chart
     */
    function updateMarksChart() {
        const canvas = document.getElementById('marksAnalyticsChart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const marks = analyticsData.marks;
        
        if (!marks || !Array.isArray(marks)) return;

        const labels = marks.map(m => m.subject_name || 'Subject');
        const scores = marks.map(m => m.marks_obtained || 0);
        const maxMarks = marks.map(m => m.max_marks || 100);

        new Chart(ctx, {
            type: 'radar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Your Marks',
                        data: scores,
                        borderColor: 'rgba(102, 126, 234, 1)',
                        backgroundColor: 'rgba(102, 126, 234, 0.2)',
                        pointBackgroundColor: 'rgba(102, 126, 234, 1)',
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    r: {
                        ticks: { color: '#9ca3af', backdropColor: 'transparent' },
                        grid: { color: 'rgba(255, 255, 255, 0.1)' },
                        pointLabels: { color: '#e5e7eb' }
                    }
                }
            }
        });
    }

    /**
     * Update Performance Table
     */
    function updatePerformanceTable() {
        const tbody = document.getElementById('performanceTableBody');
        if (!tbody) return;

        const marks = analyticsData.marks;
        if (!marks || !Array.isArray(marks)) return;

        let html = '';
        marks.forEach(mark => {
            const percentage = ((mark.marks_obtained / mark.max_marks) * 100).toFixed(1);
            const grade = getGrade(percentage);
            const gradeClass = grade.toLowerCase().replace('+', '');

            html += `
                <tr>
                    <td class="subject-name">${mark.subject_name || 'Subject'}</td>
                    <td>${mark.marks_obtained || 0}/${mark.max_marks || 100}</td>
                    <td>${percentage}%</td>
                    <td><span class="grade-badge grade-${gradeClass}">${grade}</span></td>
                </tr>
            `;
        });

        tbody.innerHTML = html;
    }

    /**
     * Update Upcoming Events
     */
    function updateUpcomingEvents() {
        const container = document.getElementById('upcomingEventsContainer');
        if (!container) return;

        const events = analyticsData.events;
        if (!events || !Array.isArray(events)) return;

        const upcoming = events
            .filter(e => new Date(e.date) > new Date())
            .sort((a, b) => new Date(a.date) - new Date(b.date))
            .slice(0, 5);

        if (upcoming.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #9ca3af; padding: 20px;">No upcoming events</p>';
            return;
        }

        let html = '<div class="events-grid">';
        upcoming.forEach(event => {
            const date = new Date(event.date);
            const day = date.getDate();
            const month = date.toLocaleDateString('en-US', { month: 'short' });

            html += `
                <div class="event-card">
                    <div class="event-date">
                        <span class="event-day">${day}</span>
                        <span class="event-month">${month}</span>
                    </div>
                    <div class="event-details">
                        <div class="event-title">${event.name || event.title || 'Event'}</div>
                        <div class="event-info">
                            📍 ${event.location || 'Campus'} • 
                            👥 ${event.participants || 0} registered
                        </div>
                    </div>
                </div>
            `;
        });
        html += '</div>';

        container.innerHTML = html;
    }

    /**
     * Update Clubs Participation
     */
    function updateClubsParticipation() {
        const container = document.getElementById('clubsParticipationContainer');
        if (!container) return;

        const clubs = analyticsData.clubs;
        if (!clubs || !Array.isArray(clubs)) return;

        const myClubs = clubs.slice(0, 6); // Show first 6 clubs

        let html = '<div class="clubs-grid">';
        myClubs.forEach(club => {
            html += `
                <div class="club-badge">
                    <div class="club-icon-large">${club.icon || '🎯'}</div>
                    <div class="club-name">${club.name || 'Club'}</div>
                </div>
            `;
        });
        html += '</div>';

        container.innerHTML = html;
    }

    /**
     * Update Activity Timeline
     */
    function updateActivityTimeline() {
        const container = document.getElementById('activityTimelineContainer');
        if (!container) return;

        const activities = generateRecentActivities();

        let html = '<div class="activity-timeline">';
        activities.forEach(activity => {
            html += `
                <div class="timeline-item">
                    <div class="timeline-time">${activity.time}</div>
                    <div class="timeline-title">${activity.title}</div>
                    <div class="timeline-desc">${activity.desc}</div>
                </div>
            `;
        });
        html += '</div>';

        container.innerHTML = html;
    }

    /**
     * Update Progress Metrics
     */
    function updateProgressMetrics() {
        const container = document.getElementById('progressMetricsContainer');
        if (!container) return;

        const attendance = calculateOverallAttendance();
        const assignmentCompletion = calculateAssignmentCompletion();
        const courseProgress = 65; // Placeholder

        const html = `
            <div class="progress-container">
                <div class="progress-item">
                    <div class="progress-header">
                        <span class="progress-label">Overall Attendance</span>
                        <span class="progress-value">${attendance}%</span>
                    </div>
                    <div class="progress-bar-bg">
                        <div class="progress-bar-fill" style="width: ${attendance}%;"></div>
                    </div>
                </div>
                <div class="progress-item">
                    <div class="progress-header">
                        <span class="progress-label">Assignment Completion</span>
                        <span class="progress-value">${assignmentCompletion}%</span>
                    </div>
                    <div class="progress-bar-bg">
                        <div class="progress-bar-fill" style="width: ${assignmentCompletion}%;"></div>
                    </div>
                </div>
                <div class="progress-item">
                    <div class="progress-header">
                        <span class="progress-label">Course Progress</span>
                        <span class="progress-value">${courseProgress}%</span>
                    </div>
                    <div class="progress-bar-bg">
                        <div class="progress-bar-fill" style="width: ${courseProgress}%;"></div>
                    </div>
                </div>
            </div>
        `;

        container.innerHTML = html;
    }

    // Helper Functions

    function calculateOverallAttendance() {
        const attendance = analyticsData.attendance;
        if (!attendance || !attendance.summary) return 0;

        let totalPresent = 0;
        let totalClasses = 0;

        attendance.summary.forEach(s => {
            totalPresent += s.present_count || 0;
            totalClasses += s.total_classes || 0;
        });

        return totalClasses > 0 ? Math.round((totalPresent / totalClasses) * 100) : 0;
    }

    function calculateCGPA() {
        const marks = analyticsData.marks;
        if (!marks || !Array.isArray(marks) || marks.length === 0) return '0.00';

        let totalGradePoints = 0;
        marks.forEach(mark => {
            const percentage = (mark.marks_obtained / mark.max_marks) * 100;
            totalGradePoints += getGradePoint(percentage);
        });

        return (totalGradePoints / marks.length).toFixed(2);
    }

    function calculateTotalClasses() {
        const attendance = analyticsData.attendance;
        if (!attendance || !attendance.summary) return 0;

        return attendance.summary.reduce((sum, s) => sum + (s.total_classes || 0), 0);
    }

    function countPendingAssignments() {
        const assignments = analyticsData.assignments;
        if (!assignments || !Array.isArray(assignments)) return 0;

        return assignments.filter(a => a.status === 'pending' || !a.submitted).length;
    }

    function countWeeklyActivities() {
        // Placeholder calculation
        return 8;
    }

    function calculateAssignmentCompletion() {
        const assignments = analyticsData.assignments;
        if (!assignments || !Array.isArray(assignments) || assignments.length === 0) return 0;

        const completed = assignments.filter(a => a.status === 'submitted' || a.submitted).length;
        return Math.round((completed / assignments.length) * 100);
    }

    function getGrade(percentage) {
        if (percentage >= 90) return 'A+';
        if (percentage >= 80) return 'A';
        if (percentage >= 70) return 'B';
        if (percentage >= 60) return 'C';
        if (percentage >= 50) return 'D';
        return 'F';
    }

    function getGradePoint(percentage) {
        if (percentage >= 90) return 10;
        if (percentage >= 80) return 9;
        if (percentage >= 70) return 8;
        if (percentage >= 60) return 7;
        if (percentage >= 50) return 6;
        return 0;
    }

    function generateRecentActivities() {
        return [
            {
                time: '2 hours ago',
                title: 'Assignment Submitted',
                desc: 'Data Structures Assignment submitted successfully'
            },
            {
                time: '5 hours ago',
                title: 'Attendance Marked',
                desc: 'Present in Database Management System class'
            },
            {
                time: 'Yesterday',
                title: 'Joined Club',
                desc: 'Became a member of Coding Club'
            },
            {
                time: '2 days ago',
                title: 'Event Registration',
                desc: 'Registered for Inter-College Tech Fest'
            }
        ];
    }

    // Sample Data Functions (for fallback)
    
    function getSampleAttendance() {
        return {
            summary: [
                { subject_name: 'Data Structures', present_count: 28, total_classes: 30 },
                { subject_name: 'DBMS', present_count: 25, total_classes: 28 },
                { subject_name: 'Operating Systems', present_count: 26, total_classes: 29 },
                { subject_name: 'Computer Networks', present_count: 27, total_classes: 30 },
                { subject_name: 'Web Technology', present_count: 29, total_classes: 30 }
            ]
        };
    }

    function getSampleMarks() {
        return [
            { subject_name: 'Data Structures', marks_obtained: 85, max_marks: 100 },
            { subject_name: 'DBMS', marks_obtained: 78, max_marks: 100 },
            { subject_name: 'Operating Systems', marks_obtained: 82, max_marks: 100 },
            { subject_name: 'Computer Networks', marks_obtained: 88, max_marks: 100 },
            { subject_name: 'Web Technology', marks_obtained: 92, max_marks: 100 }
        ];
    }

    function getSampleEvents() {
        return [
            { name: 'Tech Fest 2025', date: '2025-08-15', location: 'Main Auditorium', participants: 250 },
            { name: 'Coding Competition', date: '2025-07-28', location: 'Computer Lab', participants: 120 },
            { name: 'Cultural Night', date: '2025-08-05', location: 'Open Theater', participants: 400 },
            { name: 'Sports Meet', date: '2025-07-30', location: 'Sports Complex', participants: 300 }
        ];
    }

    function getSampleClubs() {
        return [
            { name: 'Coding Club', icon: '💻' },
            { name: 'Drama Society', icon: '🎭' },
            { name: 'Music Club', icon: '🎵' },
            { name: 'Sports Club', icon: '⚽' },
            { name: 'Photography', icon: '📸' },
            { name: 'Debate Club', icon: '🎤' }
        ];
    }

    function getSampleHostel() {
        return {
            breakfast: ['Idli', 'Vada', 'Sambar'],
            lunch: ['Rice', 'Dal', 'Curry'],
            dinner: ['Roti', 'Paneer', 'Rice']
        };
    }

    function getSampleTimetable() {
        return {
            monday: [
                { time: '9:00 AM', subject: 'Data Structures' },
                { time: '10:00 AM', subject: 'DBMS' }
            ]
        };
    }

    function getSampleAssignments() {
        return [
            { title: 'DS Assignment', status: 'submitted', submitted: true },
            { title: 'DBMS Project', status: 'pending', submitted: false },
            { title: 'OS Lab', status: 'submitted', submitted: true }
        ];
    }

    // Initialize on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', loadAllAnalytics);
    } else {
        loadAllAnalytics();
    }

    // Export for global access
    window.StudentAnalytics = {
        refresh: loadAllAnalytics,
        data: analyticsData
    };

})();
