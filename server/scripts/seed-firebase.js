/**
 * Firebase Seeder
 * ---------------------------------
 * This script populates Firestore with comprehensive demo data.
 * It is designed to be idempotent where possible.
 */
require('dotenv').config();
const { db, auth } = require('../database/firebase');
const bcrypt = require('bcrypt');

// Enhanced sample data (copied from comprehensive-seed.js)
const departments = ['CSE', 'IT', 'ECE', 'EEE', 'MECH', 'CIVIL'];
const sections = ['A', 'B', 'C', 'D'];

const subjects = {
    CSE: ['Data Structures', 'Algorithms', 'Database Management', 'Operating Systems', 'Computer Networks', 'Software Engineering', 'Web Development', 'Machine Learning'],
    IT: ['Web Development', 'Mobile Computing', 'Cloud Computing', 'Cyber Security', 'AI & ML', 'IoT', 'Big Data Analytics', 'DevOps'],
    ECE: ['Digital Electronics', 'Signals & Systems', 'VLSI Design', 'Embedded Systems', 'Communication Systems', 'Microprocessors', 'Control Systems', 'RF Engineering'],
    EEE: ['Power Systems', 'Control Systems', 'Electrical Machines', 'Power Electronics', 'Renewable Energy', 'Electric Drives', 'High Voltage Engineering', 'Smart Grid'],
    MECH: ['Thermodynamics', 'Fluid Mechanics', 'Manufacturing Processes', 'CAD/CAM', 'Machine Design', 'Heat Transfer', 'Robotics', 'Automotive Engineering'],
    CIVIL: ['Structural Analysis', 'Concrete Technology', 'Surveying', 'Geotechnical Engineering', 'Transportation Engineering', 'Hydraulics', 'Environmental Engineering', 'Construction Management']
};

const indianFirstNames = [
    'Aarav', 'Vivaan', 'Aditya', 'Arjun', 'Sai', 'Vihaan', 'Aryan', 'Reyansh', 'Ayush', 'Krishna',
    'Diya', 'Ananya', 'Isha', 'Priya', 'Sneha', 'Aanya', 'Avni', 'Sara', 'Kavya', 'Riya',
    'Rohan', 'Karan', 'Akash', 'Rahul', 'Amit', 'Nikhil', 'Harsh', 'Varun', 'Yash', 'Dhruv',
    'Neha', 'Pooja', 'Shreya', 'Tanvi', 'Megha', 'Divya', 'Sakshi', 'Anjali', 'Preeti', 'Swati',
    'Rajesh', 'Suresh', 'Vikram', 'Anil', 'Ramesh', 'Manoj', 'Sanjay', 'Ajay', 'Vijay', 'Prakash'
];

const indianLastNames = [
    'Sharma', 'Verma', 'Patel', 'Kumar', 'Singh', 'Reddy', 'Gupta', 'Joshi', 'Mehta', 'Nair',
    'Rao', 'Desai', 'Kulkarni', 'Mishra', 'Pandey', 'Iyer', 'Malhotra', 'Banerjee', 'Chatterjee', 'Das',
    'Agarwal', 'Shah', 'Chopra', 'Kapoor', 'Sinha', 'Bose', 'Ghosh', 'Pillai', 'Menon', 'Varma'
];

// Utility functions
const getRandomElement = (arr) => arr[Math.floor(Math.random() * arr.length)];
const getRandomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const shuffleArray = (array) => {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
};

