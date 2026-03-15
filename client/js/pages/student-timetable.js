// Student Timetable Page
(function() {
    'use strict';

    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const timeSlots = [
        '9:00 - 10:00',
        '10:00 - 11:00',
        '11:00 - 12:00',
        '12:00 - 1:00',
        '1:00 - 2:00',
        '2:00 - 3:00',
        '3:00 - 4:00',
        '4:00 - 5:00'
    ];

    // Sample timetable data with realistic Indian faculty names
    const sampleTimetable = {
        'Monday': [
            { subject: 'Data Structures',       room: 'CSE-301', faculty: 'Dr. Priya Verma' },
            { subject: 'Database Systems',       room: 'CSE-205', faculty: 'Prof. Arun Kumar' },
            { subject: 'Computer Networks',      room: 'Lab-1',   faculty: 'Dr. Meera Nair' },
            { type: 'break', label: 'Lunch Break' },
            { subject: 'Software Engineering',   room: 'CSE-401', faculty: 'Dr. Ramesh Patel' },
            { subject: 'Lab - Data Structures',  room: 'Lab-2',   faculty: 'Dr. Priya Verma' },
            { subject: 'Lab - Data Structures',  room: 'Lab-2',   faculty: 'Dr. Priya Verma' },
            { type: 'free' }
        ],
        'Tuesday': [
            { subject: 'Database Systems',       room: 'CSE-205', faculty: 'Prof. Arun Kumar' },
            { subject: 'Software Engineering',   room: 'CSE-401', faculty: 'Dr. Ramesh Patel' },
            { subject: 'Computer Networks',      room: 'CSE-303', faculty: 'Dr. Meera Nair' },
            { type: 'break', label: 'Lunch Break' },
            { subject: 'Data Structures',        room: 'CSE-301', faculty: 'Dr. Priya Verma' },
            { subject: 'Lab - Database Systems', room: 'Lab-3',   faculty: 'Prof. Arun Kumar' },
            { subject: 'Lab - Database Systems', room: 'Lab-3',   faculty: 'Prof. Arun Kumar' },
            { type: 'free' }
        ],
        'Wednesday': [
            { subject: 'Computer Networks',      room: 'CSE-303', faculty: 'Dr. Meera Nair' },
            { subject: 'Data Structures',        room: 'CSE-301', faculty: 'Dr. Priya Verma' },
            { subject: 'Software Engineering',   room: 'CSE-401', faculty: 'Dr. Ramesh Patel' },
            { type: 'break', label: 'Lunch Break' },
            { subject: 'Database Systems',       room: 'CSE-205', faculty: 'Prof. Arun Kumar' },
            { subject: 'Tutorial - Networks',    room: 'CSE-102', faculty: 'Dr. Meera Nair' },
            { type: 'free' },
            { type: 'free' }
        ],
        'Thursday': [
            { subject: 'Software Engineering',   room: 'CSE-401', faculty: 'Dr. Ramesh Patel' },
            { subject: 'Computer Networks',      room: 'CSE-303', faculty: 'Dr. Meera Nair' },
            { subject: 'Data Structures',        room: 'CSE-301', faculty: 'Dr. Priya Verma' },
            { type: 'break', label: 'Lunch Break' },
            { subject: 'Database Systems',       room: 'CSE-205', faculty: 'Prof. Arun Kumar' },
            { subject: 'Lab - Software Engg',    room: 'Lab-4',   faculty: 'Dr. Ramesh Patel' },
            { subject: 'Lab - Software Engg',    room: 'Lab-4',   faculty: 'Dr. Ramesh Patel' },
            { type: 'free' }
        ],
        'Friday': [
            { subject: 'Database Systems',       room: 'CSE-205', faculty: 'Prof. Arun Kumar' },
            { subject: 'Data Structures',        room: 'CSE-301', faculty: 'Dr. Priya Verma' },
            { subject: 'Computer Networks',      room: 'CSE-303', faculty: 'Dr. Meera Nair' },
            { type: 'break', label: 'Lunch Break' },
            { subject: 'Software Engineering',   room: 'CSE-401', faculty: 'Dr. Ramesh Patel' },
            { type: 'seminar', label: 'Dept. Seminar' },
            { type: 'free' },
            { type: 'free' }
        ],
        'Saturday': [
            { type: 'free' },
            { type: 'free' },
            { type: 'free' },
            { type: 'break', label: 'Break' },
            { type: 'free' },
            { type: 'free' },
            { type: 'free' },
            { type: 'free' }
        ]
    };

    function init() {
        loadTimetable();
        highlightCurrentDay();
        highlightCurrentClass();
        
        // Update every minute
        setInterval(() => {
            highlightCurrentClass();
        }, 60000);
    }

    function loadTimetable() {
        const tbody = document.getElementById('timetableBody');
        if (!tbody) return;

        let html = '';
        const today = days[new Date().getDay() - 1]; // Monday = 0

        days.forEach(day => {
            const dayClasses = sampleTimetable[day] || [];
            const isToday = day === today;
            
            html += `<tr>`;
            html += `<td class="day-header ${isToday ? 'today' : ''}">${day}</td>`;
            
            dayClasses.forEach(classInfo => {
                if (classInfo.type === 'break') {
                    html += `<td class="break-cell">${classInfo.label}</td>`;
                } else if (classInfo.type === 'free') {
                    html += `<td style="background: rgba(255,255,255,0.01);">-</td>`;
                } else if (classInfo.type === 'seminar') {
                    html += `<td style="background: rgba(139, 233, 253, 0.1);">${classInfo.label}</td>`;
                } else {
                    html += `
                        <td class="class-cell" data-day="${day}" data-subject="${classInfo.subject}">
                            <div class="subject-name">${classInfo.subject}</div>
                            <div class="class-room">${classInfo.room}</div>
                        </td>
                    `;
                }
            });
            
            html += `</tr>`;
        });

        tbody.innerHTML = html;
    }

    function highlightCurrentDay() {
        const now = new Date();
        const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
        
        if (currentDay >= 1 && currentDay <= 6) {
            const dayIndex = currentDay - 1;
            const rows = document.querySelectorAll('#timetableBody tr');
            if (rows[dayIndex]) {
                rows[dayIndex].style.background = 'rgba(102, 234, 126, 0.05)';
            }
        }
    }

    function highlightCurrentClass() {
        const now = new Date();
        const currentHour = now.getHours();
        const currentDay = days[now.getDay() - 1];

        if (!currentDay) return; // Sunday

        // Determine current time slot (9 AM to 5 PM)
        let slotIndex = -1;
        if (currentHour >= 9 && currentHour < 17) {
            slotIndex = currentHour - 9;
        }

        if (slotIndex >= 0 && slotIndex < 8) {
            const dayClasses = sampleTimetable[currentDay];
            if (dayClasses && dayClasses[slotIndex]) {
                const currentClass = dayClasses[slotIndex];
                
                // Highlight cell
                const cells = document.querySelectorAll('.class-cell');
                cells.forEach(cell => {
                    if (cell.dataset.day === currentDay && cell.dataset.subject === currentClass.subject) {
                        cell.classList.add('current');
                    }
                });

                // Show current class info
                if (currentClass.subject) {
                    showCurrentClassInfo(currentClass, timeSlots[slotIndex]);
                }
            }
        }
    }

    function showCurrentClassInfo(classInfo, timeSlot) {
        const infoSection = document.getElementById('currentClassInfo');
        if (!infoSection) return;

        document.getElementById('currentSubject').textContent = classInfo.subject || '-';
        document.getElementById('currentTime').textContent = timeSlot || '-';
        document.getElementById('currentRoom').textContent = classInfo.room || '-';
        document.getElementById('currentFaculty').textContent = classInfo.faculty || '-';

        infoSection.style.display = 'block';
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
