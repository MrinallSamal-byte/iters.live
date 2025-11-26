/**
 * AI Chatbot Widget - Smart Role-Aware Assistant
 * Intelligent AI-powered assistant that adapts to user role (student, teacher, admin, guest)
 * Part of ITER EduHub Enhancement Suite
 */

class Chatbot {
    constructor() {
        this.isOpen = false;
        this.isLoading = false;
        this.messages = [];
        this.container = null;
        this.toggleBtn = null;
        this.messagesContainer = null;
        this.input = null;
        this.userRole = this.detectUserRole();
        this.pageContext = this.detectPageContext();
        
        // Initialize role-specific configurations
        this.initRoleConfig();
        this.init();
    }

    /**
     * Detect user role from localStorage, URL, or page context
     */
    detectUserRole() {
        // Check localStorage for user data
        const userData = localStorage.getItem('user');
        if (userData) {
            try {
                const user = JSON.parse(userData);
                if (user.role) return user.role.toLowerCase();
            } catch (e) {}
        }

        // Check for demo role in localStorage
        const demoRole = localStorage.getItem('demoRole');
        if (demoRole) return demoRole.toLowerCase();

        // Detect from URL path
        const path = window.location.pathname.toLowerCase();
        if (path.includes('/dashboard/student') || path.includes('student.html')) return 'student';
        if (path.includes('/dashboard/teacher') || path.includes('teacher.html')) return 'teacher';
        if (path.includes('/dashboard/admin') || path.includes('admin.html')) return 'admin';
        
        // Default to guest for public pages
        return 'guest';
    }

    /**
     * Detect current page context
     */
    detectPageContext() {
        const path = window.location.pathname.toLowerCase();
        
        if (path === '/' || path.includes('index.html')) return 'home';
        if (path.includes('creator')) return 'creator';
        if (path.includes('login')) return 'login';
        if (path.includes('register')) return 'register';
        if (path.includes('attendance')) return 'attendance';
        if (path.includes('marks')) return 'marks';
        if (path.includes('timetable')) return 'timetable';
        if (path.includes('notes')) return 'notes';
        if (path.includes('assignment')) return 'assignments';
        if (path.includes('events')) return 'events';
        if (path.includes('clubs')) return 'clubs';
        if (path.includes('hostel') || path.includes('mess')) return 'hostel';
        if (path.includes('forum')) return 'forum';
        if (path.includes('admit-card')) return 'admitcard';
        if (path.includes('analytics')) return 'analytics';
        if (path.includes('users')) return 'users';
        if (path.includes('approvals')) return 'approvals';
        if (path.includes('announcements')) return 'announcements';
        if (path.includes('departments')) return 'departments';
        if (path.includes('settings')) return 'settings';
        if (path.includes('question-bank')) return 'questionbank';
        if (path.includes('rubric')) return 'rubric';
        if (path.includes('students')) return 'mystudents';
        
        return 'dashboard';
    }

    /**
     * Initialize role-specific configurations
     */
    initRoleConfig() {
        // Role-specific FAQ databases
        this.faqDatabases = {
            student: this.getStudentFAQ(),
            teacher: this.getTeacherFAQ(),
            admin: this.getAdminFAQ(),
            guest: this.getGuestFAQ()
        };

        // Role-specific quick actions
        this.quickActionsConfig = {
            student: [
                { text: '📊 Attendance', query: 'Check my attendance' },
                { text: '📈 Marks', query: 'View my marks' },
                { text: '📝 Study Notes', query: 'Study materials and PYQs' },
                { text: '💡 Solve Question', query: 'Help me solve a question' }
            ],
            teacher: [
                { text: '📊 Mark Attendance', query: 'How to mark attendance?' },
                { text: '📈 Upload Marks', query: 'How to upload student marks?' },
                { text: '📝 Assignments', query: 'Create and manage assignments' },
                { text: '👥 My Students', query: 'View my students' }
            ],
            admin: [
                { text: '👥 Users', query: 'Manage users' },
                { text: '✅ Approvals', query: 'Pending approvals' },
                { text: '📊 Analytics', query: 'System analytics' },
                { text: '📢 Announcements', query: 'Create announcements' }
            ],
            guest: [
                { text: '🎓 About ITER', query: 'Tell me about ITER' },
                { text: '✨ Features', query: 'What features does EduHub have?' },
                { text: '📱 How to Register', query: 'How to register?' },
                { text: '🔐 Login Help', query: 'How to login?' }
            ]
        };

        // Set current quick actions based on role
        this.quickActions = this.quickActionsConfig[this.userRole] || this.quickActionsConfig.guest;
    }