async function seedFirebase() {
    try {
        console.log('🚀 Starting Firebase Seeding...\n');

        // =============================================================================
        // SEED ADMIN ACCOUNTS
        // =============================================================================
        console.log('👤 Creating admin accounts...');
        const adminPassword = await bcrypt.hash('Admin@123456', 12);
        const adminData = [
            { name: 'Admin One', reg: 'ADM2025001', email: 'admin1@iter.edu', phone: '9876543210' },
            { name: 'Admin Two', reg: 'ADM2025002', email: 'admin2@iter.edu', phone: '9876543211' },
            { name: 'Admin Three', reg: 'ADM2025003', email: 'admin3@iter.edu', phone: '9876543212' }
        ];

        for (const admin of adminData) {
            const userRef = db.collection('users').doc(admin.reg);
            await userRef.set({
                name: admin.name,
                registration_number: admin.reg,
                email: admin.email,
                password: adminPassword, // Storing hashed password for legacy login support
                phone_number: admin.phone,
                department: 'Administration',
                role: 'admin',
                is_active: true,
                created_at: new Date(),
                last_login: null
            });
        }
        console.log('✓ Created 3 admin accounts\n');

        // =============================================================================
        // SEED TEACHERS
        // =============================================================================
        console.log('👨‍🏫 Creating teacher accounts...');
        const teacherPassword = await bcrypt.hash('Teacher@123', 12);
        const teacherIds = [];

        for (let i = 0; i < 50; i++) {
            const dept = getRandomElement(departments);
            const titles = ['Dr.', 'Prof.', 'Mr.', 'Ms.', 'Mrs.'];
            const firstName = getRandomElement(indianFirstNames);
            const lastName = getRandomElement(indianLastNames);
            const name = `${getRandomElement(titles)} ${firstName} ${lastName}`;
            const regNumber = `TCH2025${String(i + 1).padStart(3, '0')}`;
            const email = `teacher${i + 1}@iter.edu`;
            const phone = `98765${String(43220 + i).padStart(5, '0')}`;

            const deptSubjects = subjects[dept];
            const numSubjects = getRandomInt(2, 4);
            const teacherSubjects = shuffleArray(deptSubjects).slice(0, numSubjects);
            const subjectsTaught = teacherSubjects.join(', ');

            const userRef = db.collection('users').doc(regNumber);
            await userRef.set({
                name,
                registration_number: regNumber,
                email,
                password: teacherPassword,
                phone_number: phone,
                department: dept,
                subjects_taught: subjectsTaught,
                role: 'teacher',
                is_active: true,
                created_at: new Date(),
                last_login: new Date()
            });

            teacherIds.push({
                id: regNumber, // Using regNumber as ID in Firestore
                dept,
                subjects: teacherSubjects,
                name
            });
        }
        console.log('✓ Created 50 teacher accounts\n');

        // =============================================================================
        // SEED STUDENTS
        // =============================================================================
        console.log('👨‍🎓 Creating student accounts...');
        const studentPassword = await bcrypt.hash('Student@123', 12);
        const studentIds = [];

        for (let i = 0; i < 500; i++) {
            const dept = getRandomElement(departments);
            const year = getRandomInt(1, 4);
            const section = getRandomElement(sections);
            const firstName = getRandomElement(indianFirstNames);
            const lastName = getRandomElement(indianLastNames);
            const name = `${firstName} ${lastName}`;
            const regNumber = `STU2025${String(i + 1).padStart(4, '0')}`;
            const email = `student${i + 1}@iter.edu`;
            const phone = `98000${String(10000 + i).padStart(5, '0')}`;

            const userRef = db.collection('users').doc(regNumber);
            await userRef.set({
                name,
                registration_number: regNumber,
                email,
                password: studentPassword,
                phone_number: phone,
                department: dept,
                year,
                section,
                role: 'student',
                is_active: true,
                created_at: new Date(),
                last_login: new Date()
            });

            studentIds.push({
                id: regNumber,
                dept,
                year,
                section,
                name,
                regNumber
            });
        }
        console.log('✓ Created 500 student accounts\n');

        // =============================================================================
        // SEED ATTENDANCE
        // =============================================================================
        console.log('📊 Creating attendance records...');
        const today = new Date();
        let attendanceCount = 0;
        const batch = db.batch();
        let batchCount = 0;

        for (const student of studentIds.slice(0, 50)) { // Limit to 50 students for speed
            const studentSubjects = subjects[student.dept];
            const attendancePercent = getRandomInt(70, 98);

            for (const subject of studentSubjects) {
                for (let day = 0; day < 30; day++) { // Limit to 30 days
                    const date = new Date(today);
                    date.setDate(date.getDate() - day);
                    if (date.getDay() === 0) continue;

                    const dateStr = date.toISOString().split('T')[0];
                    const randomChance = Math.random() * 100;
                    let status;
                    if (randomChance < attendancePercent - 5) status = 'present';
                    else if (randomChance < attendancePercent + 5) status = 'late';
                    else status = 'absent';

                    const teacher = teacherIds.find(t => t.dept === student.dept && t.subjects.includes(subject));

                    if (teacher) {
                        const attRef = db.collection('attendance').doc();
                        batch.set(attRef, {
                            student_id: student.id,
                            subject,
                            date: dateStr,
                            status,
                            marked_by: teacher.id,
                            remarks: status === 'late' ? 'Arrived 10 minutes late' : null,
                            created_at: new Date()
                        });
                        attendanceCount++;
                        batchCount++;

                        if (batchCount >= 400) {
                            await batch.commit();
                            batchCount = 0;
                        }
                    }
                }
            }
        }
        if (batchCount > 0) await batch.commit();
        console.log(`✓ Created ~${attendanceCount} attendance records (sample)\n`);

        console.log('✅ Firebase Seeding Complete!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Seeding failed:', error);
        process.exit(1);
    }
}

seedFirebase();
