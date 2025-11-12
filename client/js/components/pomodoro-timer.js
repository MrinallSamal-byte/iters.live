/**
 * Pomodoro Timer Component
 * Focus timer with 25/5 minute intervals and statistics tracking
 */

class PomodoroTimer {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      throw new Error(`Container ${containerId} not found`);
    }

    this.options = {
      workDuration: 25 * 60, // 25 minutes
      shortBreak: 5 * 60,    // 5 minutes
      longBreak: 15 * 60,    // 15 minutes
      longBreakInterval: 4,   // After 4 work sessions
      autoStartBreaks: false,
      autoStartWork: false,
      soundEnabled: true,
      notificationsEnabled: true,
      ...options
    };

    this.state = {
      mode: 'work', // work, shortBreak, longBreak
      timeLeft: this.options.workDuration,
      isRunning: false,
      sessionsCompleted: 0,
      totalWorkTime: 0,
      currentTask: ''
    };

    this.timer = null;
    this.init();
  }

  /**
   * Initialize timer
   */
  init() {
    this.render();
    this.loadState();
    this.requestNotificationPermission();
  }

  /**
   * Render timer UI
   */
  render() {
    this.container.innerHTML = `
      <div class="pomodoro-timer">
        <div class="pomodoro-header">
          <h2><i class="fas fa-brain"></i> Focus Timer</h2>
          <button class="btn-icon settings-btn" id="settings-btn" title="Settings">
            <i class="fas fa-cog"></i>
          </button>
        </div>

        <div class="pomodoro-stats">
          <div class="stat-card">
            <i class="fas fa-check-circle"></i>
            <div class="stat-value" id="sessions-count">0</div>
            <div class="stat-label">Sessions</div>
          </div>
          <div class="stat-card">
            <i class="fas fa-clock"></i>
            <div class="stat-value" id="total-time">0h 0m</div>
            <div class="stat-label">Total Time</div>
          </div>
        </div>

        <div class="timer-display">
          <div class="mode-indicator" id="mode-indicator">
            <span class="mode-badge">FOCUS TIME</span>
          </div>
          
          <div class="timer-circle">
            <svg class="progress-ring" width="300" height="300">
              <circle class="progress-ring-background" 
                      cx="150" cy="150" r="135" 
                      stroke-width="10" 
                      fill="none"></circle>
              <circle class="progress-ring-circle" 
                      id="progress-circle"
                      cx="150" cy="150" r="135" 
                      stroke-width="10" 
                      fill="none"
                      stroke-dasharray="848"
                      stroke-dashoffset="0"></circle>
            </svg>
            <div class="timer-text">
              <div class="time-display" id="time-display">25:00</div>
              <div class="current-task" id="current-task-display">Ready to focus?</div>
            </div>
          </div>

          <div class="timer-controls">
            <button class="btn-timer btn-start" id="start-btn">
              <i class="fas fa-play"></i>
              <span>Start</span>
            </button>
            <button class="btn-timer btn-pause" id="pause-btn" style="display: none;">
              <i class="fas fa-pause"></i>
              <span>Pause</span>
            </button>
            <button class="btn-timer btn-reset" id="reset-btn">
              <i class="fas fa-redo"></i>
              <span>Reset</span>
            </button>
            <button class="btn-timer btn-skip" id="skip-btn">
              <i class="fas fa-forward"></i>
              <span>Skip</span>
            </button>
          </div>

          <div class="task-input">
            <input type="text" 
                   id="task-input" 
                   placeholder="What are you working on?" 
                   value="${this.state.currentTask}"
                   maxlength="50">
          </div>
        </div>

        <div class="pomodoro-sessions">
          <h3>Session History</h3>
          <div id="sessions-list" class="sessions-list"></div>
        </div>
      </div>

      <!-- Settings Modal -->
      <div class="pomodoro-settings-modal" id="settings-modal" style="display: none;">
        <div class="settings-content">
          <div class="settings-header">
            <h3><i class="fas fa-cog"></i> Timer Settings</h3>
            <button class="btn-icon" id="close-settings-btn">
              <i class="fas fa-times"></i>
            </button>
          </div>
          <div class="settings-body">
            <div class="setting-group">
              <label>Work Duration (minutes)</label>
              <input type="number" id="work-duration" value="25" min="1" max="60">
            </div>
            <div class="setting-group">
              <label>Short Break (minutes)</label>
              <input type="number" id="short-break" value="5" min="1" max="30">
            </div>
            <div class="setting-group">
              <label>Long Break (minutes)</label>
              <input type="number" id="long-break" value="15" min="1" max="60">
            </div>
            <div class="setting-group">
              <label>Long Break After (sessions)</label>
              <input type="number" id="long-break-interval" value="4" min="1" max="10">
            </div>
            <div class="setting-group">
              <label>
                <input type="checkbox" id="auto-start-breaks" ${this.options.autoStartBreaks ? 'checked' : ''}>
                Auto-start breaks
              </label>
            </div>
            <div class="setting-group">
              <label>
                <input type="checkbox" id="auto-start-work" ${this.options.autoStartWork ? 'checked' : ''}>
                Auto-start work sessions
              </label>
            </div>
            <div class="setting-group">
              <label>
                <input type="checkbox" id="sound-enabled" ${this.options.soundEnabled ? 'checked' : ''}>
                Sound notifications
              </label>
            </div>
          </div>
          <div class="settings-footer">
            <button class="btn btn-primary" id="save-settings-btn">Save Settings</button>
          </div>
        </div>
      </div>
    `;

    this.attachEventListeners();
    this.updateDisplay();
    this.loadSessionHistory();
  }

  /**
   * Attach event listeners
   */
  attachEventListeners() {
    // Timer controls
    document.getElementById('start-btn')?.addEventListener('click', () => this.start());
    document.getElementById('pause-btn')?.addEventListener('click', () => this.pause());
    document.getElementById('reset-btn')?.addEventListener('click', () => this.reset());
    document.getElementById('skip-btn')?.addEventListener('click', () => this.skip());

    // Task input
    document.getElementById('task-input')?.addEventListener('change', (e) => {
      this.state.currentTask = e.target.value;
      this.saveState();
    });

    // Settings
    document.getElementById('settings-btn')?.addEventListener('click', () => {
      document.getElementById('settings-modal').style.display = 'flex';
    });

    document.getElementById('close-settings-btn')?.addEventListener('click', () => {
      document.getElementById('settings-modal').style.display = 'none';
    });

    document.getElementById('save-settings-btn')?.addEventListener('click', () => {
      this.saveSettings();
    });

    // Click outside modal to close
    document.getElementById('settings-modal')?.addEventListener('click', (e) => {
      if (e.target.id === 'settings-modal') {
        e.target.style.display = 'none';
      }
    });
  }

  /**
   * Start timer
   */
  start() {
    if (this.state.isRunning) return;

    this.state.isRunning = true;
    document.getElementById('start-btn').style.display = 'none';
    document.getElementById('pause-btn').style.display = 'flex';

    this.timer = setInterval(() => {
      this.state.timeLeft--;

      if (this.state.timeLeft <= 0) {
        this.complete();
      }

      this.updateDisplay();
      this.saveState();
    }, 1000);
  }

  /**
   * Pause timer
   */
  pause() {
    if (!this.state.isRunning) return;

    this.state.isRunning = false;
    clearInterval(this.timer);
    
    document.getElementById('start-btn').style.display = 'flex';
    document.getElementById('pause-btn').style.display = 'none';

    this.saveState();
  }

  /**
   * Reset timer
   */
  reset() {
    this.pause();
    this.state.timeLeft = this.getDuration();
    this.updateDisplay();
    this.saveState();
  }

  /**
   * Skip to next mode
   */
  skip() {
    this.pause();
    this.switchMode();
  }

  /**
   * Complete current session
   */
  complete() {
    this.pause();

    // Track work session
    if (this.state.mode === 'work') {
      this.state.sessionsCompleted++;
      this.state.totalWorkTime += this.options.workDuration;
      this.saveSession();
    }

    // Play sound
    if (this.options.soundEnabled) {
      this.playSound();
    }

    // Show notification
    if (this.options.notificationsEnabled) {
      this.showNotification();
    }

    // Switch mode
    this.switchMode();

    // Auto-start if enabled
    const shouldAutoStart = 
      (this.state.mode !== 'work' && this.options.autoStartBreaks) ||
      (this.state.mode === 'work' && this.options.autoStartWork);

    if (shouldAutoStart) {
      setTimeout(() => this.start(), 1000);
    }
  }

  /**
   * Switch between work/break modes
   */
  switchMode() {
    if (this.state.mode === 'work') {
      // Determine break type
      if (this.state.sessionsCompleted % this.options.longBreakInterval === 0) {
        this.state.mode = 'longBreak';
      } else {
        this.state.mode = 'shortBreak';
      }
    } else {
      this.state.mode = 'work';
    }

    this.state.timeLeft = this.getDuration();
    this.updateDisplay();
    this.saveState();
  }

  /**
   * Get duration for current mode
   */
  getDuration() {
    switch (this.state.mode) {
      case 'work': return this.options.workDuration;
      case 'shortBreak': return this.options.shortBreak;
      case 'longBreak': return this.options.longBreak;
      default: return this.options.workDuration;
    }
  }

  /**
   * Update display
   */
  updateDisplay() {
    // Update time display
    const minutes = Math.floor(this.state.timeLeft / 60);
    const seconds = this.state.timeLeft % 60;
    const timeStr = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    document.getElementById('time-display').textContent = timeStr;

    // Update document title
    document.title = `${timeStr} - ${this.getModeLabel()} | Focus Timer`;

    // Update mode indicator
    const modeIndicator = document.getElementById('mode-indicator');
    const modeBadge = modeIndicator.querySelector('.mode-badge');
    modeBadge.textContent = this.getModeLabel().toUpperCase();
    modeBadge.className = `mode-badge mode-${this.state.mode}`;

    // Update progress circle
    const totalDuration = this.getDuration();
    const progress = (this.state.timeLeft / totalDuration);
    const circumference = 2 * Math.PI * 135;
    const offset = circumference * (1 - progress);
    document.getElementById('progress-circle').style.strokeDashoffset = offset;

    // Update stats
    document.getElementById('sessions-count').textContent = this.state.sessionsCompleted;
    const hours = Math.floor(this.state.totalWorkTime / 3600);
    const mins = Math.floor((this.state.totalWorkTime % 3600) / 60);
    document.getElementById('total-time').textContent = `${hours}h ${mins}m`;

    // Update task display
    const taskDisplay = document.getElementById('current-task-display');
    taskDisplay.textContent = this.state.currentTask || 
      (this.state.mode === 'work' ? 'Ready to focus?' : 'Take a break!');
  }

  /**
   * Get mode label
   */
  getModeLabel() {
    switch (this.state.mode) {
      case 'work': return 'Focus Time';
      case 'shortBreak': return 'Short Break';
      case 'longBreak': return 'Long Break';
      default: return 'Focus Time';
    }
  }

  /**
   * Save session to history
   */
  saveSession() {
    const sessions = this.getSessions();
    sessions.unshift({
      id: Date.now(),
      task: this.state.currentTask || 'Untitled Session',
      duration: this.options.workDuration / 60,
      completedAt: new Date().toISOString()
    });

    // Keep last 50 sessions
    if (sessions.length > 50) {
      sessions.pop();
    }

    localStorage.setItem('pomodoro-sessions', JSON.stringify(sessions));
    this.loadSessionHistory();
  }

  /**
   * Get session history
   */
  getSessions() {
    try {
      return JSON.parse(localStorage.getItem('pomodoro-sessions')) || [];
    } catch {
      return [];
    }
  }

  /**
   * Load and display session history
   */
  loadSessionHistory() {
    const sessions = this.getSessions();
    const container = document.getElementById('sessions-list');

    if (sessions.length === 0) {
      container.innerHTML = '<p class="no-sessions">No sessions yet. Start focusing!</p>';
      return;
    }

    container.innerHTML = sessions.slice(0, 10).map(session => `
      <div class="session-item">
        <div class="session-info">
          <div class="session-task">${session.task}</div>
          <div class="session-meta">
            <span><i class="fas fa-clock"></i> ${session.duration} min</span>
            <span><i class="fas fa-calendar"></i> ${this.formatDate(session.completedAt)}</span>
          </div>
        </div>
        <div class="session-check">
          <i class="fas fa-check-circle"></i>
        </div>
      </div>
    `).join('');
  }

  /**
   * Format date
   */
  formatDate(isoString) {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return date.toLocaleDateString();
  }

  /**
   * Play completion sound
   */
  playSound() {
    const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBjGB0fPTgjMGHm7A7+OZSA0PVq3o75tUEQxKouzwtGUdBjaP1vLNeisFI3fG8N+PRw0RXLPJ7qhWFQpFn+DyvmwhBjGB0fPTgjMGHm7A7+OZSA0PVq3o75tUEQxKouzwtGUdBjaP1vLNeisFI3fG8N+PRw0RXLPJ7qhWFQpFn+DyvmwhBjGB0fPTgjMGHm7A7+OZSA0PVq3o75tUEQxKouzwtGUdBjaP1vLNeisFI3fG8N+PRw0RXLPJ7qhWFQpFn+DyvmwhBjGB0fPTgjMGHm7A7+OZSA0PVq3o75tUEQxKouzwtGUdBjaP1vLNeisFI3fG8N+PRw0RXLPJ7qhWFQpFn+DyvmwhBjGB0fPTgjMGHm7A7+OZSA0PVq3o75tUEQxKouzwtGUdBjaP1vLNeisFI3fG8N+PRw0RXLPJ7qhWFQ==');
    audio.play().catch(() => {});
  }

  /**
   * Show notification
   */
  showNotification() {
    if (!('Notification' in window)) return;

    const title = this.state.mode === 'work' ? 'Break time!' : 'Back to work!';
    const body = this.state.mode === 'work' 
      ? 'Great job! Time for a break.' 
      : 'Break is over. Ready to focus?';

    new Notification(title, {
      body,
      icon: '/favicon.ico',
      badge: '/favicon.ico'
    });
  }

  /**
   * Request notification permission
   */
  requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }

  /**
   * Save settings
   */
  saveSettings() {
    this.options.workDuration = parseInt(document.getElementById('work-duration').value) * 60;
    this.options.shortBreak = parseInt(document.getElementById('short-break').value) * 60;
    this.options.longBreak = parseInt(document.getElementById('long-break').value) * 60;
    this.options.longBreakInterval = parseInt(document.getElementById('long-break-interval').value);
    this.options.autoStartBreaks = document.getElementById('auto-start-breaks').checked;
    this.options.autoStartWork = document.getElementById('auto-start-work').checked;
    this.options.soundEnabled = document.getElementById('sound-enabled').checked;

    localStorage.setItem('pomodoro-settings', JSON.stringify(this.options));
    
    this.reset();
    document.getElementById('settings-modal').style.display = 'none';
    
    if (window.showToast) {
      window.showToast('Settings saved!', 'success');
    }
  }

  /**
   * Save state
   */
  saveState() {
    localStorage.setItem('pomodoro-state', JSON.stringify(this.state));
  }

  /**
   * Load state
   */
  loadState() {
    try {
      const saved = localStorage.getItem('pomodoro-state');
      if (saved) {
        const state = JSON.parse(saved);
        this.state = { ...this.state, ...state, isRunning: false };
        this.updateDisplay();
      }

      const settings = localStorage.getItem('pomodoro-settings');
      if (settings) {
        this.options = { ...this.options, ...JSON.parse(settings) };
      }
    } catch (error) {
      console.error('Load state error:', error);
    }
  }
}

// Export
window.PomodoroTimer = PomodoroTimer;
export default PomodoroTimer;