    /**
     * Student-specific FAQ database
     */
    getStudentFAQ() {
        return {
            // Attendance
            'attendance': {
                keywords: ['attendance', 'present', 'absent', 'percentage', 'classes', 'check attendance'],
                answer: `📊 <strong>Attendance Tracking</strong>\n\nView your attendance in the <a href="/dashboard/student-attendance.html" class="nav-suggestion">📊 Attendance Section</a>.\n\n<strong>Features:</strong>\n• Subject-wise attendance breakdown\n• Heatmap calendar visualization\n• Low attendance alerts (below 75%)\n• Attendance prediction\n\n<strong>Tip:</strong> Minimum 75% attendance is required for exam eligibility!`
            },
            'low attendance': {
                keywords: ['low attendance', 'shortage', 'attendance issue', 'below 75', 'attendance problem'],
                answer: `⚠️ <strong>Low Attendance Alert</strong>\n\nIf your attendance is below 75%:\n1. Submit an attendance regularization form\n2. Contact your department HOD\n3. Provide medical certificates if applicable\n4. Attend extra classes if available\n\nCheck your status: <a href="/dashboard/student-attendance.html" class="nav-suggestion">📊 Attendance Section</a>`
            },
            // Marks & Performance
            'marks': {
                keywords: ['marks', 'grades', 'result', 'cgpa', 'sgpa', 'performance', 'view marks', 'my marks'],
                answer: `📈 <strong>Academic Performance</strong>\n\nView your marks in <a href="/dashboard/student-marks.html" class="nav-suggestion">📈 Marks Section</a>.\n\n<strong>Available:</strong>\n• Subject-wise marks breakdown\n• SGPA/CGPA calculation\n• Performance trends & analytics\n• Grade distribution charts\n• Semester comparison\n\n<strong>Tip:</strong> Track your progress regularly to identify areas for improvement!`
            },
            // Study & Learning
            'solve': {
                keywords: ['solve', 'question', 'problem', 'help me', 'answer', 'solution', 'doubt', 'stuck'],
                answer: `💡 <strong>I'd love to help you solve problems!</strong>\n\nHere's how I can assist:\n\n1. <strong>Share your question</strong> - Type it out or describe the topic\n2. <strong>Tell me the subject</strong> - Math, Physics, Programming, etc.\n3. <strong>Show your attempt</strong> - I can guide you from where you're stuck\n\n<strong>Resources:</strong>\n• <a href="/dashboard/student-notes.html" class="nav-suggestion">📚 Study Notes</a> - Reference materials\n• <a href="/dashboard/student-forum.html" class="nav-suggestion">💬 Forum</a> - Ask peers & faculty\n• <a href="/dashboard/student-notes.html?type=pyqs" class="nav-suggestion">📝 PYQs</a> - Practice problems\n\nGo ahead, share your question! 🎯`
            },
            'notes': {
                keywords: ['notes', 'study material', 'pdf', 'lecture notes', 'materials', 'study'],
                answer: `📚 <strong>Study Materials</strong>\n\nAccess resources in <a href="/dashboard/student-notes.html" class="nav-suggestion">📚 Study Notes</a>.\n\n<strong>Available:</strong>\n• Subject-wise lecture notes\n• PDF presentations\n• Video lecture links\n• Reference materials\n• <a href="/dashboard/student-notes.html?type=pyqs" class="nav-suggestion">📝 Previous Year Questions (PYQs)</a>\n\n<strong>Tip:</strong> Download notes for offline study!`
            },
            'pyq': {
                keywords: ['pyq', 'previous year', 'question papers', 'old papers', 'question bank', 'past papers'],
                answer: `📝 <strong>Previous Year Questions</strong>\n\nAccess PYQs in <a href="/dashboard/student-notes.html?type=pyqs" class="nav-suggestion">📚 PYQ Section</a>.\n\n<strong>Features:</strong>\n• Filter by subject, year & exam type\n• Download question papers\n• View solutions (where available)\n• Practice mode\n\n<strong>Pro Tip:</strong> Solve PYQs to understand exam patterns!`
            },
            // Timetable
            'timetable': {
                keywords: ['timetable', 'schedule', 'classes', 'timings', 'lecture', 'class schedule'],
                answer: `📅 <strong>Class Schedule</strong>\n\nView your timetable in <a href="/dashboard/student-timetable.html" class="nav-suggestion">📅 Timetable</a>.\n\n<strong>Features:</strong>\n• Daily/weekly class schedule\n• Current class highlight\n• Subject & faculty details\n• Room numbers\n• Break timings\n\n<strong>Tip:</strong> Check for any schedule changes in announcements!`
            },
            // Exams
            'exam': {
                keywords: ['exam', 'examination', 'test', 'mid term', 'end term', 'semester'],
                answer: `📝 <strong>Examination Information</strong>\n\n<strong>Before Exam:</strong>\n• Download admit card: <a href="/dashboard/student-admit-card.html" class="nav-suggestion">🎫 Admit Card</a>\n• Check exam schedule on notice board\n• Review <a href="/dashboard/student-notes.html?type=pyqs" class="nav-suggestion">📝 PYQs</a>\n\n<strong>On Exam Day:</strong>\n• Carry college ID & admit card\n• Report 30 mins before exam\n• Bring necessary stationery\n\nGood luck! 🍀`
            },
            'admit card': {
                keywords: ['admit card', 'hall ticket', 'exam card', 'download admit'],
                answer: `🎫 <strong>Admit Card</strong>\n\nDownload from <a href="/dashboard/student-admit-card.html" class="nav-suggestion">🎫 Admit Card Section</a>.\n\n<strong>Includes:</strong>\n• Your photo & details\n• Exam schedule\n• Examination center\n• Important instructions\n• QR code verification\n\n<strong>Important:</strong> Print and keep it safe!`
            },
            // Events & Activities
            'events': {
                keywords: ['events', 'fest', 'competition', 'activities', 'techfest', 'cultural'],
                answer: `🎉 <strong>Events & Activities</strong>\n\nExplore events in <a href="/dashboard/student-events.html" class="nav-suggestion">🎉 Events Section</a>.\n\n<strong>Upcoming:</strong>\n• Technical fests\n• Cultural events\n• Workshops & seminars\n• Competitions\n• Sports events\n\n<strong>Tip:</strong> Register early - seats fill up fast!`
            },
            'clubs': {
                keywords: ['clubs', 'society', 'join', 'member', 'technical club', 'cultural club'],
                answer: `🎭 <strong>Student Clubs</strong>\n\nExplore clubs in <a href="/dashboard/student-clubs.html" class="nav-suggestion">🎭 Clubs Section</a>.\n\n<strong>Categories:</strong>\n• Technical clubs (Coding, Robotics, AI/ML)\n• Cultural societies (Music, Dance, Drama)\n• Sports teams\n• Professional chapters (IEEE, ACM)\n\n<strong>Tip:</strong> Join clubs to build skills & network!`
            },
            // Hostel
            'hostel': {
                keywords: ['hostel', 'room', 'accommodation', 'hostel fee', 'room complaint'],
                answer: `🏨 <strong>Hostel Services</strong>\n\nAccess hostel info in <a href="/dashboard/student-hostel-menu.html" class="nav-suggestion">🏨 Hostel Section</a>.\n\n<strong>Features:</strong>\n• Weekly mess menu\n• Room complaint form\n• Hostel rules & guidelines\n• Leave application\n• Room allocation details`
            },
            'mess': {
                keywords: ['mess', 'menu', 'food', 'canteen', 'lunch', 'dinner', 'breakfast'],
                answer: `🍽️ <strong>Mess Menu</strong>\n\nCheck weekly menu at <a href="/dashboard/student-hostel-menu.html" class="nav-suggestion">🍽️ Mess Menu</a>.\n\n<strong>Includes:</strong>\n• Breakfast, Lunch, Snacks, Dinner\n• Special weekend menu\n• Nutritional information\n\n<strong>Feedback:</strong> Share your suggestions to improve mess quality!`
            },
            // Forum
            'forum': {
                keywords: ['forum', 'discussion', 'ask question', 'doubt', 'query', 'help from students'],
                answer: `💬 <strong>Student Forum</strong>\n\nJoin discussions in <a href="/dashboard/student-forum.html" class="nav-suggestion">💬 Forum</a>.\n\n<strong>Features:</strong>\n• Ask academic questions\n• Get answers from peers & faculty\n• Join study discussions\n• Share resources\n• Upvote helpful answers\n\n<strong>Tip:</strong> Search before asking - your question might be answered!`
            },
            // Fee
            'fee': {
                keywords: ['fee', 'fees', 'payment', 'tuition', 'scholarship', 'fee payment', 'pay fee'],
                answer: `💰 <strong>Fee Information</strong>\n\n<strong>Fee Payment:</strong>\n• Login to parent portal for fee details\n• Payment via online banking/UPI/Card\n• Download fee receipts\n\n<strong>Scholarships:</strong>\n• Apply through admin office\n• Check eligibility criteria\n• Merit-based & need-based available\n\n<strong>Contact:</strong> Accounts section for queries.`
            },
            // Dashboard
            'dashboard': {
                keywords: ['dashboard', 'home', 'main page', 'overview', 'my dashboard'],
                answer: `🏠 <strong>Student Dashboard</strong>\n\nGo to <a href="/dashboard/student.html" class="nav-suggestion">🏠 Dashboard</a>.\n\n<strong>Quick Overview:</strong>\n• Attendance summary\n• Upcoming deadlines\n• Recent announcements\n• Quick links to all features\n• Performance metrics`
            }
        };
    }

