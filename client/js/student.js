// student.js - Handles student dashboard logic

// Wait for APP to be fully loaded
if (typeof APP === 'undefined') {
    console.error('APP not loaded');
    // Only redirect if not already on login page
    if (!window.location.pathname.includes('login.html')) {
        console.log('Redirecting to login...');
        window.location.href = '/login.html';
    }
    throw new Error('APP not loaded');
}

// Ensure user is authenticated and is a student
console.log('Checking authentication...');
console.log('Is authenticated:', APP.isAuthenticated());
console.log('User role:', APP.getUserRole());

if (!APP.isAuthenticated() || APP.getUserRole() !== 'student') {
    console.log('Authentication check failed');
    // Only redirect if not already on login page and not navigating within dashboard
    if (!window.location.pathname.includes('login.html')) {
        console.log('Redirecting to login...');
        window.location.href = '/login.html';
    }
    throw new Error('Not authenticated');
}

console.log('Authentication successful, loading dashboard...');
const user = APP.Storage.get('user') || {};
console.log('User data:', user);

// Safely set student name and welcome text
const studentNameEl = document.getElementById('studentName');
const studentWelcomeEl = document.getElementById('studentWelcome');

if (studentNameEl) {
    studentNameEl.textContent = user.name || 'Student';
}
if (studentWelcomeEl) {
    studentWelcomeEl.textContent = user.name || 'Student';
}

// Attendance Chart - Null-safe initialization
const attendanceChartEl = document.getElementById('attendanceChart');
const attendanceChartCtx = attendanceChartEl ? attendanceChartEl.getContext('2d') : null;
let attendanceChart;

// Marks Chart - Null-safe initialization
const marksChartEl = document.getElementById('marksChart');
const marksChartCtx = marksChartEl ? marksChartEl.getContext('2d') : null;
let marksChart;

async function loadAttendance() {
    try {
        if (!user.id) {
            console.warn('No user ID available for attendance');
            return;
        }
        let res;
        try {
            res = await APP.API.get(`/attendance/student/${user.id}`);
        } catch (e) {
            console.warn('Using dummy attendance data');
            res = DummyData?.getStudentAttendance?.();
        }
        if (res && res.success && res.data) {
            const { summary, records } = res.data;
            // Calculate overall percentage
            let totalPresent = 0, totalClasses = 0;
            if (summary && summary.length > 0) {
                summary.forEach(s => {
                    totalPresent += s.present_count;
                    totalClasses += s.total_classes;
                });
            }
            const percent = totalClasses > 0 ? Math.round((totalPresent / totalClasses) * 100) : 0;
            const attendancePercentEl = document.getElementById('attendancePercent');
            if (attendancePercentEl) {
                attendancePercentEl.textContent = percent + '%';
            }
            
            // Pie chart: Present vs Absent (only if canvas exists)
            if (attendanceChartCtx && totalClasses > 0) {
                if (attendanceChart) attendanceChart.destroy();
                attendanceChart = new Chart(attendanceChartCtx, {
                    type: 'doughnut',
                    data: {
                        labels: ['Present', 'Absent'],
                        datasets: [{
                            data: [totalPresent, totalClasses - totalPresent],
                            backgroundColor: ['#22c55e', '#ef4444'],
                        }]
                    },
                    options: { cutout: '70%', plugins: { legend: { display: false } } }
                });
            }
        }
    } catch (e) {
        console.error('Failed to load attendance:', e);
        const attendancePercentEl = document.getElementById('attendancePercent');
        if (attendancePercentEl) {
            attendancePercentEl.textContent = '--';
        }
    }
}

