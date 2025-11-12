const db = require('../database/db');
const crypto = require('crypto');

/**
 * Auto Data Generator
 * Automatically generates realistic dummy data for newly registered users
 */

class AutoDataGenerator {
  constructor() {
    this.departments = ['CSE', 'IT', 'ECE', 'EEE', 'MECH', 'CIVIL'];
    this.subjects = {
      CSE: ['Data Structures', 'Algorithms', 'Database Management', 'Operating Systems', 'Computer Networks', 'Software Engineering'],
      IT: ['Web Development', 'Mobile Computing', 'Cloud Computing', 'Cyber Security', 'AI & ML', 'IoT'],
      ECE: ['Digital Electronics', 'Signals & Systems', 'VLSI Design', 'Embedded Systems', 'Communication Systems', 'Microprocessors'],
      EEE: ['Power Systems', 'Control Systems', 'Electrical Machines', 'Power Electronics', 'Renewable Energy', 'Electric Drives'],
      MECH: ['Thermodynamics', 'Fluid Mechanics', 'Manufacturing Processes', 'CAD/CAM', 'Machine Design', 'Heat Transfer'],
      CIVIL: ['Structural Analysis', 'Concrete Technology', 'Surveying', 'Geotechnical Engineering', 'Transportation Engineering', 'Hydraulics']
    };
  }

  getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  getRandomElement(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  /**
   * Generate data for a newly registered student
   */
  async generateStudentData(userId, userData) {
    try {
      console.log(`Generating data for student ID: ${userId}`);

      const { department, year, section } = userData;
      const subjects = this.subjects[department] || this.subjects.CSE;

      // Find a teacher from same department
      const [teachers] = await db.query(
        'SELECT id FROM users WHERE department = ? AND role = ? LIMIT 1',
        [department, 'teacher']
      );
      const teacherId = teachers.length > 0 ? teachers[0].id : 1;

      // 1. Generate Attendance Records (last 60 days)
      await this.generateAttendance(userId, subjects, teacherId);

      // 2. Generate Marks
      await this.generateMarks(userId, subjects, teacherId);

      // 3. Generate Fee Records
      await this.generateFees(userId, year);

      // 4. Generate an Admit Card
      await this.generateAdmitCard(userId, userData);

      // 5. Add some achievements
      await this.generateAchievements(userId);

      console.log(`✓ Successfully generated data for student ${userId}`);
      return { success: true };
    } catch (error) {
      console.error('Error generating student data:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Generate attendance for a student
   */
  async generateAttendance(studentId, subjects, teacherId) {
    const today = new Date();
    const baseAttendance = this.getRandomInt(70, 95);

    for (const subject of subjects) {
      for (let day = 0; day < 60; day++) {
        const date = new Date(today);
        date.setDate(date.getDate() - day);
        
        // Skip Sundays
        if (date.getDay() === 0) continue;

        const randomChance = Math.random() * 100;
        let status;
        if (randomChance < baseAttendance - 5) {
          status = 'present';
        } else if (randomChance < baseAttendance + 5) {
          status = 'late';
        } else {
          status = 'absent';
        }

        await db.query(
          'INSERT IGNORE INTO attendance (student_id, subject, date, status, marked_by) VALUES (?, ?, ?, ?, ?)',
          [studentId, subject, date.toISOString().split('T')[0], status, teacherId]
        );
      }
    }
  }

  /**
   * Generate marks for a student
   */
  async generateMarks(studentId, subjects, teacherId) {
    const today = new Date();
    const basePerformance = this.getRandomInt(65, 90);

    const examTypes = [
      { type: 'internal', total: 30, count: 3 },
      { type: 'assignment', total: 20, count: 4 },
      { type: 'quiz', total: 10, count: 5 },
      { type: 'external', total: 100, count: 1 }
    ];

    for (const subject of subjects) {
      for (const examConfig of examTypes) {
        for (let i = 0; i < examConfig.count; i++) {
          const variation = this.getRandomInt(-10, 10);
          const performancePercent = Math.max(50, Math.min(100, basePerformance + variation));
          const marksObtained = Math.round((examConfig.total * performancePercent) / 100);

          const examDate = new Date(today);
          examDate.setDate(examDate.getDate() - this.getRandomInt(10, 180));

          await db.query(
            'INSERT INTO marks (student_id, subject, exam_type, marks_obtained, total_marks, exam_date, uploaded_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [studentId, subject, examConfig.type, marksObtained, examConfig.total, examDate.toISOString().split('T')[0], teacherId]
          );
        }
      }
    }
  }

  /**
   * Generate fee records for a student
   */
  async generateFees(studentId, year) {
    const today = new Date();
    const amount = 75000;

    for (let sem = 1; sem <= year * 2; sem++) {
      const isPaid = Math.random() > 0.1;
      const paidAmount = isPaid ? amount : 0;

      const dueDate = new Date(today);
      dueDate.setMonth(dueDate.getMonth() - (year * 2 - sem) * 6);
      dueDate.setDate(15);

      let status;
      if (paidAmount === amount) status = 'paid';
      else if (new Date() > dueDate) status = 'overdue';
      else status = 'pending';

      await db.query(
        'INSERT INTO fees (student_id, semester, amount, paid_amount, due_date, payment_status, transaction_id, payment_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [
          studentId,
          sem,
          amount,
          paidAmount,
          dueDate.toISOString().split('T')[0],
          status,
          paidAmount > 0 ? `TXN${Date.now()}${studentId}${sem}` : null,
          paidAmount > 0 ? new Date(dueDate.getTime() - this.getRandomInt(1, 10) * 24 * 60 * 60 * 1000) : null
        ]
      );
    }
  }

  /**
   * Generate admit card for a student
   */
  async generateAdmitCard(studentId, userData) {
    const verificationCode = crypto.randomBytes(8).toString('hex').toUpperCase();
    const today = new Date();
    const examDate = new Date(today);
    examDate.setDate(examDate.getDate() + 60);

    await db.query(
      'INSERT INTO admit_cards (student_id, exam_name, exam_date, verification_code, qr_code) VALUES (?, ?, ?, ?, ?)',
      [
        studentId,
        `Semester ${userData.year * 2} Examination 2025`,
        examDate.toISOString().split('T')[0],
        verificationCode,
        `https://api.qrserver.com/v1/create-qr-code/?data=${verificationCode}`
      ]
    );
  }

  /**
   * Generate achievements for a student
   */
  async generateAchievements(studentId) {
    const achievementTypes = [
      { title: 'Welcome to ITER', badge: '👋', category: 'General', description: 'Successfully joined ITER family' },
      { title: 'First Login', badge: '🎯', category: 'System', description: 'Completed first login to the portal' }
    ];

    const today = new Date();
    for (const achievement of achievementTypes) {
      await db.query(
        'INSERT INTO achievements (user_id, title, description, badge_icon, category, date_achieved, verified) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [studentId, achievement.title, achievement.description, achievement.badge, achievement.category, today.toISOString().split('T')[0], true]
      );
    }
  }

  /**
   * Generate data for a newly registered teacher
   */
  async generateTeacherData(userId, userData) {
    try {
      console.log(`Generating data for teacher ID: ${userId}`);

      // Teachers get minimal auto-generation, they create their own content
      
      // 1. Add welcome achievement
      await this.generateTeacherAchievements(userId);

      console.log(`✓ Successfully generated data for teacher ${userId}`);
      return { success: true };
    } catch (error) {
      console.error('Error generating teacher data:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Generate achievements for a teacher
   */
  async generateTeacherAchievements(teacherId) {
    const today = new Date();
    await db.query(
      'INSERT INTO achievements (user_id, title, description, badge_icon, category, date_achieved, verified) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [teacherId, 'Welcome to ITER Faculty', 'Successfully joined ITER teaching staff', '👨‍🏫', 'General', today.toISOString().split('T')[0], true]
    );
  }

  /**
   * Main entry point - automatically called after user registration
   */
  async generateForNewUser(userId, userData) {
    try {
      if (userData.role === 'student') {
        return await this.generateStudentData(userId, userData);
      } else if (userData.role === 'teacher') {
        return await this.generateTeacherData(userId, userData);
      }
      return { success: true };
    } catch (error) {
      console.error('Error in generateForNewUser:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new AutoDataGenerator();