    /**
     * Teacher-specific FAQ database
     */
    getTeacherFAQ() {
        return {
            'attendance': {
                keywords: ['attendance', 'mark attendance', 'take attendance', 'class attendance'],
                answer: `📊 <strong>Mark Attendance</strong>\n\nTake attendance in <a href="/dashboard/teacher-attendance.html" class="nav-suggestion">📊 Attendance Section</a>.\n\n<strong>Features:</strong>\n• Mark student attendance (Present/Absent/Late)\n• Bulk attendance marking\n• View attendance reports\n• Export attendance data\n• Send low attendance alerts\n\n<strong>Tip:</strong> Take attendance at the start of each class!`
            },
            'marks': {
                keywords: ['marks', 'upload marks', 'enter marks', 'grades', 'grading', 'student marks'],
                answer: `📈 <strong>Upload Marks</strong>\n\nEnter marks in <a href="/dashboard/teacher-marks.html" class="nav-suggestion">📈 Marks Section</a>.\n\n<strong>Features:</strong>\n• Subject-wise marks entry\n• Bulk upload via Excel\n• Grade calculation\n• Performance analytics\n• Generate mark sheets\n\n<strong>Deadline:</strong> Submit marks within 7 days of exam!`
            },
            'assignments': {
                keywords: ['assignment', 'homework', 'create assignment', 'manage assignments', 'submissions'],
                answer: `📝 <strong>Assignments Management</strong>\n\nManage in <a href="/dashboard/teacher-assignments.html" class="nav-suggestion">📝 Assignments</a>.\n\n<strong>Features:</strong>\n• Create new assignments\n• Set deadlines\n• Review submissions\n• Grade assignments\n• Provide feedback\n• Plagiarism check\n\n<strong>Tip:</strong> Set clear rubrics for fair grading!`
            },
            'notes': {
                keywords: ['notes', 'study material', 'upload notes', 'share materials', 'lecture notes'],
                answer: `📚 <strong>Study Materials</strong>\n\nUpload in <a href="/dashboard/teacher-notes.html" class="nav-suggestion">📚 Study Materials</a>.\n\n<strong>Features:</strong>\n• Upload lecture notes (PDF, DOC, PPT)\n• Organize by subject & topic\n• Share with specific batches\n• Track download stats\n• Version control\n\n<strong>Formats:</strong> PDF, DOC, PPT, ZIP (max 50MB)`
            },
            'question bank': {
                keywords: ['question bank', 'questions', 'create questions', 'exam questions', 'quiz'],
                answer: `🎯 <strong>Question Bank</strong>\n\nManage in <a href="/dashboard/teacher-question-bank.html" class="nav-suggestion">🎯 Question Bank</a>.\n\n<strong>Features:</strong>\n• Create MCQ/Descriptive questions\n• Organize by topic & difficulty\n• Generate question papers\n• Auto-shuffle options\n• Import/Export questions\n\n<strong>Tip:</strong> Tag questions with difficulty level for balanced papers!`
            },
            'rubric': {
                keywords: ['rubric', 'grading rubric', 'evaluation criteria', 'create rubric'],
                answer: `📋 <strong>Rubric Creator</strong>\n\nDesign rubrics in <a href="/dashboard/teacher-rubric-creator.html" class="nav-suggestion">📋 Rubric Creator</a>.\n\n<strong>Features:</strong>\n• Create custom rubrics\n• Define criteria & point values\n• Save rubric templates\n• Apply to assignments\n• Consistent grading\n\n<strong>Benefit:</strong> Ensures fair & transparent evaluation!`
            },
            'students': {
                keywords: ['students', 'my students', 'class students', 'student list', 'view students'],
                answer: `👥 <strong>My Students</strong>\n\nView in <a href="/dashboard/teacher-students.html" class="nav-suggestion">👥 My Students</a>.\n\n<strong>Features:</strong>\n• Student list by class/section\n• Individual student profiles\n• Attendance & marks summary\n• Performance tracking\n• Contact information\n\n<strong>Tip:</strong> Identify struggling students early for intervention!`
            },
            'dashboard': {
                keywords: ['dashboard', 'home', 'overview', 'teacher dashboard'],
                answer: `🏠 <strong>Teacher Dashboard</strong>\n\nGo to <a href="/dashboard/teacher.html" class="nav-suggestion">🏠 Dashboard</a>.\n\n<strong>Quick Overview:</strong>\n• Today's classes\n• Pending submissions to grade\n• Class attendance stats\n• Recent announcements\n• Quick links to all features`
            }
        };
    }