async function loadMarks() {
    try {
        if (!user.id) {
            console.warn('No user ID available for marks');
            return;
        }
        let res;
        try {
            res = await APP.API.get(`/marks/student/${user.id}`);
        } catch (e) {
            console.warn('Using dummy marks data');
            res = DummyData?.getStudentMarks?.();
        }
        if (res && res.success && res.data) {
            const { marks, summary } = res.data;
            
            // Calculate GPA (assuming 10-point scale)
            let totalPercentage = 0;
            let subjectCount = 0;
            
            if (summary && summary.length > 0) {
                summary.forEach(s => {
                    const percentage = (s.avg_marks / s.avg_total) * 100;
                    totalPercentage += percentage;
                    subjectCount++;
                });
            }
            
            const avgPercentage = subjectCount > 0 ? totalPercentage / subjectCount : 0;
            const gpa = (avgPercentage / 10).toFixed(2); // Convert percentage to 10-point GPA
            const marksGPAEl = document.getElementById('marksGPA');
            if (marksGPAEl) {
                marksGPAEl.textContent = gpa;
            }
            
            // Bar chart: Subject-wise marks (only if canvas exists)
            if (marksChartCtx && summary && summary.length > 0) {
                if (marksChart) marksChart.destroy();
                marksChart = new Chart(marksChartCtx, {
                    type: 'bar',
                    data: {
                        labels: summary.map(s => s.subject),
                        datasets: [{
                            label: 'Average Marks %',
                            data: summary.map(s => ((s.avg_marks / s.avg_total) * 100).toFixed(1)),
                            backgroundColor: '#6366f1',
                        }]
                    },
                    options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, max: 100 } } }
                });
            }
        }
    } catch (e) {
        console.error('Failed to load marks:', e);
        const marksGPAEl = document.getElementById('marksGPA');
        if (marksGPAEl) {
            marksGPAEl.textContent = '--';
        }
    }
}

async function loadEvents() {
    const list = document.getElementById('eventsList');
    if (!list) {
        console.warn('Events list element not found');
        return;
    }
    
    try {
        let res;
        try {
            res = await APP.API.get('/events');
        } catch (e) {
            console.warn('Using dummy events data');
            res = DummyData?.getEvents?.();
        }
        if (res && res.success && res.data && Array.isArray(res.data)) {
            list.innerHTML = '';
            res.data.slice(0, 5).forEach(ev => {
                const li = document.createElement('li');
                const eventDate = new Date(ev.event_date).toLocaleDateString();
                li.innerHTML = `<strong>${ev.title}</strong> <span class="event-date">${eventDate}</span>`;
                list.appendChild(li);
            });
            if (res.data.length === 0) list.innerHTML = '<li>No upcoming events</li>';
        } else {
            list.innerHTML = '<li>No upcoming events</li>';
        }
    } catch (e) {
        console.error('Failed to load events:', e);
        // Final fallback: dummy
        if (DummyData?.getEvents) {
            const res = DummyData.getEvents();
            list.innerHTML = '';
            res.data.slice(0, 5).forEach(ev => {
                const li = document.createElement('li');
                const eventDate = new Date(ev.event_date).toLocaleDateString();
                li.innerHTML = `<strong>${ev.title}</strong> <span class="event-date">${eventDate}</span>`;
                list.appendChild(li);
            });
        } else if (list) list.innerHTML = '<li>Failed to load events</li>';
    }
}

async function loadAssignments() {
    const list = document.getElementById('assignmentsList');
    if (!list) {
        console.warn('Assignments list element not found');
        return;
    }
    
    try {
        let res;
        try {
            res = await APP.API.get('/assignments/student');
        } catch (e) {
            console.warn('Using dummy assignments data');
            res = DummyData?.getAssignments?.();
        }
        if (res && res.success && res.data && Array.isArray(res.data)) {
            list.innerHTML = '';
            res.data.slice(0, 5).forEach(asg => {
                const li = document.createElement('li');
                const dueDate = new Date(asg.deadline).toLocaleDateString();
                const status = asg.submission_status || 'Not Submitted';
                li.innerHTML = `<strong>${asg.title}</strong> <span class="due-date">Due: ${dueDate}</span> <span class="status-${status.toLowerCase().replace(' ', '-')}">${status}</span>`;
                list.appendChild(li);
            });
            if (res.data.length === 0) list.innerHTML = '<li>No assignments</li>';
        } else {
            list.innerHTML = '<li>No assignments</li>';
        }
    } catch (e) {
        console.error('Failed to load assignments:', e);
        if (DummyData?.getAssignments) {
            const res = DummyData.getAssignments();
            list.innerHTML = '';
            res.data.slice(0, 5).forEach(asg => {
                const li = document.createElement('li');
                const dueDate = new Date(asg.deadline).toLocaleDateString();
                const status = asg.submission_status || 'Not Submitted';
                li.innerHTML = `<strong>${asg.title}</strong> <span class="due-date">Due: ${dueDate}</span> <span class="status-${status.toLowerCase().replace(' ', '-')}">${status}</span>`;
                list.appendChild(li);
            });
        } else if (list) list.innerHTML = '<li>Failed to load assignments</li>';
    }
}

