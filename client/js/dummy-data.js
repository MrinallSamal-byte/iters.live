/**
 * Enhanced Dummy Data Generator
 * Provides comprehensive, realistic sample data for ALL dashboard sections
 * Automatically generates varied data for each user
 */

// Utility functions
const getRandomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const getRandomElement = (arr) => arr[Math.floor(Math.random() * arr.length)];
const shuffleArray = (arr) => [...arr].sort(() => Math.random() - 0.5);

// Data pools
const subjects = {
    CSE: ['Data Structures', 'Algorithms', 'Database Management', 'Operating Systems', 'Computer Networks', 'Software Engineering', 'Web Development', 'Machine Learning'],
    IT: ['Web Development', 'Mobile Computing', 'Cloud Computing', 'Cyber Security', 'AI & ML', 'IoT', 'Big Data Analytics', 'DevOps'],
    ECE: ['Digital Electronics', 'Signals & Systems', 'VLSI Design', 'Embedded Systems', 'Communication Systems', 'Microprocessors', 'Control Systems', 'RF Engineering'],
    EEE: ['Power Systems', 'Control Systems', 'Electrical Machines', 'Power Electronics', 'Renewable Energy', 'Electric Drives', 'High Voltage Engineering', 'Smart Grid'],
    MECH: ['Thermodynamics', 'Fluid Mechanics', 'Manufacturing Processes', 'CAD/CAM', 'Machine Design', 'Heat Transfer', 'Robotics', 'Automotive Engineering'],
    CIVIL: ['Structural Analysis', 'Concrete Technology', 'Surveying', 'Geotechnical Engineering', 'Transportation Engineering', 'Hydraulics', 'Environmental Engineering', 'Construction Management']
};

const indianNames = {
    first: ['Aarav', 'Vivaan', 'Aditya', 'Arjun', 'Sai', 'Diya', 'Ananya', 'Isha', 'Priya', 'Sneha', 'Rohan', 'Karan', 'Akash', 'Rahul', 'Amit', 'Neha', 'Pooja', 'Riya', 'Shreya', 'Tanvi', 'Vikram', 'Rajesh', 'Meera', 'Kavya', 'Dhruv', 'Yash'],
    last: ['Sharma', 'Verma', 'Patel', 'Kumar', 'Singh', 'Reddy', 'Gupta', 'Joshi', 'Mehta', 'Nair', 'Rao', 'Desai', 'Kulkarni', 'Mishra', 'Pandey', 'Iyer', 'Malhotra']
};

const eventNames = [
    'TechFest 2025', 'Code Sprint', 'Cultural Night', 'Sports Championship', 'Innovation Summit',
    'AI Workshop', 'Debate Competition', 'Music Fest', 'Robotics Challenge', 'Startup Weekend',
    'Photography Exhibition', 'Dance Competition', 'Tech Talk Series', 'Career Fair', 'Freshers Welcome',
    'Hackathon', 'Blood Donation Camp', 'Environmental Awareness', 'Literary Fest', 'Science Exhibition'
];

const clubsList = [
    { name: 'Coding Club', category: 'Technical', icon: '💻' },
    { name: 'Robotics Club', category: 'Technical', icon: '🤖' },
    { name: 'Photography Club', category: 'Cultural', icon: '📸' },
    { name: 'Music Club', category: 'Cultural', icon: '🎵' },
    { name: 'Drama Society', category: 'Cultural', icon: '🎭' },
    { name: 'Sports Club', category: 'Sports', icon: '⚽' },
    { name: 'Entrepreneurship Cell', category: 'Professional', icon: '💼' },
    { name: 'Literary Society', category: 'Cultural', icon: '📚' },
    { name: 'Dance Club', category: 'Cultural', icon: '💃' },
    { name: 'IEEE Student Branch', category: 'Technical', icon: '⚡' }
];