    /**
     * Admin-specific FAQ database
     */
    getAdminFAQ() {
        return {
            'users': {
                keywords: ['users', 'user management', 'add user', 'delete user', 'manage users', 'students', 'teachers'],
                answer: `👥 <strong>User Management</strong>\n\nManage in <a href="/dashboard/admin-users.html" class="nav-suggestion">👥 User Management</a>.\n\n<strong>Features:</strong>\n• Add/Edit/Delete users\n• Bulk user import (Excel)\n• Role assignment (Student/Teacher/Admin)\n• Reset passwords\n• View user activity logs\n• Export user data\n\n<strong>Roles:</strong> Student, Teacher, Admin, HOD`
            },
            'approvals': {
                keywords: ['approvals', 'pending', 'approve', 'reject', 'review', 'pending approvals'],
                answer: `✅ <strong>Approvals</strong>\n\nReview in <a href="/dashboard/admin-approvals.html" class="nav-suggestion">✅ Approvals</a>.\n\n<strong>Pending Items:</strong>\n• New registrations\n• Leave applications\n• Notes/Material uploads\n• Event requests\n• Fee concessions\n\n<strong>Tip:</strong> Review approvals daily to avoid backlog!`
            },
            'analytics': {
                keywords: ['analytics', 'reports', 'statistics', 'data', 'insights', 'metrics'],
                answer: `📊 <strong>System Analytics</strong>\n\nView in <a href="/dashboard/admin-analytics.html" class="nav-suggestion">📊 Analytics</a>.\n\n<strong>Reports:</strong>\n• User statistics & growth\n• Attendance trends\n• Academic performance\n• System usage metrics\n• Department-wise data\n• Custom date ranges\n\n<strong>Export:</strong> PDF, Excel, CSV`
            },
            'announcements': {
                keywords: ['announcement', 'notice', 'broadcast', 'create announcement', 'notify'],
                answer: `📢 <strong>Announcements</strong>\n\nManage in <a href="/dashboard/admin-announcements.html" class="nav-suggestion">📢 Announcements</a>.\n\n<strong>Features:</strong>\n• Create announcements\n• Target specific groups\n• Schedule announcements\n• Priority levels (Normal/Important/Urgent)\n• Email notifications\n• Track read status\n\n<strong>Tip:</strong> Use priority wisely - urgent notifications alert users!`
            },
            'departments': {
                keywords: ['department', 'departments', 'add department', 'manage department', 'courses'],
                answer: `🎓 <strong>Departments</strong>\n\nManage in <a href="/dashboard/admin-departments.html" class="nav-suggestion">🎓 Departments</a>.\n\n<strong>Features:</strong>\n• Add/Edit departments\n• Assign HODs\n• Manage courses & programs\n• Set department settings\n• View department statistics`
            },
            'settings': {
                keywords: ['settings', 'configuration', 'system settings', 'preferences', 'setup'],
                answer: `⚙️ <strong>System Settings</strong>\n\nConfigure in <a href="/dashboard/admin-settings.html" class="nav-suggestion">⚙️ Settings</a>.\n\n<strong>Options:</strong>\n• Academic year setup\n• Grading system config\n• Attendance rules\n• Email templates\n• System preferences\n• Backup & restore`
            },
            'dashboard': {
                keywords: ['dashboard', 'home', 'overview', 'admin dashboard'],
                answer: `🏠 <strong>Admin Dashboard</strong>\n\nGo to <a href="/dashboard/admin.html" class="nav-suggestion">🏠 Dashboard</a>.\n\n<strong>Overview:</strong>\n• Total users & growth\n• Pending approvals count\n• System health status\n• Recent activities\n• Quick action buttons`
            }
        };
    }