async function loadDownloads() {
    const list = document.getElementById('downloadsList');
    if (!list) {
        console.warn('Downloads list element not found');
        return;
    }
    
    try {
        let res;
        try {
            res = await APP.API.get('/files?limit=5');
        } catch (e) {
            console.warn('Using dummy files data');
            res = DummyData?.getFiles?.();
        }
        if (res && res.success && res.data && res.data.files) {
            list.innerHTML = '';
            res.data.files.forEach(file => {
                const li = document.createElement('li');
                li.innerHTML = `<a href="/api/files/download/${file.id}" target="_blank">${file.original_name}</a> <span class="file-meta">${file.category || 'Document'}</span>`;
                list.appendChild(li);
            });
            if (res.data.files.length === 0) list.innerHTML = '<li>No files available</li>';
        } else {
            list.innerHTML = '<li>No files available</li>';
        }
    } catch (e) {
        console.error('Failed to load files:', e);
        if (DummyData?.getFiles) {
            const res = DummyData.getFiles();
            list.innerHTML = '';
            res.data.files.forEach(file => {
                const li = document.createElement('li');
                li.innerHTML = `<span>${file.original_name}</span> <span class="file-meta">${file.category || 'Document'}</span>`;
                list.appendChild(li);
            });
        } else if (list) list.innerHTML = '<li>Failed to load files</li>';
    }
}

async function loadTimetable() {
    const table = document.getElementById('timetableTable')?.getElementsByTagName('tbody')[0];
    if (!table) return;
    
    try {
        let res;
        try {
            res = await APP.API.get('/timetable');
        } catch (e) {
            console.warn('Using dummy timetable data');
            res = DummyData?.getTimetable?.();
        }
        if (res && res.success && res.data) {
            table.innerHTML = '';
            
            // Group timetable by day
            const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            const timetableByDay = {};
            
            res.data.forEach(slot => {
                if (!timetableByDay[slot.day_of_week]) {
                    timetableByDay[slot.day_of_week] = [];
                }
                timetableByDay[slot.day_of_week].push(slot);
            });
            
            // Create rows for each day
            days.forEach(day => {
                if (timetableByDay[day]) {
                    const tr = document.createElement('tr');
                    const slots = timetableByDay[day];
                    tr.innerHTML = `<td>${day}</td>` + slots.map(s => 
                        `<td>${s.subject}<br><small>${s.time_slot}</small></td>`
                    ).join('');
                    table.appendChild(tr);
                }
            });
            
            if (res.data.length === 0) {
                table.innerHTML = '<tr><td colspan="7">No timetable available</td></tr>';
            }
        }
    } catch (e) {
        console.error('Failed to load timetable:', e);
        table.innerHTML = '<tr><td colspan="7">Failed to load timetable</td></tr>';
    }
}

// Initial load with error isolation
(async function initializeDashboard() {
    console.log('🚀 Initializing dashboard...');
    
    // Load all functions independently so one failure doesn't break others
    try { await loadAttendance(); } catch (e) { console.error('Attendance load failed:', e); }
    try { await loadMarks(); } catch (e) { console.error('Marks load failed:', e); }
    try { await loadEvents(); } catch (e) { console.error('Events load failed:', e); }
    try { await loadAssignments(); } catch (e) { console.error('Assignments load failed:', e); }
    try { await loadDownloads(); } catch (e) { console.error('Downloads load failed:', e); }
    try { await loadTimetable(); } catch (e) { console.error('Timetable load failed:', e); }
    
    console.log('✅ Dashboard initialization complete');
})();

// Optionally, set up Socket.IO for real-time updates
if (APP.Socket) {
    APP.Socket.on('attendance:update', loadAttendance);
    APP.Socket.on('marks:update', loadMarks);
    APP.Socket.on('events:update', loadEvents);
    APP.Socket.on('assignments:update', loadAssignments);
    APP.Socket.on('files:update', loadDownloads);
    APP.Socket.on('timetable:update', loadTimetable);
}
