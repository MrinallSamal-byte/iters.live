/**
 * GPA Calculator Component
 * Calculate CGPA, SGPA with credit weighting and grade points
 */

class GPACalculator {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      throw new Error(`Container ${containerId} not found`);
    }

    this.options = {
      gradeSystem: 'ten-point', // ten-point, four-point, letter
      apiUrl: '/api/students',
      ...options
    };

    // Grade point mappings
    this.gradeSystems = {
      'ten-point': {
        'O': 10, 'A+': 9, 'A': 8, 'B+': 7, 'B': 6, 
        'C': 5, 'P': 4, 'F': 0
      },
      'four-point': {
        'A': 4.0, 'A-': 3.7, 'B+': 3.3, 'B': 3.0, 'B-': 2.7,
        'C+': 2.3, 'C': 2.0, 'C-': 1.7, 'D': 1.0, 'F': 0
      },
      'letter': {
        'A': 4.0, 'B': 3.0, 'C': 2.0, 'D': 1.0, 'F': 0
      }
    };

    this.semesters = [];
    this.init();
  }

  /**
   * Initialize calculator
   */
  init() {
    this.render();
    this.loadSavedData();
  }

  /**
   * Render calculator UI
   */
  render() {
    this.container.innerHTML = `
      <div class="gpa-calculator">
        <div class="gpa-header">
          <h2><i class="fas fa-calculator"></i> GPA Calculator</h2>
          <div class="gpa-system-selector">
            <label>Grade System:</label>
            <select id="grade-system" class="form-control">
              <option value="ten-point" ${this.options.gradeSystem === 'ten-point' ? 'selected' : ''}>10-Point Scale</option>
              <option value="four-point" ${this.options.gradeSystem === 'four-point' ? 'selected' : ''}>4-Point Scale</option>
              <option value="letter" ${this.options.gradeSystem === 'letter' ? 'selected' : ''}>Letter Grades</option>
            </select>
          </div>
        </div>

        <div class="gpa-summary">
          <div class="gpa-card cgpa-card">
            <div class="gpa-label">CGPA</div>
            <div class="gpa-value" id="cgpa-value">0.00</div>
            <div class="gpa-subtitle">Cumulative Grade Point Average</div>
          </div>
          <div class="gpa-card sgpa-card">
            <div class="gpa-label">SGPA</div>
            <div class="gpa-value" id="sgpa-value">0.00</div>
            <div class="gpa-subtitle">Current Semester GPA</div>
          </div>
          <div class="gpa-card credits-card">
            <div class="gpa-label">Credits</div>
            <div class="gpa-value" id="total-credits">0</div>
            <div class="gpa-subtitle">Total Credits Earned</div>
          </div>
        </div>

        <div class="gpa-controls">
          <button class="btn btn-primary" id="add-semester-btn">
            <i class="fas fa-plus"></i> Add Semester
          </button>
          <button class="btn btn-secondary" id="save-data-btn">
            <i class="fas fa-save"></i> Save Data
          </button>
          <button class="btn btn-secondary" id="export-pdf-btn">
            <i class="fas fa-file-pdf"></i> Export PDF
          </button>
          <button class="btn btn-danger" id="clear-all-btn">
            <i class="fas fa-trash"></i> Clear All
          </button>
        </div>

        <div class="semesters-container" id="semesters-container">
          <div class="empty-state">
            <i class="fas fa-graduation-cap"></i>
            <p>Add your first semester to start calculating</p>
          </div>
        </div>
      </div>
    `;

    this.attachEventListeners();
  }

  /**
   * Attach event listeners
   */
  attachEventListeners() {
    // Grade system change
    document.getElementById('grade-system')?.addEventListener('change', (e) => {
      this.options.gradeSystem = e.target.value;
      this.recalculateAll();
    });

    // Add semester
    document.getElementById('add-semester-btn')?.addEventListener('click', () => {
      this.addSemester();
    });

    // Save data
    document.getElementById('save-data-btn')?.addEventListener('click', () => {
      this.saveData();
    });

    // Export PDF
    document.getElementById('export-pdf-btn')?.addEventListener('click', () => {
      this.exportPDF();
    });

    // Clear all
    document.getElementById('clear-all-btn')?.addEventListener('click', () => {
      if (confirm('Are you sure you want to clear all data?')) {
        this.clearAll();
      }
    });
  }

  /**
   * Add new semester
   */
  addSemester() {
    const semesterId = `sem-${Date.now()}`;
    const semester = {
      id: semesterId,
      number: this.semesters.length + 1,
      courses: []
    };

    this.semesters.push(semester);
    this.renderSemesters();
  }

  /**
   * Render all semesters
   */
  renderSemesters() {
    const container = document.getElementById('semesters-container');
    if (!container) return;

    if (this.semesters.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-graduation-cap"></i>
          <p>Add your first semester to start calculating</p>
        </div>
      `;
      return;
    }

    container.innerHTML = this.semesters.map(sem => this.renderSemester(sem)).join('');
    this.attachSemesterListeners();
  }

  /**
   * Render single semester
   */
  renderSemester(semester) {
    const sgpa = this.calculateSGPA(semester);
    const totalCredits = semester.courses.reduce((sum, c) => sum + (parseFloat(c.credits) || 0), 0);

    return `
      <div class="semester-card" data-semester-id="${semester.id}">
        <div class="semester-header">
          <h3>
            <i class="fas fa-book"></i> Semester ${semester.number}
            <span class="semester-sgpa">SGPA: ${sgpa.toFixed(2)}</span>
          </h3>
          <div class="semester-actions">
            <button class="btn-icon add-course-btn" title="Add Course">
              <i class="fas fa-plus"></i>
            </button>
            <button class="btn-icon remove-semester-btn" title="Remove Semester">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </div>

        <div class="courses-table">
          <table>
            <thead>
              <tr>
                <th>Course Name</th>
                <th>Credits</th>
                <th>Grade</th>
                <th>Points</th>
                <th></th>
              </tr>
            </thead>
            <tbody id="courses-${semester.id}">
              ${semester.courses.length === 0 ? 
                '<tr><td colspan="5" class="no-courses">No courses added yet</td></tr>' :
                semester.courses.map(course => this.renderCourse(semester.id, course)).join('')
              }
            </tbody>
          </table>
        </div>

        <div class="semester-summary">
          <div class="summary-item">
            <span>Total Credits:</span>
            <strong>${totalCredits}</strong>
          </div>
          <div class="summary-item">
            <span>SGPA:</span>
            <strong>${sgpa.toFixed(2)}</strong>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Render course row
   */
  renderCourse(semesterId, course) {
    const gradeOptions = Object.keys(this.gradeSystems[this.options.gradeSystem])
      .map(grade => `<option value="${grade}" ${course.grade === grade ? 'selected' : ''}>${grade}</option>`)
      .join('');

    const points = course.grade ? 
      (parseFloat(course.credits) || 0) * this.gradeSystems[this.options.gradeSystem][course.grade] : 
      0;

    return `
      <tr data-course-id="${course.id}">
        <td>
          <input type="text" 
                 class="course-name-input" 
                 value="${course.name || ''}" 
                 placeholder="Course name"
                 data-field="name">
        </td>
        <td>
          <input type="number" 
                 class="course-credits-input" 
                 value="${course.credits || ''}" 
                 placeholder="3"
                 min="0"
                 step="0.5"
                 data-field="credits">
        </td>
        <td>
          <select class="course-grade-select" data-field="grade">
            <option value="">-</option>
            ${gradeOptions}
          </select>
        </td>
        <td class="course-points">${points.toFixed(2)}</td>
        <td>
          <button class="btn-icon-sm remove-course-btn" title="Remove">
            <i class="fas fa-times"></i>
          </button>
        </td>
      </tr>
    `;
  }

  /**
   * Attach semester-specific listeners
   */
  attachSemesterListeners() {
    // Add course buttons
    document.querySelectorAll('.add-course-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const card = e.target.closest('.semester-card');
        const semesterId = card.getAttribute('data-semester-id');
        this.addCourse(semesterId);
      });
    });

    // Remove semester buttons
    document.querySelectorAll('.remove-semester-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const card = e.target.closest('.semester-card');
        const semesterId = card.getAttribute('data-semester-id');
        if (confirm('Remove this semester?')) {
          this.removeSemester(semesterId);
        }
      });
    });

    // Remove course buttons
    document.querySelectorAll('.remove-course-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const row = e.target.closest('tr');
        const card = e.target.closest('.semester-card');
        const semesterId = card.getAttribute('data-semester-id');
        const courseId = row.getAttribute('data-course-id');
        this.removeCourse(semesterId, courseId);
      });
    });

    // Course input changes
    document.querySelectorAll('.course-name-input, .course-credits-input, .course-grade-select').forEach(input => {
      input.addEventListener('change', (e) => {
        const row = e.target.closest('tr');
        const card = e.target.closest('.semester-card');
        const semesterId = card.getAttribute('data-semester-id');
        const courseId = row.getAttribute('data-course-id');
        const field = e.target.getAttribute('data-field');
        const value = e.target.value;
        
        this.updateCourse(semesterId, courseId, field, value);
      });
    });
  }

  /**
   * Add course to semester
   */
  addCourse(semesterId) {
    const semester = this.semesters.find(s => s.id === semesterId);
    if (!semester) return;

    const course = {
      id: `course-${Date.now()}`,
      name: '',
      credits: 3,
      grade: ''
    };

    semester.courses.push(course);
    this.renderSemesters();
    this.recalculateAll();
  }

  /**
   * Remove course from semester
   */
  removeCourse(semesterId, courseId) {
    const semester = this.semesters.find(s => s.id === semesterId);
    if (!semester) return;

    semester.courses = semester.courses.filter(c => c.id !== courseId);
    this.renderSemesters();
    this.recalculateAll();
  }

  /**
   * Update course data
   */
  updateCourse(semesterId, courseId, field, value) {
    const semester = this.semesters.find(s => s.id === semesterId);
    if (!semester) return;

    const course = semester.courses.find(c => c.id === courseId);
    if (!course) return;

    course[field] = value;
    this.renderSemesters();
    this.recalculateAll();
  }

  /**
   * Remove semester
   */
  removeSemester(semesterId) {
    this.semesters = this.semesters.filter(s => s.id !== semesterId);
    
    // Renumber semesters
    this.semesters.forEach((sem, index) => {
      sem.number = index + 1;
    });

    this.renderSemesters();
    this.recalculateAll();
  }

  /**
   * Calculate SGPA for a semester
   */
  calculateSGPA(semester) {
    let totalPoints = 0;
    let totalCredits = 0;

    semester.courses.forEach(course => {
      const credits = parseFloat(course.credits) || 0;
      const grade = course.grade;
      
      if (grade && this.gradeSystems[this.options.gradeSystem][grade] !== undefined) {
        const gradePoint = this.gradeSystems[this.options.gradeSystem][grade];
        totalPoints += credits * gradePoint;
        totalCredits += credits;
      }
    });

    return totalCredits > 0 ? totalPoints / totalCredits : 0;
  }

  /**
   * Calculate CGPA across all semesters
   */
  calculateCGPA() {
    let totalPoints = 0;
    let totalCredits = 0;

    this.semesters.forEach(semester => {
      semester.courses.forEach(course => {
        const credits = parseFloat(course.credits) || 0;
        const grade = course.grade;
        
        if (grade && this.gradeSystems[this.options.gradeSystem][grade] !== undefined) {
          const gradePoint = this.gradeSystems[this.options.gradeSystem][grade];
          totalPoints += credits * gradePoint;
          totalCredits += credits;
        }
      });
    });

    return {
      cgpa: totalCredits > 0 ? totalPoints / totalCredits : 0,
      credits: totalCredits
    };
  }

  /**
   * Recalculate all GPAs
   */
  recalculateAll() {
    const { cgpa, credits } = this.calculateCGPA();
    
    // Update CGPA display
    document.getElementById('cgpa-value').textContent = cgpa.toFixed(2);
    document.getElementById('total-credits').textContent = credits;

    // Update SGPA for current semester (last semester)
    if (this.semesters.length > 0) {
      const lastSemester = this.semesters[this.semesters.length - 1];
      const sgpa = this.calculateSGPA(lastSemester);
      document.getElementById('sgpa-value').textContent = sgpa.toFixed(2);
    } else {
      document.getElementById('sgpa-value').textContent = '0.00';
    }
  }

  /**
   * Save data to localStorage
   */
  saveData() {
    try {
      const data = {
        gradeSystem: this.options.gradeSystem,
        semesters: this.semesters
      };
      
      localStorage.setItem('gpa-calculator-data', JSON.stringify(data));
      this.showSuccess('Data saved successfully!');
    } catch (error) {
      console.error('Save error:', error);
      this.showError('Failed to save data');
    }
  }

  /**
   * Load saved data from localStorage
   */
  loadSavedData() {
    try {
      const saved = localStorage.getItem('gpa-calculator-data');
      if (saved) {
        const data = JSON.parse(saved);
        this.options.gradeSystem = data.gradeSystem || 'ten-point';
        this.semesters = data.semesters || [];
        
        document.getElementById('grade-system').value = this.options.gradeSystem;
        this.renderSemesters();
        this.recalculateAll();
      }
    } catch (error) {
      console.error('Load error:', error);
    }
  }

  /**
   * Clear all data
   */
  clearAll() {
    this.semesters = [];
    localStorage.removeItem('gpa-calculator-data');
    this.renderSemesters();
    this.recalculateAll();
    this.showSuccess('All data cleared');
  }

  /**
   * Export to PDF
   */
  exportPDF() {
    const { cgpa, credits } = this.calculateCGPA();
    
    // Create printable content
    const content = `
      <div style="padding: 40px; font-family: Arial, sans-serif;">
        <h1 style="text-align: center; color: #667eea;">GPA Report</h1>
        <div style="text-align: center; margin: 30px 0;">
          <div style="display: inline-block; margin: 0 20px;">
            <h2 style="color: #667eea;">CGPA</h2>
            <p style="font-size: 48px; font-weight: bold;">${cgpa.toFixed(2)}</p>
          </div>
          <div style="display: inline-block; margin: 0 20px;">
            <h2 style="color: #667eea;">Total Credits</h2>
            <p style="font-size: 48px; font-weight: bold;">${credits}</p>
          </div>
        </div>
        ${this.semesters.map(sem => {
          const sgpa = this.calculateSGPA(sem);
          return `
            <h3>Semester ${sem.number} - SGPA: ${sgpa.toFixed(2)}</h3>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
              <thead>
                <tr style="background: #f3f4f6;">
                  <th style="padding: 10px; border: 1px solid #ddd;">Course</th>
                  <th style="padding: 10px; border: 1px solid #ddd;">Credits</th>
                  <th style="padding: 10px; border: 1px solid #ddd;">Grade</th>
                </tr>
              </thead>
              <tbody>
                ${sem.courses.map(course => `
                  <tr>
                    <td style="padding: 10px; border: 1px solid #ddd;">${course.name || 'Unnamed'}</td>
                    <td style="padding: 10px; border: 1px solid #ddd;">${course.credits}</td>
                    <td style="padding: 10px; border: 1px solid #ddd;">${course.grade}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          `;
        }).join('')}
        <p style="text-align: center; color: #888; margin-top: 40px;">
          Generated on ${new Date().toLocaleDateString()}
        </p>
      </div>
    `;

    // Open print dialog
    const printWindow = window.open('', '_blank');
    printWindow.document.write(content);
    printWindow.document.close();
    printWindow.print();
  }

  /**
   * Show success message
   */
  showSuccess(message) {
    if (window.showToast) {
      window.showToast(message, 'success');
    } else {
      alert(message);
    }
  }

  /**
   * Show error message
   */
  showError(message) {
    if (window.showToast) {
      window.showToast(message, 'error');
    } else {
      alert(message);
    }
  }
}

// Export
window.GPACalculator = GPACalculator;
export default GPACalculator;