    /**
     * Guest/Public page FAQ database
     */
    getGuestFAQ() {
        return {
            'about': {
                keywords: ['about', 'iter', 'soa', 'university', 'college', 'institute', 'what is'],
                answer: `🎓 <strong>About ITER, SOA University</strong>\n\nITER (Institute of Technical Education & Research) is a premier constituent college of SOA University, Bhubaneswar.\n\n<strong>Highlights:</strong>\n• 🏆 NAAC A++ Accredited\n• 📚 NBA Approved Programs\n• 💼 95%+ Placement Rate\n• 🌍 Global Collaborations\n\n<a href="/#about" class="nav-suggestion">📖 Learn More</a> | <a href="/creator.html" class="nav-suggestion">👨‍💻 About Creator</a>`
            },
            'features': {
                keywords: ['features', 'what can', 'capabilities', 'services', 'offerings', 'eduhub'],
                answer: `✨ <strong>ITER EduHub Features</strong>\n\n<strong>For Students:</strong>\n• 📊 Real-time Attendance Tracking\n• 📈 Marks & Performance Analytics\n• 📚 Digital Notes & PYQs\n• 📅 Interactive Timetable\n• 🎫 Admit Card Download\n• 💬 Student Forum\n• 🎉 Events & Clubs\n\n<strong>For Teachers:</strong>\n• 📝 Assignment Management\n• 🎯 Question Bank\n• 📊 Grade Management\n\n<strong>For Admins:</strong>\n• 👥 User Management\n• 📊 Advanced Analytics\n• 📢 Announcements\n\n<a href="/#features" class="nav-suggestion">🔍 Explore All Features</a>`
            },
            'register': {
                keywords: ['register', 'sign up', 'create account', 'new account', 'join', 'registration'],
                answer: `📝 <strong>Registration Guide</strong>\n\n<strong>Steps to Register:</strong>\n1. Go to <a href="/register.html" class="nav-suggestion">📝 Registration Page</a>\n2. Fill your details (Name, Email, Registration No.)\n3. Choose your role (Student/Teacher)\n4. Create a strong password\n5. Verify your email\n6. Wait for admin approval\n\n<strong>Need help?</strong> Contact: support@iter.ac.in`
            },
            'login': {
                keywords: ['login', 'sign in', 'access', 'portal', 'cant login', 'login problem'],
                answer: `🔐 <strong>Login Guide</strong>\n\n<strong>To Login:</strong>\n1. Go to <a href="/login.html" class="nav-suggestion">🔐 Login Page</a>\n2. Enter your Registration Number\n3. Enter your Password\n4. Click Login\n\n<strong>Forgot Password?</strong>\n• Click "Forgot Password" on login page\n• Enter your registered email\n• Check inbox for reset link\n\n<strong>Issues?</strong> Contact IT Helpdesk: +91-674-2350171`
            },
            'placement': {
                keywords: ['placement', 'job', 'career', 'recruitment', 'companies', 'package'],
                answer: `💼 <strong>Placements at ITER</strong>\n\n<strong>Statistics:</strong>\n• 95%+ Placement Rate\n• Highest Package: 30+ LPA\n• Average Package: 8+ LPA\n• 200+ Recruiting Companies\n\n<strong>Top Recruiters:</strong>\nGoogle, Microsoft, Amazon, Adobe, TCS, Infosys, Wipro, and many more!\n\n<a href="/#placements" class="nav-suggestion">📊 View Details</a>`
            },
            'contact': {
                keywords: ['contact', 'phone', 'email', 'address', 'reach', 'help', 'support'],
                answer: `📞 <strong>Contact Information</strong>\n\n<strong>ITER, SOA University</strong>\n\n📍 <strong>Address:</strong>\nJagamohan Nagar, Khandagiri\nBhubaneswar, Odisha 751030\n\n📧 <strong>Email:</strong>\ninfo@iter.ac.in\nadmissions@iter.ac.in\n\n📞 <strong>Phone:</strong>\n+91-674-2350171\n+91-674-2351006\n\n<a href="/#contact" class="nav-suggestion">📍 View Location</a>`
            },
            'academics': {
                keywords: ['academics', 'courses', 'programs', 'branches', 'departments', 'btech', 'mtech'],
                answer: `📚 <strong>Academic Programs</strong>\n\n<strong>Undergraduate (B.Tech):</strong>\n• Computer Science & Engineering\n• Electronics & Communication\n• Mechanical Engineering\n• Civil Engineering\n• Electrical Engineering\n• Information Technology\n• And more...\n\n<strong>Postgraduate:</strong>\n• M.Tech (Various Specializations)\n• MBA\n• Ph.D.\n\n<a href="/#academics" class="nav-suggestion">📖 View All Programs</a>`
            }
        };
    }