// Central demo accounts
const DEMO_ACCOUNTS = {
    student: {
        id: 10001,
        registration_number: 'STU20250001',
        name: 'Aarav Sharma',
        email: 'student1@iter.edu',
        role: 'student',
        department: 'CSE',
        year: 2,
        section: 'A',
        semester: 3,
        blood_group: 'O+',
        profile_picture: '/uploads/avatars/default-avatar.svg'
    },
    teacher: {
        id: 20001,
        registration_number: 'TCH2025001',
        name: 'Dr. Priya Verma',
        email: 'teacher1@iter.edu',
        role: 'teacher',
        department: 'CSE',
        subjects_taught: 'Data Structures, Algorithms, Database Management',
        profile_picture: '/uploads/avatars/default-avatar.svg'
    },
    admin: {
        id: 30001,
        registration_number: 'ADM2025001',
        name: 'Admin User',
        email: 'admin@iter.edu',
        role: 'admin',
        department: 'Administration'
    }
};

// Main DummyData object
const DummyData = {
    // =========================================================================
    // DEMO ACCOUNTS & CREDENTIALS
    // =========================================================================
    getDemoUser(role = 'student') {
        return DEMO_ACCOUNTS[role] || DEMO_ACCOUNTS.student;
    },

    getDemoCredentials() {
        return [
            { role: 'student', registration_number: 'STU20250001', password: 'Student@123' },
            { role: 'teacher', registration_number: 'TCH2025001', password: 'Teacher@123' },
            { role: 'admin', registration_number: 'ADM2025001', password: 'Admin@123456' }
        ];
    },

    // =========================================================================
    // STUDENT DATA
    // =========================================================================
    
    /**
     * Get student attendance data with realistic variations
     */
    getStudentAttendance(userId) {
        const user = this._getUserData();
        const dept = user.department || 'CSE';
        const subjectList = subjects[dept] || subjects.CSE;
        
        const summary = subjectList.map(subject => {
            const totalClasses = getRandomInt(28, 35);
            const attendancePercent = getRandomInt(70, 98);
            const presentCount = Math.floor((totalClasses * attendancePercent) / 100);
            
            return {
                subject,
                present_count: presentCount,
                total_classes: totalClasses,
                percentage: Math.round((presentCount / totalClasses) * 100)
            };
        });

        // Detailed records for last 30 days
        const records = [];
        const today = new Date();
        for (let i = 0; i < 30; i++) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            if (date.getDay() === 0) continue; // Skip Sundays

            const subject = getRandomElement(subjectList);
            const status = Math.random() > 0.2 ? 'present' : (Math.random() > 0.5 ? 'absent' : 'late');
            
            records.push({
                id: i + 1,
                subject,
                date: date.toISOString().split('T')[0],
                status,
                marked_by: `Dr. ${getRandomElement(indianNames.first)} ${getRandomElement(indianNames.last)}`
            });
        }

        return {
            success: true,
            data: { summary, records }
        };
    },

    /**
     * Get student marks data with varied performance
     */
    getStudentMarks(userId) {
        const user = this._getUserData();
        const dept = user.department || 'CSE';
        const subjectList = subjects[dept] || subjects.CSE;
        
        const marks = [];
        const summary = [];

        subjectList.forEach(subject => {
            const basePerformance = getRandomInt(65, 95);
            
            // Internal marks
            const internal1 = Math.round((30 * getRandomInt(basePerformance - 10, basePerformance + 5)) / 100);
            const internal2 = Math.round((30 * getRandomInt(basePerformance - 10, basePerformance + 5)) / 100);
            const internal3 = Math.round((30 * getRandomInt(basePerformance - 10, basePerformance + 5)) / 100);
            
            // Assignment marks
            const assignment = Math.round((20 * getRandomInt(basePerformance - 5, basePerformance + 10)) / 100);
            
            // Quiz marks
            const quiz = Math.round((10 * getRandomInt(basePerformance - 15, basePerformance + 5)) / 100);
            
            // External marks
            const external = Math.round((100 * getRandomInt(basePerformance - 10, basePerformance)) / 100);

            marks.push(
                { id: marks.length + 1, subject, exam_type: 'Internal 1', marks_obtained: internal1, total_marks: 30, exam_date: '2024-09-15' },
                { id: marks.length + 2, subject, exam_type: 'Internal 2', marks_obtained: internal2, total_marks: 30, exam_date: '2024-10-20' },
                { id: marks.length + 3, subject, exam_type: 'Internal 3', marks_obtained: internal3, total_marks: 30, exam_date: '2024-12-10' },
                { id: marks.length + 4, subject, exam_type: 'Assignment', marks_obtained: assignment, total_marks: 20, exam_date: '2024-11-05' },
                { id: marks.length + 5, subject, exam_type: 'Quiz', marks_obtained: quiz, total_marks: 10, exam_date: '2024-10-30' },
                { id: marks.length + 6, subject, exam_type: 'External', marks_obtained: external, total_marks: 100, exam_date: '2025-01-15' }
            );

            const avgMarks = Math.round((internal1 + internal2 + internal3 + assignment + quiz + external) / 6);
            const avgTotal = Math.round((30 + 30 + 30 + 20 + 10 + 100) / 6);
            
            summary.push({
                subject,
                avg_marks: avgMarks,
                avg_total: avgTotal,
                percentage: Math.round((avgMarks / avgTotal) * 100)
            });
        });

        return {
            success: true,
            data: { marks, summary }
        };
    },

    /**
     * Get student timetable
     */
    getTimetable(userId) {
        const user = this._getUserData();
        const dept = user.department || 'CSE';
        const subjectList = subjects[dept] || subjects.CSE;
        
        const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const timeSlots = ['09:00-10:00', '10:00-11:00', '11:00-12:00', '12:00-13:00', '14:00-15:00', '15:00-16:00', '16:00-17:00'];
        
        const data = [];
        let subjectIndex = 0;

        days.forEach(day => {
            timeSlots.forEach((timeSlot, idx) => {
                // Add lunch break
                if (idx === 3) return;
                // Half day Wednesday
                if (day === 'Wednesday' && idx > 4) return;

                const subject = subjectList[subjectIndex % subjectList.length];
                const teacher = `Dr. ${getRandomElement(indianNames.first)} ${getRandomElement(indianNames.last)}`;
                const room = `${dept}-${getRandomInt(101, 450)}`;

                data.push({
                    id: data.length + 1,
                    day_of_week: day,
                    time_slot: timeSlot,
                    subject,
                    teacher_name: teacher,
                    room_number: room
                });

                subjectIndex++;
            });
        });

        return { success: true, data };
    },

    /**
     * Get student assignments
     */
    getAssignments(userId) {
        const user = this._getUserData();
        const dept = user.department || 'CSE';
        const subjectList = subjects[dept] || subjects.CSE;
        
        const data = [];
        const today = new Date();

        subjectList.forEach(subject => {
            for (let i = 1; i <= 3; i++) {
                const deadline = new Date(today);
                deadline.setDate(deadline.getDate() + getRandomInt(-5, 30));
                
                const isPast = deadline < today;
                const isSubmitted = isPast ? Math.random() > 0.2 : Math.random() > 0.5;
                
                let status;
                if (isSubmitted) {
                    status = Math.random() > 0.3 ? 'Submitted' : 'Graded';
                } else if (isPast) {
                    status = 'Overdue';
                } else {
                    status = 'Pending';
                }

                data.push({
                    id: data.length + 1,
                    title: `${subject} Assignment ${i}`,
                    description: `Complete assignment on ${subject}. Submit detailed solutions with proper documentation.`,
                    subject,
                    deadline: deadline.toISOString(),
                    submission_status: status,
                    marks_obtained: isSubmitted && Math.random() > 0.3 ? getRandomInt(15, 20) : null,
                    total_marks: 20,
                    submitted_at: isSubmitted ? new Date(deadline.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString() : null
                });
            }
        });

        return { success: true, data };
    },

    /**
     * Get events
     */
    getEvents(userId) {
        const data = [];
        const today = new Date();

        for (let i = 0; i < 15; i++) {
            const eventDate = new Date(today);
            eventDate.setDate(eventDate.getDate() + getRandomInt(1, 90));
            
            const categories = ['Technical', 'Cultural', 'Sports', 'Workshop', 'Seminar'];
            const category = getRandomElement(categories);

            data.push({
                id: i + 1,
                title: getRandomElement(eventNames),
                description: `Join us for an amazing ${category.toLowerCase()} event!`,
                event_date: eventDate.toISOString().split('T')[0],
                event_time: `${getRandomInt(9, 17)}:00:00`,
                location: getRandomElement(['Main Auditorium', 'Seminar Hall', 'Open Ground', 'Computer Lab', 'Library Hall']),
                category,
                max_participants: getRandomInt(50, 200),
                registered_count: getRandomInt(10, 100),
                is_registered: Math.random() > 0.6
            });
        }

        return { success: true, data };
    },

    /**
     * Get clubs
     */
    getClubs(userId) {
        const data = clubsList.map((club, idx) => ({
            id: idx + 1,
            name: club.name,
            description: `Join the ${club.name} and explore your interests in ${club.category.toLowerCase()} activities.`,
            category: club.category,
            icon: club.icon,
            member_count: getRandomInt(30, 150),
            is_member: Math.random() > 0.7,
            president: `${getRandomElement(indianNames.first)} ${getRandomElement(indianNames.last)}`,
            coordinator: `Dr. ${getRandomElement(indianNames.first)} ${getRandomElement(indianNames.last)}`
        }));

        return { success: true, data };
    },

    /**
     * Get files/notes
     */
    getFiles(filters = {}) {
        const user = this._getUserData();
        const dept = user.department || 'CSE';
        const subjectList = subjects[dept] || subjects.CSE;
        
        const files = [];

        subjectList.forEach(subject => {
            // Notes
            for (let unit = 1; unit <= 5; unit++) {
                files.push({
                    id: files.length + 1,
                    original_name: `${subject.replace(/\s+/g, '_')}_Unit${unit}_Notes.pdf`,
                    category: 'note',
                    subject,
                    uploaded_by_name: `Dr. ${getRandomElement(indianNames.first)} ${getRandomElement(indianNames.last)}`,
                    file_size: getRandomInt(500000, 5000000),
                    download_count: getRandomInt(50, 500),
                    created_at: new Date(Date.now() - getRandomInt(1, 90) * 24 * 60 * 60 * 1000).toISOString()
                });
            }

            // PYQs
            for (let year = 2020; year <= 2024; year++) {
                files.push({
                    id: files.length + 1,
                    original_name: `${subject.replace(/\s+/g, '_')}_PYQ_${year}.pdf`,
                    category: 'pyq',
                    subject,
                    uploaded_by_name: `Dr. ${getRandomElement(indianNames.first)} ${getRandomElement(indianNames.last)}`,
                    file_size: getRandomInt(300000, 2000000),
                    download_count: getRandomInt(100, 800),
                    created_at: new Date(Date.now() - getRandomInt(90, 365) * 24 * 60 * 60 * 1000).toISOString()
                });
            }
        });

        let filteredFiles = files;
        if (filters.category) {
            filteredFiles = filteredFiles.filter(f => f.category === filters.category);
        }
        if (filters.subject) {
            filteredFiles = filteredFiles.filter(f => f.subject === filters.subject);
        }

        return {
            success: true,
            data: {
                files: filteredFiles,
                pagination: { page: 1, limit: 20, total: filteredFiles.length, totalPages: Math.ceil(filteredFiles.length / 20) }
            }
        };
    },

    /**
     * Get admit card
     */
    getAdmitCard(userId) {
        const user = this._getUserData();
        const today = new Date();
        const examDate = new Date(today);
        examDate.setDate(examDate.getDate() + 60);

        return {
            success: true,
            data: {
                student_name: user.name || 'Student Name',
                registration_number: user.registration_number || 'STU20250001',
                department: user.department || 'CSE',
                year: user.year || 2,
                section: user.section || 'A',
                exam_name: `Semester ${(user.year || 2) * 2} End Examination 2025`,
                exam_date: examDate.toISOString().split('T')[0],
                verification_code: 'A3F7B9C2D5E8F1A4',
                qr_code: 'https://api.qrserver.com/v1/create-qr-code/?data=A3F7B9C2D5E8F1A4&size=200x200',
                file_url: '/uploads/admit_cards/admit_card_sample.pdf'
            }
        };
    },

    /**
     * Get hostel menu
     */
    getHostelMenu(date) {
        const menuDate = date ? new Date(date) : new Date();
        const dateStr = menuDate.toISOString().split('T')[0];

        const breakfastItems = ['Idli Sambar', 'Poha', 'Upma', 'Paratha with Curd', 'Bread Toast & Jam', 'Aloo Paratha'];
        const lunchItems = ['Rice, Dal, Sabji, Roti', 'Biryani with Raita', 'Chole Bhature', 'Rajma Chawal', 'Paneer Curry'];
        const snacksItems = ['Samosa', 'Pakora', 'Sandwich', 'Biscuits & Tea', 'Fruit', 'Vada Pav'];
        const dinnerItems = ['Roti, Dal, Rice', 'Noodles', 'Fried Rice', 'Pulao with Raita', 'Mixed Vegetables'];

        const data = [];
        for (let i = -7; i <= 7; i++) {
            const d = new Date(menuDate);
            d.setDate(d.getDate() + i);
            const dStr = d.toISOString().split('T')[0];

            data.push(
                { date: dStr, meal_type: 'breakfast', menu_items: getRandomElement(breakfastItems) },
                { date: dStr, meal_type: 'lunch', menu_items: getRandomElement(lunchItems) },
                { date: dStr, meal_type: 'snacks', menu_items: getRandomElement(snacksItems) },
                { date: dStr, meal_type: 'dinner', menu_items: getRandomElement(dinnerItems) }
            );
        }

        return { success: true, data };
    },

    /**
     * Get student fees
     */
    getFees(userId) {
        const user = this._getUserData();
        const year = user.year || 2;
        const data = [];

        for (let sem = 1; sem <= year * 2; sem++) {
            const amount = 75000;
            const isPaid = sem < year * 2 || Math.random() > 0.3;
            const paidAmount = isPaid ? amount : (Math.random() > 0.5 ? amount * 0.5 : 0);

            const today = new Date();
            const dueDate = new Date(today);
            dueDate.setMonth(dueDate.getMonth() - (year * 2 - sem) * 6);
            dueDate.setDate(15);

            let status;
            if (paidAmount === amount) status = 'paid';
            else if (paidAmount > 0) status = 'partial';
            else if (new Date() > dueDate) status = 'overdue';
            else status = 'pending';

            data.push({
                semester: sem,
                amount,
                paid_amount: paidAmount,
                due_date: dueDate.toISOString().split('T')[0],
                payment_status: status,
                transaction_id: paidAmount > 0 ? `TXN${Date.now()}${sem}` : null,
                payment_date: paidAmount > 0 ? new Date(dueDate.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] : null
            });
        }

        return { success: true, data };
    },

    // =========================================================================
    // TEACHER DATA
    // =========================================================================

    /**
     * Get teacher stats
     */
    getTeacherStats(userId) {
        return {
            success: true,
            data: {
                totalStudents: getRandomInt(80, 150),
                totalClasses: getRandomInt(4, 8),
                avgAttendance: getRandomInt(82, 94),
                pendingSubmissions: getRandomInt(5, 25),
                classAverage: getRandomInt(72, 85),
                assignmentsCreated: getRandomInt(15, 40),
                notesUploaded: getRandomInt(20, 60)
            }
        };
    },

    /**
     * Get teacher classes
     */
    getTeacherClasses(userId) {
        const user = this._getUserData();
        const dept = user.department || 'CSE';
        const teacherSubjects = (user.subjects_taught || '').split(',').map(s => s.trim());
        const subjectList = teacherSubjects.length > 0 ? teacherSubjects : (subjects[dept] || subjects.CSE).slice(0, 3);

        const data = subjectList.map((subject, idx) => ({
            id: idx + 1,
            class_name: `${dept} ${getRandomInt(1, 4)}-${getRandomElement(['A', 'B', 'C'])}`,
            subject,
            total_students: getRandomInt(35, 60),
            year: getRandomInt(1, 4),
            section: getRandomElement(['A', 'B', 'C'])
        }));

        return { success: true, data };
    },

    /**
     * Get teacher students
     */
    getTeacherStudents(filters = {}) {
        const count = filters.limit || 50;
        const data = [];

        for (let i = 1; i <= count; i++) {
            data.push({
                id: i,
                registration_number: `STU2025${String(i).padStart(4, '0')}`,
                name: `${getRandomElement(indianNames.first)} ${getRandomElement(indianNames.last)}`,
                email: `student${i}@iter.edu`,
                department: filters.department || 'CSE',
                year: filters.year || getRandomInt(1, 4),
                section: filters.section || getRandomElement(['A', 'B', 'C']),
                attendance_percent: getRandomInt(70, 98),
                avg_marks: getRandomInt(65, 95)
            });
        }

        return { success: true, data };
    },

    /**
     * Get teacher assignments
     */
    getTeacherAssignments(userId) {
        const user = this._getUserData();
        const dept = user.department || 'CSE';
        const subjectList = (subjects[dept] || subjects.CSE).slice(0, 3);
        
        const data = [];
        const today = new Date();

        subjectList.forEach(subject => {
            for (let i = 1; i <= 5; i++) {
                const deadline = new Date(today);
                deadline.setDate(deadline.getDate() + getRandomInt(-20, 40));
                
                const totalStudents = getRandomInt(35, 60);
                const submissions = Math.floor(totalStudents * getRandomInt(60, 95) / 100);

                data.push({
                    id: data.length + 1,
                    title: `${subject} Assignment ${i}`,
                    subject,
                    description: `Assignment on ${subject} topics`,
                    deadline: deadline.toISOString(),
                    total_marks: 20,
                    total_students: totalStudents,
                    submissions_count: submissions,
                    pending_count: totalStudents - submissions,
                    graded_count: Math.floor(submissions * 0.7),
                    class_name: `${dept} ${getRandomInt(1, 4)}-${getRandomElement(['A', 'B', 'C'])}`
                });
            }
        });

        return { success: true, data };
    },

    /**
     * Get pending submissions for teacher
     */
    getTeacherSubmissions(status = 'pending') {
        if (status !== 'pending') return { success: true, data: [] };

        const data = [];
        const today = new Date();

        for (let i = 1; i <= 15; i++) {
            const submittedDate = new Date(today);
            submittedDate.setDate(submittedDate.getDate() - getRandomInt(1, 10));

            data.push({
                id: i,
                assignment_title: `Assignment ${i}`,
                student_name: `${getRandomElement(indianNames.first)} ${getRandomElement(indianNames.last)}`,
                student_reg: `STU2025${String(i).padStart(4, '0')}`,
                submitted_at: submittedDate.toISOString(),
                file_name: `submission_${i}.pdf`,
                status: 'pending'
            });
        }

        return { success: true, data };
    },

    /**
     * Get teacher attendance records
     */
    getTeacherAttendance(filters = {}) {
        const subject = filters.subject || 'Data Structures';
        const date = filters.date || new Date().toISOString().split('T')[0];
        
        const students = this.getTeacherStudents({ limit: 40 }).data;
        const data = students.map(student => ({
            ...student,
            status: getRandomElement(['present', 'present', 'present', 'present', 'absent', 'late']), // 80% present
            marked: Math.random() > 0.2
        }));

        return { success: true, data };
    },

    // =========================================================================
    // ADMIN DATA
    // =========================================================================

    /**
     * Get admin statistics
     */
    getAdminStats(userId) {
        return {
            success: true,
            data: {
                totalUsers: getRandomInt(1200, 1500),
                totalStudents: getRandomInt(1000, 1300),
                totalTeachers: getRandomInt(80, 120),
                totalAdmins: 3,
                pendingApprovals: getRandomInt(5, 20),
                totalFiles: getRandomInt(300, 500),
                totalAssignments: getRandomInt(100, 200),
                totalEvents: getRandomInt(10, 30),
                avgAttendance: getRandomInt(85, 92),
                activeClubs: clubsList.length,
                departments: [
                    { name: 'CSE', count: getRandomInt(300, 450) },
                    { name: 'ECE', count: getRandomInt(250, 380) },
                    { name: 'MECH', count: getRandomInt(200, 320) },
                    { name: 'CIVIL', count: getRandomInt(180, 280) },
                    { name: 'IT', count: getRandomInt(150, 250) },
                    { name: 'EEE', count: getRandomInt(140, 230) }
                ]
            }
        };
    },

    /**
     * Get all users for admin
     */
    getAdminUsers(filters = {}) {
        const count = filters.limit || 50;
        const data = [];

        for (let i = 1; i <= count; i++) {
            const role = getRandomElement(['student', 'student', 'student', 'student', 'teacher']);
            const dept = getRandomElement(['CSE', 'IT', 'ECE', 'EEE', 'MECH', 'CIVIL']);

            data.push({
                id: i,
                registration_number: role === 'student' ? `STU2025${String(i).padStart(4, '0')}` : `TCH2025${String(i).padStart(3, '0')}`,
                name: `${getRandomElement(indianNames.first)} ${getRandomElement(indianNames.last)}`,
                email: `user${i}@iter.edu`,
                role,
                department: dept,
                year: role === 'student' ? getRandomInt(1, 4) : null,
                section: role === 'student' ? getRandomElement(['A', 'B', 'C']) : null,
                is_active: Math.random() > 0.1,
                last_login: new Date(Date.now() - getRandomInt(0, 30) * 24 * 60 * 60 * 1000).toISOString()
            });
        }

        // Apply filters
        let filtered = data;
        if (filters.role) filtered = filtered.filter(u => u.role === filters.role);
        if (filters.department) filtered = filtered.filter(u => u.department === filters.department);
        if (filters.search) {
            const q = filters.search.toLowerCase();
            filtered = filtered.filter(u => 
                u.name.toLowerCase().includes(q) || 
                u.email.toLowerCase().includes(q) || 
                u.registration_number.toLowerCase().includes(q)
            );
        }

        return { success: true, data: filtered };
    },

    /**
     * Get admin approvals queue
     */
    getAdminApprovals() {
        const data = [];
        const today = new Date();

        for (let i = 1; i <= 12; i++) {
            const createdDate = new Date(today);
            createdDate.setDate(createdDate.getDate() - getRandomInt(0, 10));

            data.push({
                id: i,
                type: getRandomElement(['notes', 'assignment', 'pyq', 'announcement']),
                title: `${getRandomElement(['Data Structures', 'Algorithms', 'Database'])} - ${getRandomElement(['Notes', 'Assignment', 'Question Paper'])}`,
                uploaded_by: `${getRandomElement(indianNames.first)} ${getRandomElement(indianNames.last)}`,
                created_at: createdDate.toISOString(),
                status: 'pending'
            });
        }

        return { success: true, data };
    },

    /**
     * Get admin announcements
     */
    getAdminAnnouncements() {
        const templates = [
            { title: 'Semester Registration', content: 'Registration for next semester is now open.', category: 'Academic' },
            { title: 'Exam Schedule Released', content: 'End semester exam schedule has been published.', category: 'Exam' },
            { title: 'Holiday Notice', content: 'College will remain closed on upcoming festival.', category: 'General' },
            { title: 'Workshop Announcement', content: 'Industry experts to conduct workshop series.', category: 'Event' },
            { title: 'Fee Payment Reminder', content: 'Last date for fee payment approaching.', category: 'Urgent' }
        ];

        const data = templates.map((t, idx) => ({
            id: idx + 1,
            ...t,
            target_audience: getRandomElement(['all', 'students', 'teachers']),
            posted_by: `Dr. ${getRandomElement(indianNames.first)} ${getRandomElement(indianNames.last)}`,
            created_at: new Date(Date.now() - idx * 24 * 60 * 60 * 1000).toISOString(),
            is_pinned: idx < 2
        }));

        return { success: true, data };
    },

    /**
     * Get departments
     */
    getDepartments() {
        const data = Object.keys(subjects).map((code, idx) => ({
            id: idx + 1,
            code,
            name: this._getDepartmentFullName(code),
            hod: `Dr. ${getRandomElement(indianNames.first)} ${getRandomElement(indianNames.last)}`,
            total_students: getRandomInt(200, 450),
            total_teachers: getRandomInt(20, 45),
            active_courses: getRandomInt(30, 60)
        }));

        return { success: true, data };
    },

    // =========================================================================
    // HELPER METHODS
    // =========================================================================

    _getUserData() {
        try {
            const userStr = localStorage.getItem('user');
            return userStr ? JSON.parse(userStr) : DEMO_ACCOUNTS.student;
        } catch {
            return DEMO_ACCOUNTS.student;
        }
    },

    _getDepartmentFullName(code) {
        const names = {
            CSE: 'Computer Science & Engineering',
            IT: 'Information Technology',
            ECE: 'Electronics & Communication Engineering',
            EEE: 'Electrical & Electronics Engineering',
            MECH: 'Mechanical Engineering',
            CIVIL: 'Civil Engineering'
        };
        return names[code] || code;
    },

    // Legacy methods for backward compatibility
    getUsers() {
        return this.getAdminUsers();
    },

    getStudents() {
        return this.getAdminUsers({ role: 'student' });
    },

    getTeachers() {
        return this.getAdminUsers({ role: 'teacher' });
    }
};

// Export for use in other scripts
if (typeof window !== 'undefined') {
    window.DummyData = DummyData;
    window.DEMO_ACCOUNTS = DEMO_ACCOUNTS;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = DummyData;
}
