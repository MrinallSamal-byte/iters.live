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

    // Sample timetable data
    const sampleTimetable = {
        'Monday': [
            { subject: 'Data Structures', room: 'Room 301', faculty: 'Dr. Smith' },
            { subject: 'Database Systems', room: 'Room 205', faculty: 'Prof. Johnson' },
            { subject: 'Computer Networks', room: 'Lab 1', faculty: 'Dr. Williams' },
            { type: 'break', label: 'Lunch Break' },
            { subject: 'Software Engineering', room: 'Room 401', faculty: 'Prof. Brown' },
            { subject: 'Lab - Data Structures', room: 'Lab 2', faculty: 'Dr. Smith' },
            { subject: 'Lab - Data Structures', room: 'Lab 2', faculty: 'Dr. Smith' },
            { type: 'free' }
        ],
        'Tuesday': [
            { subject: 'Database Systems', room: 'Room 205', faculty: 'Prof. Johnson' },
            { subject: 'Software Engineering', room: 'Room 401', faculty: 'Prof. Brown' },
            { subject: 'Computer Networks', room: 'Room 303', faculty: 'Dr. Williams' },
            { type: 'break', label: 'Lunch Break' },
            { subject: 'Data Structures', room: 'Room 301', faculty: 'Dr. Smith' },
            { subject: 'Lab - Database', room: 'Lab 3', faculty: 'Prof. Johnson' },
            { subject: 'Lab - Database', room: 'Lab 3', faculty: 'Prof. Johnson' },
            { type: 'free' }
        ],
        'Wednesday': [
            { subject: 'Computer Networks', room: 'Room 303', faculty: 'Dr. Williams' },
            { subject: 'Data Structures', room: 'Room 301', faculty: 'Dr. Smith' },
            { subject: 'Software Engineering', room: 'Room 401', faculty: 'Prof. Brown' },
            { type: 'break', label: 'Lunch Break' },
            { subject: 'Database Systems', room: 'Room 205', faculty: 'Prof. Johnson' },
            { subject: 'Tutorial - Networks', room: 'Room 102', faculty: 'Dr. Williams' },
            { type: 'free' },
            { type: 'free' }
        ],
        'Thursday': [
            { subject: 'Software Engineering', room: 'Room 401', faculty: 'Prof. Brown' },
            { subject: 'Computer Networks', room: 'Room 303', faculty: 'Dr. Williams' },
            { subject: 'Data Structures', room: 'Room 301', faculty: 'Dr. Smith' },
            { type: 'break', label: 'Lunch Break' },
            { subject: 'Database Systems', room: 'Room 205', faculty: 'Prof. Johnson' },
            { subject: 'Lab - Software Engg', room: 'Lab 4', faculty: 'Prof. Brown' },
            { subject: 'Lab - Software Engg', room: 'Lab 4', faculty: 'Prof. Brown' },
            { type: 'free' }
        ],
        'Friday': [
            { subject: 'Database Systems', room: 'Room 205', faculty: 'Prof. Johnson' },
            { subject: 'Data Structures', room: 'Room 301', faculty: 'Dr. Smith' },
            { subject: 'Computer Networks', room: 'Room 303', faculty: 'Dr. Williams' },
            { type: 'break', label: 'Lunch Break' },
            { subject: 'Software Engineering', room: 'Room 401', faculty: 'Prof. Brown' },
            { type: 'seminar', label: 'Department Seminar' },
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