    /**
     * Common FAQ for all users
     */
    getCommonFAQ() {
        return {
            'help': {
                keywords: ['help', 'support', 'issue', 'problem', 'not working'],
                answer: `🆘 <strong>Need Help?</strong>\n\n<strong>Contact Options:</strong>\n• 📧 Email: support@iter.ac.in\n• 📞 Helpdesk: +91-674-2350171\n• 🏢 Admin Office (Block A)\n• 💬 Use this chatbot!\n\n<strong>Common Issues:</strong>\n• Login problems → Try password reset\n• Page not loading → Clear cache & refresh\n• Data not showing → Check internet connection`
            },
            'password': {
                keywords: ['password', 'forgot password', 'reset', 'login issue', 'change password'],
                answer: `🔑 <strong>Password Help</strong>\n\n<strong>Forgot Password?</strong>\n1. Click "Forgot Password" on login page\n2. Enter registered email\n3. Check inbox for reset link\n4. Create new password\n\n<strong>Change Password:</strong>\n• Login → Profile → Change Password\n\n<strong>Still having issues?</strong>\nContact IT Helpdesk: +91-674-2350171`
            }
        };
    }

    init() {
        this.createChatbotUI();
        this.attachEventListeners();
        this.addWelcomeMessage();
    }

    createChatbotUI() {
        // Create toggle button
        this.toggleBtn = document.createElement('button');
        this.toggleBtn.className = 'chatbot-toggle';
        this.toggleBtn.innerHTML = '<span class="chatbot-toggle-icon">🤖</span>';
        this.toggleBtn.title = 'Chat with ITER Assistant';
        document.body.appendChild(this.toggleBtn);

        // Role-specific placeholder text
        const placeholders = {
            student: 'Ask about attendance, marks, notes...',
            teacher: 'Ask about attendance, marks, assignments...',
            admin: 'Ask about users, approvals, analytics...',
            guest: 'Ask about ITER, features, registration...'
        };

        // Create chatbot container
        this.container = document.createElement('div');
        this.container.className = 'chatbot-container';
        this.container.innerHTML = `
            <div class="chatbot-header">
                <div class="chatbot-header-info">
                    <div class="chatbot-avatar">🤖</div>
                    <div>
                        <h4 class="chatbot-title">ITER Assistant</h4>
                        <div class="chatbot-status">
                            <span class="chatbot-status-dot"></span>
                            <span>Online - ${this.getRoleLabel()} Mode</span>
                        </div>
                    </div>
                </div>
                <button class="chatbot-close" title="Close chat">✕</button>
            </div>
            <div class="chatbot-messages" id="chatbotMessages"></div>
            <div class="chatbot-quick-actions" id="chatbotQuickActions"></div>
            <div class="chatbot-input-area">
                <input type="text" class="chatbot-input" id="chatbotInput" 
                    placeholder="${placeholders[this.userRole] || placeholders.guest}" 
                    autocomplete="off">
                <button class="chatbot-send" id="chatbotSend" title="Send message">➤</button>
            </div>
        `;
        document.body.appendChild(this.container);

        // Store references
        this.messagesContainer = document.getElementById('chatbotMessages');
        this.input = document.getElementById('chatbotInput');
        this.quickActionsContainer = document.getElementById('chatbotQuickActions');

        // Populate quick actions
        this.renderQuickActions();
    }

    getRoleLabel() {
        const labels = {
            student: '🎓 Student',
            teacher: '👨‍🏫 Teacher',
            admin: '👨‍💼 Admin',
            guest: '👋 Guest'
        };
        return labels[this.userRole] || labels.guest;
    }

    renderQuickActions() {
        this.quickActionsContainer.innerHTML = this.quickActions.map(action => 
            `<button class="quick-action-btn" data-query="${action.query}">${action.text}</button>`
        ).join('');
    }

    attachEventListeners() {
        this.toggleBtn.addEventListener('click', () => this.toggle());
        this.container.querySelector('.chatbot-close').addEventListener('click', () => this.close());
        document.getElementById('chatbotSend').addEventListener('click', () => this.sendMessage());

        this.input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        this.quickActionsContainer.addEventListener('click', (e) => {
            if (e.target.classList.contains('quick-action-btn')) {
                const query = e.target.dataset.query;
                this.input.value = query;
                this.sendMessage();
            }
        });

        document.addEventListener('click', (e) => {
            if (this.isOpen && 
                !this.container.contains(e.target) && 
                !this.toggleBtn.contains(e.target)) {
                this.close();
            }
        });
    }

    toggle() {
        this.isOpen = !this.isOpen;
        this.container.classList.toggle('active', this.isOpen);
        this.toggleBtn.classList.toggle('active', this.isOpen);
        if (this.isOpen) this.input.focus();
    }

    open() {
        this.isOpen = true;
        this.container.classList.add('active');
        this.toggleBtn.classList.add('active');
        this.input.focus();
    }

    close() {
        this.isOpen = false;
        this.container.classList.remove('active');
        this.toggleBtn.classList.remove('active');
    }

