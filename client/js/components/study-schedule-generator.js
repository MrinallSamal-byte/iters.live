/**
 * Study Schedule Generator
 * Generates personalized study schedules based on assignments, exams, and available time
 */

class StudyScheduleGenerator {
  constructor() {
    this.preferences = {
      studyHoursPerDay: 6,
      breakDuration: 15, // minutes
      sessionDuration: 45, // minutes (Pomodoro-inspired)
      preferredStartTime: '09:00',
      preferredEndTime: '22:00',
      weekendHours: 8
    };
  }

  /**
   * Initialize the component
   */
  async init() {
    await this.loadPreferences();
    await this.loadUpcomingTasks();
    this.setupEventListeners();
    this.renderSchedule();
  }

  /**
   * Load user preferences from localStorage
   */
  async loadPreferences() {
    const saved = localStorage.getItem('studyPreferences');
    if (saved) {
      this.preferences = { ...this.preferences, ...JSON.parse(saved) };
    }
  }

  /**
   * Load upcoming assignments and exams
   */
  async loadUpcomingTasks() {
    try {
      const token = localStorage.getItem('token');
      
      // Get assignments
      const assignmentsRes = await fetch('/api/assignments/my-assignments', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const assignmentsData = await assignmentsRes.json();
      
      // Get performance analytics to identify weak subjects
      const analyticsRes = await fetch('/api/analytics/student-performance/' + this.getUserId(), {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const analyticsData = await analyticsRes.json();

      this.tasks = {
        assignments: assignmentsData.success ? assignmentsData.data : [],
        weakSubjects: analyticsData.success ? analyticsData.data.weakSubjects : []
      };
    } catch (error) {
      console.error('Error loading tasks:', error);
      this.tasks = { assignments: [], weakSubjects: [] };
    }
  }

  /**
   * Generate optimized study schedule
   */
  generateSchedule() {
    const schedule = [];
    const today = new Date();
    const daysToSchedule = 14; // Next 2 weeks

    // Sort assignments by due date
    const sortedAssignments = this.tasks.assignments
      .filter(a => !a.isSubmitted && new Date(a.due_date) > today)
      .sort((a, b) => new Date(a.due_date) - new Date(b.due_date));

    // Calculate study time needed for each assignment
    sortedAssignments.forEach(assignment => {
      const dueDate = new Date(assignment.due_date);
      const daysUntilDue = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));
      const estimatedHours = this.estimateStudyHours(assignment);
      
      assignment.estimatedHours = estimatedHours;
      assignment.hoursPerDay = Math.max(1, Math.ceil(estimatedHours / Math.max(1, daysUntilDue - 1)));
    });

    // Generate daily schedule
    for (let day = 0; day < daysToSchedule; day++) {
      const currentDate = new Date(today);
      currentDate.setDate(today.getDate() + day);
      
      const isWeekend = currentDate.getDay() === 0 || currentDate.getDay() === 6;
      const availableHours = isWeekend ? this.preferences.weekendHours : this.preferences.studyHoursPerDay;
      
      const daySchedule = this.generateDaySchedule(currentDate, sortedAssignments, availableHours);
      schedule.push(daySchedule);
    }

    return schedule;
  }

  /**
   * Generate schedule for a specific day
   */
  generateDaySchedule(date, assignments, availableHours) {
    const sessions = [];
    let remainingHours = availableHours;
    const startTime = this.parseTime(this.preferences.preferredStartTime);

    // Prioritize assignments due soon and weak subjects
    const prioritizedTasks = this.prioritizeTasks(assignments, date);

    let currentTime = new Date(date);
    currentTime.setHours(startTime.hours, startTime.minutes, 0, 0);

    for (const task of prioritizedTasks) {
      if (remainingHours <= 0) break;

      const hoursToAllocate = Math.min(task.hoursPerDay, remainingHours, 2); // Max 2 hours per subject per day
      
      if (hoursToAllocate < 0.5) continue;

      const sessionCount = Math.ceil(hoursToAllocate / (this.preferences.sessionDuration / 60));
      
      for (let i = 0; i < sessionCount; i++) {
        const sessionEnd = new Date(currentTime);
        sessionEnd.setMinutes(currentTime.getMinutes() + this.preferences.sessionDuration);

        sessions.push({
          subject: task.subject,
          title: task.title,
          type: 'assignment',
          startTime: new Date(currentTime),
          endTime: sessionEnd,
          duration: this.preferences.sessionDuration,
          priority: task.priority
        });

        currentTime = new Date(sessionEnd);
        currentTime.setMinutes(currentTime.getMinutes() + this.preferences.breakDuration);
        
        remainingHours -= this.preferences.sessionDuration / 60;
      }
    }

    // Add weak subject study sessions if time remaining
    if (remainingHours > 0 && this.tasks.weakSubjects.length > 0) {
      const weakSubject = this.tasks.weakSubjects[0];
      const sessionEnd = new Date(currentTime);
      sessionEnd.setMinutes(currentTime.getMinutes() + Math.min(this.preferences.sessionDuration, remainingHours * 60));

      sessions.push({
        subject: weakSubject.subject,
        title: `Review ${weakSubject.subject} (Weak Subject)`,
        type: 'review',
        startTime: new Date(currentTime),
        endTime: sessionEnd,
        duration: Math.min(this.preferences.sessionDuration, remainingHours * 60),
        priority: 'high'
      });
    }

    return {
      date: date,
      dayName: date.toLocaleDateString('en-US', { weekday: 'long' }),
      sessions: sessions,
      totalHours: availableHours - remainingHours
    };
  }

  /**
   * Prioritize tasks based on urgency and difficulty
   */
  prioritizeTasks(assignments, currentDate) {
    return assignments.map(assignment => {
      const dueDate = new Date(assignment.due_date);
      const daysUntilDue = Math.ceil((dueDate - currentDate) / (1000 * 60 * 60 * 24));
      
      // Priority score: closer due date and weak subjects get higher priority
      const urgencyScore = Math.max(0, 10 - daysUntilDue);
      const weakSubjectBonus = this.tasks.weakSubjects.some(w => w.subject === assignment.subject) ? 5 : 0;
      const priorityScore = urgencyScore + weakSubjectBonus;

      return {
        ...assignment,
        priority: priorityScore > 10 ? 'high' : priorityScore > 5 ? 'medium' : 'low',
        priorityScore
      };
    }).sort((a, b) => b.priorityScore - a.priorityScore);
  }

  /**
   * Estimate study hours needed for an assignment
   */
  estimateStudyHours(assignment) {
    // Simple heuristic based on assignment type
    const baseHours = {
      'project': 10,
      'assignment': 5,
      'lab': 3,
      'homework': 2
    };

    const type = assignment.type ? assignment.type.toLowerCase() : 'assignment';
    return baseHours[type] || 4;
  }

  /**
   * Render the schedule in the UI
   */
  renderSchedule() {
    const schedule = this.generateSchedule();
    const container = document.getElementById('study-schedule-container');
    
    if (!container) return;

    let html = `
      <div class="schedule-header">
        <h3>📚 Personalized Study Schedule</h3>
        <div class="schedule-actions">
          <button class="btn-icon" onclick="studyScheduler.exportSchedule()" title="Export to Calendar">
            <i class="fas fa-download"></i>
          </button>
          <button class="btn-icon" onclick="studyScheduler.showPreferences()" title="Preferences">
            <i class="fas fa-cog"></i>
          </button>
        </div>
      </div>
      <div class="schedule-summary">
        <div class="stat-card">
          <span class="stat-label">Upcoming Assignments</span>
          <span class="stat-value">${this.tasks.assignments.length}</span>
        </div>
        <div class="stat-card">
          <span class="stat-label">Weak Subjects</span>
          <span class="stat-value">${this.tasks.weakSubjects.length}</span>
        </div>
        <div class="stat-card">
          <span class="stat-label">Study Hours/Week</span>
          <span class="stat-value">${this.preferences.studyHoursPerDay * 5 + this.preferences.weekendHours * 2}</span>
        </div>
      </div>
      <div class="schedule-timeline">
    `;

    schedule.slice(0, 7).forEach(day => {
      const isToday = this.isToday(day.date);
      html += `
        <div class="day-schedule ${isToday ? 'today' : ''}">
          <div class="day-header">
            <h4>${day.dayName}</h4>
            <span class="day-date">${day.date.toLocaleDateString()}</span>
            <span class="day-hours">${day.totalHours.toFixed(1)}h</span>
          </div>
          <div class="day-sessions">
      `;

      if (day.sessions.length === 0) {
        html += `<div class="no-sessions">No study sessions scheduled</div>`;
      } else {
        day.sessions.forEach(session => {
          html += `
            <div class="session-card priority-${session.priority}">
              <div class="session-time">
                ${this.formatTime(session.startTime)} - ${this.formatTime(session.endTime)}
              </div>
              <div class="session-subject">${session.subject}</div>
              <div class="session-title">${session.title}</div>
              <div class="session-duration">${session.duration}min</div>
            </div>
          `;
        });
      }

      html += `
          </div>
        </div>
      `;
    });

    html += `</div>`;
    container.innerHTML = html;
  }

  /**
   * Show preferences modal
   */
  showPreferences() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3>Study Schedule Preferences</h3>
          <button class="btn-close" onclick="this.closest('.modal-overlay').remove()">×</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>Study Hours Per Day (Weekdays)</label>
            <input type="number" id="studyHoursPerDay" value="${this.preferences.studyHoursPerDay}" min="1" max="12">
          </div>
          <div class="form-group">
            <label>Study Hours Per Day (Weekends)</label>
            <input type="number" id="weekendHours" value="${this.preferences.weekendHours}" min="1" max="12">
          </div>
          <div class="form-group">
            <label>Session Duration (minutes)</label>
            <input type="number" id="sessionDuration" value="${this.preferences.sessionDuration}" min="15" max="120" step="15">
          </div>
          <div class="form-group">
            <label>Break Duration (minutes)</label>
            <input type="number" id="breakDuration" value="${this.preferences.breakDuration}" min="5" max="30" step="5">
          </div>
          <div class="form-group">
            <label>Preferred Start Time</label>
            <input type="time" id="preferredStartTime" value="${this.preferences.preferredStartTime}">
          </div>
          <div class="form-group">
            <label>Preferred End Time</label>
            <input type="time" id="preferredEndTime" value="${this.preferences.preferredEndTime}">
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
          <button class="btn btn-primary" onclick="studyScheduler.savePreferences()">Save & Regenerate</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  /**
   * Save preferences and regenerate schedule
   */
  savePreferences() {
    this.preferences = {
      studyHoursPerDay: parseInt(document.getElementById('studyHoursPerDay').value),
      weekendHours: parseInt(document.getElementById('weekendHours').value),
      sessionDuration: parseInt(document.getElementById('sessionDuration').value),
      breakDuration: parseInt(document.getElementById('breakDuration').value),
      preferredStartTime: document.getElementById('preferredStartTime').value,
      preferredEndTime: document.getElementById('preferredEndTime').value
    };

    localStorage.setItem('studyPreferences', JSON.stringify(this.preferences));
    document.querySelector('.modal-overlay').remove();
    this.renderSchedule();
    
    showToast('Preferences saved and schedule updated!', 'success');
  }

  /**
   * Export schedule to calendar format (iCal)
   */
  exportSchedule() {
    const schedule = this.generateSchedule();
    let ical = `BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//ITER EduHub//Study Schedule//EN\n`;

    schedule.forEach(day => {
      day.sessions.forEach(session => {
        const uid = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        ical += `BEGIN:VEVENT\n`;
        ical += `UID:${uid}\n`;
        ical += `DTSTAMP:${this.formatICalDate(new Date())}\n`;
        ical += `DTSTART:${this.formatICalDate(session.startTime)}\n`;
        ical += `DTEND:${this.formatICalDate(session.endTime)}\n`;
        ical += `SUMMARY:Study: ${session.subject}\n`;
        ical += `DESCRIPTION:${session.title}\n`;
        ical += `PRIORITY:${session.priority === 'high' ? '1' : session.priority === 'medium' ? '5' : '9'}\n`;
        ical += `END:VEVENT\n`;
      });
    });

    ical += `END:VCALENDAR`;

    // Download file
    const blob = new Blob([ical], { type: 'text/calendar' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'study-schedule.ics';
    a.click();
    URL.revokeObjectURL(url);

    showToast('Schedule exported! Import into your calendar app.', 'success');
  }

  // Utility functions
  parseTime(timeStr) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return { hours, minutes };
  }

  formatTime(date) {
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  }

  formatICalDate(date) {
    return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  }

  isToday(date) {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  }

  getUserId() {
    const token = localStorage.getItem('token');
    if (!token) return null;
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.id;
  }

  setupEventListeners() {
    // Refresh schedule when assignments change
    window.addEventListener('assignments:updated', () => {
      this.loadUpcomingTasks().then(() => this.renderSchedule());
    });
  }
}

// Initialize
const studyScheduler = new StudyScheduleGenerator();

// Auto-initialize if container exists
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('study-schedule-container')) {
      studyScheduler.init();
    }
  });
} else {
  if (document.getElementById('study-schedule-container')) {
    studyScheduler.init();
  }
}
