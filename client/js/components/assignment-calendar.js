/**
 * Assignment Calendar Component
 * Full calendar with deadline tracking and reminders
 */

class AssignmentCalendar {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      throw new Error(`Container ${containerId} not found`);
    }

    this.options = {
      view: 'month', // month, week, day
      courses: [],
      ...options
    };

    this.state = {
      currentDate: new Date(),
      selectedDate: new Date(),
      assignments: [],
      filter: 'all', // all, pending, completed
      selectedCourse: 'all'
    };

    this.init();
  }

  /**
   * Initialize calendar
   */
  init() {
    this.loadAssignments();
    this.render();
    this.checkUpcomingDeadlines();
  }

  /**
   * Render calendar
   */
  render() {
    this.container.innerHTML = `
      <div class="assignment-calendar">
        <div class="calendar-header">
          <h2><i class="fas fa-calendar-alt"></i> Assignment Calendar</h2>
          <div class="calendar-actions">
            <button class="btn-icon" id="add-assignment-btn" title="Add Assignment">
              <i class="fas fa-plus"></i>
            </button>
            <button class="btn-icon" id="calendar-settings-btn" title="Settings">
              <i class="fas fa-cog"></i>
            </button>
          </div>
        </div>

        <div class="calendar-toolbar">
          <div class="calendar-nav">
            <button class="btn-nav" id="prev-btn">
              <i class="fas fa-chevron-left"></i>
            </button>
            <h3 class="calendar-title" id="calendar-title">
              ${this.getCalendarTitle()}
            </h3>
            <button class="btn-nav" id="next-btn">
              <i class="fas fa-chevron-right"></i>
            </button>
            <button class="btn-today" id="today-btn">Today</button>
          </div>

          <div class="calendar-filters">
            <select id="view-select" class="calendar-select">
              <option value="month" ${this.options.view === 'month' ? 'selected' : ''}>Month</option>
              <option value="week" ${this.options.view === 'week' ? 'selected' : ''}>Week</option>
              <option value="day" ${this.options.view === 'day' ? 'selected' : ''}>Day</option>
            </select>
            <select id="filter-select" class="calendar-select">
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="completed">Completed</option>
            </select>
            <select id="course-filter" class="calendar-select">
              <option value="all">All Courses</option>
              ${this.getCourseOptions()}
            </select>
          </div>
        </div>

        <div class="calendar-view" id="calendar-view">
          ${this.renderCalendarView()}
        </div>

        <div class="upcoming-deadlines">
          <h3><i class="fas fa-bell"></i> Upcoming Deadlines</h3>
          <div id="upcoming-list" class="upcoming-list">
            ${this.renderUpcomingDeadlines()}
          </div>
        </div>
      </div>

      <!-- Add/Edit Assignment Modal -->
      <div class="assignment-modal" id="assignment-modal" style="display: none;">
        <div class="modal-content">
          <div class="modal-header">
            <h3><i class="fas fa-plus-circle"></i> <span id="modal-title">Add Assignment</span></h3>
            <button class="btn-icon" id="close-modal-btn">
              <i class="fas fa-times"></i>
            </button>
          </div>
          <div class="modal-body">
            <form id="assignment-form">
              <div class="form-group">
                <label>Assignment Title *</label>
                <input type="text" id="assignment-title" required maxlength="100">
              </div>
              <div class="form-group">
                <label>Course *</label>
                <select id="assignment-course" required>
                  <option value="">Select course</option>
                  ${this.getCourseOptions()}
                </select>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label>Due Date *</label>
                  <input type="date" id="assignment-date" required>
                </div>
                <div class="form-group">
                  <label>Due Time</label>
                  <input type="time" id="assignment-time" value="23:59">
                </div>
              </div>
              <div class="form-group">
                <label>Priority</label>
                <select id="assignment-priority">
                  <option value="low">Low</option>
                  <option value="medium" selected>Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
              <div class="form-group">
                <label>Description</label>
                <textarea id="assignment-description" rows="4" maxlength="500"></textarea>
              </div>
              <div class="form-group">
                <label>
                  <input type="checkbox" id="assignment-reminder" checked>
                  Remind me 1 day before deadline
                </label>
              </div>
              <input type="hidden" id="assignment-id">
            </form>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" id="cancel-btn">Cancel</button>
            <button class="btn btn-primary" id="save-assignment-btn">Save Assignment</button>
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
    // Navigation
    document.getElementById('prev-btn')?.addEventListener('click', () => this.navigate('prev'));
    document.getElementById('next-btn')?.addEventListener('click', () => this.navigate('next'));
    document.getElementById('today-btn')?.addEventListener('click', () => this.goToToday());

    // View/Filter changes
    document.getElementById('view-select')?.addEventListener('change', (e) => {
      this.options.view = e.target.value;
      this.render();
    });

    document.getElementById('filter-select')?.addEventListener('change', (e) => {
      this.state.filter = e.target.value;
      this.render();
    });

    document.getElementById('course-filter')?.addEventListener('change', (e) => {
      this.state.selectedCourse = e.target.value;
      this.render();
    });

    // Add assignment
    document.getElementById('add-assignment-btn')?.addEventListener('click', () => {
      this.openModal();
    });

    // Modal controls
    document.getElementById('close-modal-btn')?.addEventListener('click', () => {
      this.closeModal();
    });

    document.getElementById('cancel-btn')?.addEventListener('click', () => {
      this.closeModal();
    });

    document.getElementById('save-assignment-btn')?.addEventListener('click', () => {
      this.saveAssignment();
    });

    // Click outside modal
    document.getElementById('assignment-modal')?.addEventListener('click', (e) => {
      if (e.target.id === 'assignment-modal') {
        this.closeModal();
      }
    });
  }

  /**
   * Render calendar view based on selected view type
   */
  renderCalendarView() {
    switch (this.options.view) {
      case 'month':
        return this.renderMonthView();
      case 'week':
        return this.renderWeekView();
      case 'day':
        return this.renderDayView();
      default:
        return this.renderMonthView();
    }
  }

  /**
   * Render month view
   */
  renderMonthView() {
    const year = this.state.currentDate.getFullYear();
    const month = this.state.currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());

    const weeks = [];
    let currentDate = new Date(startDate);

    while (currentDate <= lastDay || currentDate.getDay() !== 0) {
      const week = [];
      for (let i = 0; i < 7; i++) {
        week.push(new Date(currentDate));
        currentDate.setDate(currentDate.getDate() + 1);
      }
      weeks.push(week);
      if (currentDate.getDay() === 0 && currentDate > lastDay) break;
    }

    return `
      <div class="month-view">
        <div class="weekday-header">
          ${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => 
            `<div class="weekday">${day}</div>`
          ).join('')}
        </div>
        <div class="month-grid">
          ${weeks.map(week => `
            <div class="week-row">
              ${week.map(date => this.renderDateCell(date, month)).join('')}
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  /**
   * Render date cell
   */
  renderDateCell(date, currentMonth) {
    const isCurrentMonth = date.getMonth() === currentMonth;
    const isToday = this.isToday(date);
    const assignments = this.getAssignmentsForDate(date);
    const dateStr = date.toISOString().split('T')[0];

    return `
      <div class="date-cell ${!isCurrentMonth ? 'other-month' : ''} ${isToday ? 'today' : ''}" 
           data-date="${dateStr}">
        <div class="date-number">${date.getDate()}</div>
        <div class="date-assignments">
          ${assignments.slice(0, 3).map(a => `
            <div class="assignment-dot ${a.priority}" 
                 title="${a.title}"
                 onclick="window.calendarInstance.editAssignment('${a.id}')">
              <span class="dot-text">${a.title.substring(0, 15)}${a.title.length > 15 ? '...' : ''}</span>
            </div>
          `).join('')}
          ${assignments.length > 3 ? `<div class="more-assignments">+${assignments.length - 3} more</div>` : ''}
        </div>
      </div>
    `;
  }

  /**
   * Render week view
   */
  renderWeekView() {
    const startOfWeek = new Date(this.state.currentDate);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());

    const days = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(date.getDate() + i);
      days.push(date);
    }

    return `
      <div class="week-view">
        <div class="week-header">
          ${days.map(date => `
            <div class="week-day-header ${this.isToday(date) ? 'today' : ''}">
              <div class="day-name">${date.toLocaleDateString('en-US', { weekday: 'short' })}</div>
              <div class="day-number">${date.getDate()}</div>
            </div>
          `).join('')}
        </div>
        <div class="week-body">
          ${days.map(date => `
            <div class="week-day-column">
              ${this.getAssignmentsForDate(date).map(a => `
                <div class="assignment-card ${a.priority} ${a.status}" 
                     onclick="window.calendarInstance.editAssignment('${a.id}')">
                  <div class="assignment-time">${a.time || '23:59'}</div>
                  <div class="assignment-title">${a.title}</div>
                  <div class="assignment-course">${a.course}</div>
                  <button class="btn-complete" onclick="event.stopPropagation(); window.calendarInstance.toggleComplete('${a.id}')">
                    <i class="fas ${a.status === 'completed' ? 'fa-check-circle' : 'fa-circle'}"></i>
                  </button>
                </div>
              `).join('')}
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  /**
   * Render day view
   */
  renderDayView() {
    const assignments = this.getAssignmentsForDate(this.state.currentDate);
    
    return `
      <div class="day-view">
        <div class="day-header">
          <h3>${this.state.currentDate.toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })}</h3>
        </div>
        <div class="day-assignments">
          ${assignments.length === 0 ? `
            <div class="no-assignments">
              <i class="fas fa-calendar-check"></i>
              <p>No assignments due today</p>
            </div>
          ` : assignments.map(a => `
            <div class="assignment-card-large ${a.priority} ${a.status}"
                 onclick="window.calendarInstance.editAssignment('${a.id}')">
              <div class="assignment-header">
                <div>
                  <div class="assignment-title">${a.title}</div>
                  <div class="assignment-meta">
                    <span class="course-badge">${a.course}</span>
                    <span class="priority-badge">${a.priority}</span>
                  </div>
                </div>
                <button class="btn-complete-large" 
                        onclick="event.stopPropagation(); window.calendarInstance.toggleComplete('${a.id}')">
                  <i class="fas ${a.status === 'completed' ? 'fa-check-circle' : 'fa-circle'}"></i>
                </button>
              </div>
              <div class="assignment-time">
                <i class="fas fa-clock"></i> Due at ${a.time || '23:59'}
              </div>
              ${a.description ? `<div class="assignment-description">${a.description}</div>` : ''}
              <div class="assignment-actions">
                <button class="btn-sm" onclick="event.stopPropagation(); window.calendarInstance.deleteAssignment('${a.id}')">
                  <i class="fas fa-trash"></i> Delete
                </button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  /**
   * Render upcoming deadlines
   */
  renderUpcomingDeadlines() {
    const upcoming = this.state.assignments
      .filter(a => a.status === 'pending')
      .filter(a => new Date(a.date) >= new Date())
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .slice(0, 5);

    if (upcoming.length === 0) {
      return '<p class="no-deadlines">No upcoming deadlines</p>';
    }

    return upcoming.map(a => {
      const daysUntil = this.getDaysUntil(a.date);
      return `
        <div class="deadline-item ${a.priority}" onclick="window.calendarInstance.editAssignment('${a.id}')">
          <div class="deadline-info">
            <div class="deadline-title">${a.title}</div>
            <div class="deadline-meta">
              <span>${a.course}</span>
              <span>${this.formatDate(a.date)}</span>
            </div>
          </div>
          <div class="deadline-badge ${daysUntil <= 1 ? 'urgent' : ''}">
            ${daysUntil === 0 ? 'Today' : daysUntil === 1 ? 'Tomorrow' : `${daysUntil} days`}
          </div>
        </div>
      `;
    }).join('');
  }

  /**
   * Get assignments for specific date
   */
  getAssignmentsForDate(date) {
    const dateStr = date.toISOString().split('T')[0];
    return this.state.assignments.filter(a => {
      const assignmentDate = a.date.split('T')[0];
      const matchesDate = assignmentDate === dateStr;
      const matchesFilter = this.state.filter === 'all' || a.status === this.state.filter;
      const matchesCourse = this.state.selectedCourse === 'all' || a.course === this.state.selectedCourse;
      return matchesDate && matchesFilter && matchesCourse;
    });
  }

  /**
   * Navigation
   */
  navigate(direction) {
    const date = new Date(this.state.currentDate);
    switch (this.options.view) {
      case 'month':
        date.setMonth(date.getMonth() + (direction === 'next' ? 1 : -1));
        break;
      case 'week':
        date.setDate(date.getDate() + (direction === 'next' ? 7 : -7));
        break;
      case 'day':
        date.setDate(date.getDate() + (direction === 'next' ? 1 : -1));
        break;
    }
    this.state.currentDate = date;
    this.render();
  }

  /**
   * Go to today
   */
  goToToday() {
    this.state.currentDate = new Date();
    this.render();
  }

  /**
   * Get calendar title
   */
  getCalendarTitle() {
    switch (this.options.view) {
      case 'month':
        return this.state.currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      case 'week':
        const startOfWeek = new Date(this.state.currentDate);
        startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(endOfWeek.getDate() + 6);
        return `${startOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
      case 'day':
        return this.state.currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
      default:
        return '';
    }
  }

  /**
   * Open modal for add/edit
   */
  openModal(assignmentId = null) {
    const modal = document.getElementById('assignment-modal');
    const form = document.getElementById('assignment-form');
    form.reset();

    if (assignmentId) {
      const assignment = this.state.assignments.find(a => a.id === assignmentId);
      if (assignment) {
        document.getElementById('modal-title').textContent = 'Edit Assignment';
        document.getElementById('assignment-id').value = assignment.id;
        document.getElementById('assignment-title').value = assignment.title;
        document.getElementById('assignment-course').value = assignment.course;
        document.getElementById('assignment-date').value = assignment.date.split('T')[0];
        document.getElementById('assignment-time').value = assignment.time || '23:59';
        document.getElementById('assignment-priority').value = assignment.priority;
        document.getElementById('assignment-description').value = assignment.description || '';
        document.getElementById('assignment-reminder').checked = assignment.reminder !== false;
      }
    } else {
      document.getElementById('modal-title').textContent = 'Add Assignment';
      document.getElementById('assignment-date').value = this.state.currentDate.toISOString().split('T')[0];
    }

    modal.style.display = 'flex';
  }

  /**
   * Close modal
   */
  closeModal() {
    document.getElementById('assignment-modal').style.display = 'none';
  }

  /**
   * Save assignment
   */
  saveAssignment() {
    const id = document.getElementById('assignment-id').value;
    const assignment = {
      id: id || `assignment-${Date.now()}`,
      title: document.getElementById('assignment-title').value,
      course: document.getElementById('assignment-course').value,
      date: document.getElementById('assignment-date').value,
      time: document.getElementById('assignment-time').value,
      priority: document.getElementById('assignment-priority').value,
      description: document.getElementById('assignment-description').value,
      reminder: document.getElementById('assignment-reminder').checked,
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    if (!assignment.title || !assignment.course || !assignment.date) {
      alert('Please fill in all required fields');
      return;
    }

    if (id) {
      const index = this.state.assignments.findIndex(a => a.id === id);
      this.state.assignments[index] = assignment;
    } else {
      this.state.assignments.push(assignment);
    }

    this.saveAssignments();
    this.closeModal();
    this.render();

    if (window.showToast) {
      window.showToast(`Assignment ${id ? 'updated' : 'added'} successfully!`, 'success');
    }
  }

  /**
   * Edit assignment
   */
  editAssignment(id) {
    this.openModal(id);
  }

  /**
   * Toggle assignment completion
   */
  toggleComplete(id) {
    const assignment = this.state.assignments.find(a => a.id === id);
    if (assignment) {
      assignment.status = assignment.status === 'completed' ? 'pending' : 'completed';
      this.saveAssignments();
      this.render();
    }
  }

  /**
   * Delete assignment
   */
  deleteAssignment(id) {
    if (confirm('Are you sure you want to delete this assignment?')) {
      this.state.assignments = this.state.assignments.filter(a => a.id !== id);
      this.saveAssignments();
      this.render();
      if (window.showToast) {
        window.showToast('Assignment deleted', 'success');
      }
    }
  }

  /**
   * Check upcoming deadlines and show notifications
   */
  checkUpcomingDeadlines() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    this.state.assignments
      .filter(a => a.status === 'pending' && a.reminder)
      .filter(a => a.date.split('T')[0] === tomorrowStr)
      .forEach(a => {
        if (window.showToast) {
          window.showToast(`Reminder: "${a.title}" is due tomorrow!`, 'warning');
        }
      });
  }

  /**
   * Helper methods
   */
  isToday(date) {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  }

  getDaysUntil(dateStr) {
    const date = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    date.setHours(0, 0, 0, 0);
    return Math.ceil((date - today) / (1000 * 60 * 60 * 24));
  }

  formatDate(dateStr) {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  getCourseOptions() {
    const courses = ['Data Structures', 'Algorithms', 'Web Development', 'Database Systems', 
                     'Operating Systems', 'Computer Networks', 'Machine Learning'];
    return courses.map(c => `<option value="${c}">${c}</option>`).join('');
  }

  /**
   * Storage methods
   */
  saveAssignments() {
    localStorage.setItem('calendar-assignments', JSON.stringify(this.state.assignments));
  }

  loadAssignments() {
    try {
      const saved = localStorage.getItem('calendar-assignments');
      if (saved) {
        this.state.assignments = JSON.parse(saved);
      }
    } catch (error) {
      console.error('Load assignments error:', error);
    }
  }
}

// Export and global instance
window.AssignmentCalendar = AssignmentCalendar;
export default AssignmentCalendar;