    addWelcomeMessage() {
        const welcomeMessages = {
            student: `Hello! 👋 I'm your ITER Assistant.\n\n<strong>As a Student, I can help you with:</strong>\n• 📊 Check attendance & marks\n• 📚 Find study materials & PYQs\n• 💡 Help solve questions\n• 📅 View timetable & schedules\n• 🎉 Explore events & clubs\n• 🏨 Hostel & mess info\n\nJust type your question or click a quick action below!`,
            
            teacher: `Hello! 👋 I'm your ITER Assistant.\n\n<strong>As a Teacher, I can help you with:</strong>\n• 📊 Mark student attendance\n• 📈 Upload & manage marks\n• 📝 Create assignments\n• 📚 Upload study materials\n• 🎯 Manage question bank\n• 👥 View student details\n\nHow can I assist you today?`,
            
            admin: `Hello! 👋 I'm your ITER Assistant.\n\n<strong>As an Admin, I can help you with:</strong>\n• 👥 Manage users & roles\n• ✅ Review pending approvals\n• 📊 View system analytics\n• 📢 Create announcements\n• 🎓 Manage departments\n• ⚙️ System configuration\n\nWhat would you like to do?`,
            
            guest: `Welcome to ITER EduHub! 👋\n\n<strong>I can help you learn about:</strong>\n• 🎓 About ITER & SOA University\n• ✨ EduHub features & capabilities\n• 📝 How to register & login\n• 💼 Placements & career\n• 📚 Academic programs\n• 📞 Contact information\n\nAsk me anything about ITER EduHub!`
        };

        this.addMessage(welcomeMessages[this.userRole] || welcomeMessages.guest, 'bot');
    }

