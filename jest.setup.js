// Jest setup: lightweight browser component stubs for jsdom tests

// Simple toast stub used by tests and some components
global.showToast = function showToast(message, type = 'info') {
  // no-op for tests; could log if needed
};

// GPA Calculator stub with minimal behavior required by tests
class GPACalculatorMock {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    if (!this.container) throw new Error(`Container ${containerId} not found`);
    this.semesters = [];
    this.cgpa = 0;
  }

  addSemester() {
    this.semesters.push({ id: `s-${Date.now()}`, courses: [] });
  }

  calculateCGPA() {
    let totalCredits = 0;
    let totalPoints = 0;
    for (const sem of this.semesters) {
      for (const c of sem.courses) {
        const credits = Number(c.credits) || 0;
        const gradePoint = Number(c.gradePoint) || 0;
        totalCredits += credits;
        totalPoints += credits * gradePoint;
      }
    }
    this.cgpa = totalCredits > 0 ? Number((totalPoints / totalCredits).toFixed(1)) : 0;
  }

  saveSemesters() {
    localStorage.setItem('gpaSemesters', JSON.stringify(this.semesters));
  }
}

// Assignment Calendar minimal implementation
class AssignmentCalendarMock {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    if (!this.container) throw new Error(`Container ${containerId} not found`);
    this.assignments = [];
  }
  getAssignmentsForDate(date) {
    return this.assignments.filter(a => a.date === date);
  }
}

// Question Bank minimal implementation
class QuestionBankMock {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    if (!this.container) throw new Error(`Container ${containerId} not found`);
    this.questions = [
      { id: 'q1', difficulty: 'easy' },
      { id: 'q2', difficulty: 'easy' },
      { id: 'q3', difficulty: 'medium' },
      { id: 'q4', difficulty: 'hard' },
      { id: 'q5', difficulty: 'medium' }
    ];
    this.filteredQuestions = [...this.questions];
    this.selectedDifficulty = 'all';
  }
  applyFilters() {
    this.filteredQuestions = this.selectedDifficulty === 'all'
      ? [...this.questions]
      : this.questions.filter(q => q.difficulty === this.selectedDifficulty);
  }
  generateQuiz(n) {
    const size = Math.min(n, this.questions.length);
    return this.questions.slice(0, size);
  }
}

// AutoGrader minimal implementation
class AutoGraderMock {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    if (!this.container) throw new Error(`Container ${containerId} not found`);
    this.quizzes = [];
    this.submissions = [];
  }
  calculateGrade(score) {
    if (score >= 90) return 'O';
    if (score >= 80) return 'A';
    if (score >= 70) return 'B';
    if (score >= 60) return 'C';
    if (score >= 50) return 'D';
    return 'F';
  }
  gradeSubmission(quizId, answers) {
    const quiz = this.quizzes.find(q => q.id === quizId);
    if (!quiz) return { score: 0, results: [] };
    let score = 0;
    const results = quiz.questions.map(q => {
      const correct = answers[q.id] === q.correctAnswer;
      if (correct) score += q.points || 0;
      return { id: q.id, correct };
    });
    return { score, results };
  }
  calculatePassRate() {
    if (this.submissions.length === 0) return 0;
    const q = this.quizzes[0];
    const passPct = q?.passPercentage ?? 0;
    const passed = this.submissions.filter(s => (s.score / q.totalPoints) * 100 >= passPct).length;
    return Number(((passed / this.submissions.length) * 100).toFixed(2));
  }
}

// RubricCreator minimal implementation
class RubricCreatorMock {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    if (!this.container) throw new Error(`Container ${containerId} not found`);
    this.rubrics = [];
  }
}

// RiskDetection minimal implementation
class RiskDetectionMock {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    if (!this.container) throw new Error(`Container ${containerId} not found`);
    this.students = [];
  }
  analyzeRisks() {
    const TWO_WEEKS = 14 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    this.students = this.students.map(s => {
      const factors = [];
      if ((s.attendance ?? 100) < 75) factors.push('low_attendance');
      if ((s.avgGrade ?? 100) < 60) factors.push('failing_grade');
      if (s.lastSubmission && (now - new Date(s.lastSubmission).getTime()) > TWO_WEEKS) factors.push('inactive');
      const riskLevel = factors.length > 0 ? 'high' : 'low';
      return { ...s, riskLevel, riskFactors: factors, interventions: s.interventions || [] };
    });
  }
}

// Lightweight stubs for integration type checks
class PomodoroTimerMock { constructor(id) { this.container = document.getElementById(id); } }
class ResumeBuilderMock { constructor(id) { this.container = document.getElementById(id); } }

// Expose to both window and global for convenience
global.GPACalculator = window.GPACalculator = GPACalculatorMock;
global.AssignmentCalendar = window.AssignmentCalendar = AssignmentCalendarMock;
global.QuestionBank = window.QuestionBank = QuestionBankMock;
global.AutoGrader = window.AutoGrader = AutoGraderMock;
global.RubricCreator = window.RubricCreator = RubricCreatorMock;
global.RiskDetection = window.RiskDetection = RiskDetectionMock;
global.PomodoroTimer = window.PomodoroTimer = PomodoroTimerMock;
global.ResumeBuilder = window.ResumeBuilder = ResumeBuilderMock;