    addMessage(text, sender) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `chat-message ${sender}`;
        messageDiv.innerHTML = text;
        this.messagesContainer.appendChild(messageDiv);
        this.scrollToBottom();
    }

    showTypingIndicator() {
        const indicator = document.createElement('div');
        indicator.className = 'typing-indicator';
        indicator.id = 'typingIndicator';
        indicator.innerHTML = '<span></span><span></span><span></span>';
        this.messagesContainer.appendChild(indicator);
        this.scrollToBottom();
    }

    hideTypingIndicator() {
        const indicator = document.getElementById('typingIndicator');
        if (indicator) indicator.remove();
    }

    scrollToBottom() {
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    }

    async sendMessage() {
        const message = this.input.value.trim();
        if (!message || this.isLoading) return;

        this.addMessage(message, 'user');
        this.input.value = '';
        this.isLoading = true;

        this.showTypingIndicator();

        setTimeout(async () => {
            const response = await this.getResponse(message);
            this.hideTypingIndicator();
            this.addMessage(response, 'bot');
            this.isLoading = false;
        }, 500 + Math.random() * 500);
    }

    async getResponse(message) {
        const lowerMessage = message.toLowerCase();

        // Check role-specific FAQ first
        const roleFAQ = this.faqDatabases[this.userRole] || this.faqDatabases.guest;
        for (const [key, faq] of Object.entries(roleFAQ)) {
            if (faq.keywords.some(keyword => lowerMessage.includes(keyword))) {
                return faq.answer;
            }
        }

        // Check common FAQ
        const commonFAQ = this.getCommonFAQ();
        for (const [key, faq] of Object.entries(commonFAQ)) {
            if (faq.keywords.some(keyword => lowerMessage.includes(keyword))) {
                return faq.answer;
            }
        }

        // Greeting responses
        if (this.isGreeting(lowerMessage)) {
            return this.getGreetingResponse();
        }

        // Check for question-solving intent (student only)
        if (this.userRole === 'student' && this.isQuestionSolvingIntent(lowerMessage)) {
            return this.getQuestionSolvingResponse(message);
        }

        // Try API call if available
        try {
            const token = localStorage.getItem('token');
            if (token) {
                const response = await fetch('/api/ai/chat', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ question: message, role: this.userRole })
                });

                if (response.ok) {
                    const data = await response.json();
                    if (data.success && data.answer) {
                        return data.answer;
                    }
                }
            }
        } catch (error) {
            console.log('AI API not available, using smart fallback');
        }

        // Smart fallback based on role
        return this.getSmartFallback(message);
    }

    isGreeting(message) {
        const greetings = ['hi', 'hello', 'hey', 'good morning', 'good afternoon', 'good evening', 'howdy', 'hola', 'namaste'];
        return greetings.some(g => message.includes(g) || message === g);
    }

    getGreetingResponse() {
        const responses = {
            student: [
                "Hello! 👋 How can I help you today? Ask about attendance, marks, notes, or let me help solve a question!",
                "Hi there! 😊 Ready to assist with your studies. What do you need help with?",
                "Hey! 🎓 What would you like to know about?"
            ],
            teacher: [
                "Hello! 👋 How can I assist you today? Ask about attendance, marks, assignments, or student management!",
                "Hi there! 👨‍🏫 Ready to help with your teaching tasks. What do you need?",
                "Hey! What would you like to do today?"
            ],
            admin: [
                "Hello! 👋 How can I help with system administration? Ask about users, approvals, or analytics!",
                "Hi there! 👨‍💼 Ready to assist with admin tasks. What do you need?",
                "Hey! What system task can I help with?"
            ],
            guest: [
                "Hello! 👋 Welcome to ITER EduHub. I can tell you about ITER, our features, or help you register!",
                "Hi there! 😊 Looking to learn about ITER or need help with registration?",
                "Hey! How can I help you explore ITER EduHub today?"
            ]
        };

        const roleResponses = responses[this.userRole] || responses.guest;
        return roleResponses[Math.floor(Math.random() * roleResponses.length)];
    }

    isQuestionSolvingIntent(message) {
        const patterns = ['solve', 'help me with', 'calculate', 'what is', 'how to', 'explain', 'find', 'derive', 'prove'];
        return patterns.some(p => message.includes(p));
    }

    getQuestionSolvingResponse(question) {
        return `💡 <strong>I'd love to help you!</strong>\n\nI see you're asking: "${question}"\n\n<strong>To help you better:</strong>\n1. 📝 Could you specify the subject? (Math, Physics, Chemistry, Programming, etc.)\n2. 🎯 Share the complete question or problem\n3. ✏️ Tell me where you're stuck\n\n<strong>Meanwhile, check these resources:</strong>\n• <a href="/dashboard/student-notes.html" class="nav-suggestion">📚 Study Notes</a> - Find related materials\n• <a href="/dashboard/student-forum.html" class="nav-suggestion">💬 Forum</a> - Ask peers for help\n• <a href="/dashboard/student-notes.html?type=pyqs" class="nav-suggestion">📝 PYQs</a> - Similar solved problems\n\nShare more details and I'll guide you through! 🚀`;
    }

    getSmartFallback(message) {
        const fallbacks = {
            student: `I understand you're asking about "${message}". 🤔\n\n<strong>Here's what might help:</strong>\n\n<div class="faq-category">\n    <div class="faq-item" onclick="document.querySelector('.chatbot-input').value='attendance'; document.getElementById('chatbotSend').click();">📊 Attendance & Marks</div>\n    <div class="faq-item" onclick="document.querySelector('.chatbot-input').value='study notes'; document.getElementById('chatbotSend').click();">📚 Study Materials</div>\n    <div class="faq-item" onclick="document.querySelector('.chatbot-input').value='help solve'; document.getElementById('chatbotSend').click();">💡 Solve Questions</div>\n    <div class="faq-item" onclick="document.querySelector('.chatbot-input').value='forum'; document.getElementById('chatbotSend').click();">💬 Ask in Forum</div>\n</div>\n\nOr visit <a href="/dashboard/student-forum.html" class="nav-suggestion">💬 Forum</a> to ask your question!`,
            
            teacher: `I understand you're asking about "${message}". 🤔\n\n<strong>Here's what might help:</strong>\n\n<div class="faq-category">\n    <div class="faq-item" onclick="document.querySelector('.chatbot-input').value='mark attendance'; document.getElementById('chatbotSend').click();">📊 Mark Attendance</div>\n    <div class="faq-item" onclick="document.querySelector('.chatbot-input').value='upload marks'; document.getElementById('chatbotSend').click();">📈 Upload Marks</div>\n    <div class="faq-item" onclick="document.querySelector('.chatbot-input').value='assignments'; document.getElementById('chatbotSend').click();">📝 Manage Assignments</div>\n    <div class="faq-item" onclick="document.querySelector('.chatbot-input').value='my students'; document.getElementById('chatbotSend').click();">👥 View Students</div>\n</div>\n\nNeed more help? Contact admin office!`,
            
            admin: `I understand you're asking about "${message}". 🤔\n\n<strong>Here's what might help:</strong>\n\n<div class="faq-category">\n    <div class="faq-item" onclick="document.querySelector('.chatbot-input').value='manage users'; document.getElementById('chatbotSend').click();">👥 User Management</div>\n    <div class="faq-item" onclick="document.querySelector('.chatbot-input').value='pending approvals'; document.getElementById('chatbotSend').click();">✅ Approvals</div>\n    <div class="faq-item" onclick="document.querySelector('.chatbot-input').value='analytics'; document.getElementById('chatbotSend').click();">📊 View Analytics</div>\n    <div class="faq-item" onclick="document.querySelector('.chatbot-input').value='settings'; document.getElementById('chatbotSend').click();">⚙️ System Settings</div>\n</div>\n\nFor technical issues, contact IT department!`,
            
            guest: `Thanks for asking about "${message}"! 🤔\n\n<strong>Here's what I can help with:</strong>\n\n<div class="faq-category">\n    <div class="faq-item" onclick="document.querySelector('.chatbot-input').value='about iter'; document.getElementById('chatbotSend').click();">🎓 About ITER</div>\n    <div class="faq-item" onclick="document.querySelector('.chatbot-input').value='features'; document.getElementById('chatbotSend').click();">✨ EduHub Features</div>\n    <div class="faq-item" onclick="document.querySelector('.chatbot-input').value='register'; document.getElementById('chatbotSend').click();">📝 How to Register</div>\n    <div class="faq-item" onclick="document.querySelector('.chatbot-input').value='contact'; document.getElementById('chatbotSend').click();">📞 Contact Us</div>\n</div>\n\n<a href="/login.html" class="nav-suggestion">🔐 Login</a> or <a href="/register.html" class="nav-suggestion">📝 Register</a> to access more features!`
        };

        return fallbacks[this.userRole] || fallbacks.guest;
    }
}

// Initialize chatbot when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.chatbot = new Chatbot();
});

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Chatbot;
}
