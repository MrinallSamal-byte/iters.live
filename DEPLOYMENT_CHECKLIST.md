# 🚀 Deployment Checklist - ITER EduHub v3.1.0

## Pre-Deployment Checklist

### ✅ Environment Setup
- [ ] Node.js 18+ installed
- [ ] MySQL 8+ running
- [ ] Git repository up to date
- [ ] Environment variables configured (.env file)
- [ ] Production database created
- [ ] Database migrations run

### ✅ File Structure
- [ ] `uploads/bulk/` directory created with proper permissions
- [ ] All new backend files present in `server/services/` and `server/routes/`
- [ ] All new frontend files present in `client/js/components/`
- [ ] CSS files present in `client/css/components/`
- [ ] Documentation files present in root directory

### ✅ Dependencies
```bash
# Verify all dependencies installed
npm install

# Check for security vulnerabilities
npm audit

# Update if needed
npm audit fix
```

### ✅ Configuration

**server/index.js:**
- [ ] Bulk routes imported and registered
- [ ] CORS settings configured
- [ ] Rate limiting configured
- [ ] Upload limits set appropriately

**Environment Variables (.env):**
```env
NODE_ENV=production
PORT=5000
DB_HOST=localhost
DB_USER=your_user
DB_PASSWORD=your_password
DB_NAME=iter_college_db
JWT_SECRET=your_jwt_secret_here
SOCKET_CORS_ORIGIN=https://yourdomain.com
CORS_WHITELIST=https://yourdomain.com
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

---

## Dashboard Integration

### ✅ Student Dashboard (`client/dashboard/student.html`)

**Add these sections:**

```html
<!-- 1. Study Schedule -->
<section class="dashboard-section">
  <div id="study-schedule-container"></div>
</section>

<!-- 2. Flashcard System -->
<section class="dashboard-section">
  <div id="flashcard-container"></div>
</section>

<!-- 3. Advanced File Manager -->
<section class="dashboard-section">
  <div id="file-manager-container"></div>
</section>

<!-- 4. Performance Analytics -->
<section class="dashboard-section">
  <div class="section-header">
    <h2>📊 Performance Analytics</h2>
  </div>
  <div id="student-analytics-container">
    <button class="btn btn-primary" onclick="loadStudentAnalytics()">
      View Detailed Analytics
    </button>
  </div>
</section>

<!-- Include CSS and Scripts at bottom -->
<link rel="stylesheet" href="/css/components/study-file-components.css">
<script src="/js/components/study-schedule-generator.js"></script>
<script src="/js/components/flashcard-system.js"></script>
<script src="/js/components/advanced-file-manager.js"></script>

<script>
async function loadStudentAnalytics() {
  const token = localStorage.getItem('token');
  const user = JSON.parse(localStorage.getItem('user'));
  
  try {
    const response = await fetch(`/api/analytics/student-performance/${user.id}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const data = await response.json();
    if (data.success) {
      renderStudentAnalytics(data.data);
    }
  } catch (error) {
    console.error('Error loading analytics:', error);
    showToast('Failed to load analytics', 'error');
  }
}

function renderStudentAnalytics(data) {
  const container = document.getElementById('student-analytics-container');
  
  let weakSubjectsHTML = '';
  if (data.weakSubjects && data.weakSubjects.length > 0) {
    weakSubjectsHTML = `
      <div class="alert alert-warning">
        <h4>⚠️ Subjects Needing Attention:</h4>
        <ul>
          ${data.weakSubjects.map(s => `
            <li><strong>${s.subject}</strong>: You're ${s.gap}% below class average</li>
          `).join('')}
        </ul>
      </div>
    `;
  }

  let strongSubjectsHTML = '';
  if (data.strongSubjects && data.strongSubjects.length > 0) {
    strongSubjectsHTML = `
      <div class="alert alert-success">
        <h4>🌟 Your Strong Subjects:</h4>
        <ul>
          ${data.strongSubjects.map(s => `
            <li><strong>${s.subject}</strong>: You're ${s.advantage}% above class average!</li>
          `).join('')}
        </ul>
      </div>
    `;
  }

  container.innerHTML = `
    <div class="analytics-dashboard">
      <div class="stats-grid">
        <div class="stat-card">
          <span class="stat-label">Overall Average</span>
          <span class="stat-value">${data.marks.averagePercentage}%</span>
        </div>
        <div class="stat-card">
          <span class="stat-label">Best Performance</span>
          <span class="stat-value">${data.marks.bestPercentage}%</span>
        </div>
        <div class="stat-card">
          <span class="stat-label">Total Exams</span>
          <span class="stat-value">${data.marks.totalExams}</span>
        </div>
        <div class="stat-card">
          <span class="stat-label">Attendance</span>
          <span class="stat-value">${parseFloat(data.attendance.attendance_percentage).toFixed(1)}%</span>
        </div>
      </div>

      ${weakSubjectsHTML}
      ${strongSubjectsHTML}

      ${data.prediction && data.prediction.trend ? `
        <div class="prediction-box">
          <h4>📈 Performance Trend</h4>
          <p>Your performance is <strong>${data.prediction.trend}</strong></p>
          <p>Predicted next score: <strong>${data.prediction.prediction}%</strong></p>
          <p class="confidence">Confidence: ${data.prediction.confidence}%</p>
        </div>
      ` : ''}

      ${data.insights && data.insights.length > 0 ? `
        <div class="insights-section">
          <h4>💡 Personalized Insights</h4>
          ${data.insights.map(insight => `
            <div class="insight-card ${insight.type}">
              ${insight.message}
            </div>
          `).join('')}
        </div>
      ` : ''}
    </div>
  `;
}
</script>
```

### ✅ Teacher Dashboard (`client/dashboard/teacher.html`)

**Add these sections:**

```html
<!-- Bulk Operations Panel -->
<section class="dashboard-section">
  <div class="section-header">
    <h2>📤 Bulk Operations</h2>
  </div>
  <div class="bulk-operations-grid">
    <div class="bulk-card">
      <h3>Bulk Attendance</h3>
      <p>Upload CSV file to mark attendance for multiple students</p>
      <button class="btn btn-primary" onclick="downloadTemplate('attendance', 'csv')">
        <i class="fas fa-download"></i> Template
      </button>
      <button class="btn btn-success" onclick="uploadBulkFile('attendance')">
        <i class="fas fa-upload"></i> Upload
      </button>
    </div>
    <div class="bulk-card">
      <h3>Bulk Marks</h3>
      <p>Upload Excel file to enter marks for multiple students</p>
      <button class="btn btn-primary" onclick="downloadTemplate('marks', 'xlsx')">
        <i class="fas fa-download"></i> Template
      </button>
      <button class="btn btn-success" onclick="uploadBulkFile('marks')">
        <i class="fas fa-upload"></i> Upload
      </button>
    </div>
  </div>
</section>

<!-- Teaching Analytics -->
<section class="dashboard-section">
  <div class="section-header">
    <h2>📊 Teaching Analytics</h2>
    <button class="btn btn-primary" onclick="loadTeacherAnalytics()">
      <i class="fas fa-sync"></i> Refresh
    </button>
  </div>
  <div id="teacher-analytics-container">
    <div class="loading-spinner">Loading...</div>
  </div>
</section>

<!-- Attendance Patterns -->
<section class="dashboard-section">
  <div class="section-header">
    <h2>🔍 Attendance Patterns</h2>
    <button class="btn btn-primary" onclick="loadAttendancePatterns()">
      <i class="fas fa-search"></i> Analyze
    </button>
  </div>
  <div id="attendance-patterns-container"></div>
</section>

<script>
// Bulk operations functions
async function downloadTemplate(type, format) {
  const token = localStorage.getItem('token');
  window.location.href = `/api/bulk/templates/${type}?format=${format}`;
  showToast(`Downloading ${type} template...`, 'info');
}

async function uploadBulkFile(type) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.csv,.xlsx,.xls';
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      showToast('Uploading...', 'info');
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/bulk/${type}/import`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      const data = await response.json();
      if (data.success) {
        showToast(`✅ Success: ${data.data.success} records imported, ${data.data.failed} failed`, 'success');
        if (data.data.errors.length > 0) {
          console.table(data.data.errors);
          alert(`${data.data.errors.length} errors occurred. Check console for details.`);
        }
      } else {
        showToast('❌ Upload failed: ' + data.message, 'error');
      }
    } catch (error) {
      console.error('Upload error:', error);
      showToast('Upload error', 'error');
    }
  };
  input.click();
}

// Analytics functions
async function loadTeacherAnalytics() {
  const token = localStorage.getItem('token');
  const user = JSON.parse(localStorage.getItem('user'));
  
  try {
    const response = await fetch(`/api/analytics/teacher/${user.id}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const data = await response.json();
    if (data.success) {
      renderTeacherAnalytics(data.data);
    }
  } catch (error) {
    console.error('Error loading analytics:', error);
    showToast('Failed to load analytics', 'error');
  }
}

function renderTeacherAnalytics(data) {
  const container = document.getElementById('teacher-analytics-container');
  container.innerHTML = `
    <div class="analytics-grid">
      <div class="stat-card">
        <span class="stat-label">Classes Taught</span>
        <span class="stat-value">${data.classesTaught.length}</span>
      </div>
      <div class="stat-card">
        <span class="stat-label">Attendance Marked</span>
        <span class="stat-value">${data.attendanceStats.total_marked}</span>
      </div>
      <div class="stat-card">
        <span class="stat-label">Marks Uploaded</span>
        <span class="stat-value">${data.marksStats.total_marks_uploaded}</span>
      </div>
      <div class="stat-card">
        <span class="stat-label">Class Average</span>
        <span class="stat-value">${parseFloat(data.marksStats.class_average).toFixed(1)}%</span>
      </div>
    </div>
    <div class="classes-table">
      <h4>Classes You Teach</h4>
      <table>
        <thead>
          <tr>
            <th>Subject</th>
            <th>Classes</th>
            <th>Students</th>
            <th>Sessions</th>
          </tr>
        </thead>
        <tbody>
          ${data.classesTaught.map(c => `
            <tr>
              <td>${c.subject}</td>
              <td>${c.class_count}</td>
              <td>${c.student_count}</td>
              <td>${c.total_sessions}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

async function loadAttendancePatterns() {
  const token = localStorage.getItem('token');
  
  try {
    showToast('Analyzing attendance patterns...', 'info');
    const response = await fetch('/api/analytics/attendance-patterns', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const data = await response.json();
    if (data.success) {
      renderAttendancePatterns(data.data);
      showToast('Analysis complete!', 'success');
    }
  } catch (error) {
    console.error('Error loading patterns:', error);
    showToast('Failed to analyze patterns', 'error');
  }
}

function renderAttendancePatterns(data) {
  const container = document.getElementById('attendance-patterns-container');
  container.innerHTML = `
    <div class="patterns-dashboard">
      <div class="pattern-section">
        <h4>⚠️ Students At Risk (Low Attendance)</h4>
        ${data.chronicAbsentees.length > 0 ? `
          <table class="data-table">
            <thead>
              <tr>
                <th>Student Name</th>
                <th>Department</th>
                <th>Year</th>
                <th>Attendance %</th>
              </tr>
            </thead>
            <tbody>
              ${data.chronicAbsentees.slice(0, 10).map(s => `
                <tr class="${parseFloat(s.attendance_percentage) < 60 ? 'danger' : 'warning'}">
                  <td>${s.full_name}</td>
                  <td>${s.department}</td>
                  <td>${s.year}</td>
                  <td><strong>${s.attendance_percentage}%</strong></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        ` : '<p>No students at risk. Great job!</p>'}
      </div>

      <div class="pattern-section">
        <h4>🌟 Perfect Attendance</h4>
        ${data.perfectAttendance.length > 0 ? `
          <p><strong>${data.perfectAttendance.length}</strong> students have perfect attendance!</p>
          <ul>
            ${data.perfectAttendance.slice(0, 5).map(s => `
              <li>${s.full_name} - ${s.total_classes} classes</li>
            `).join('')}
          </ul>
        ` : '<p>No perfect attendance yet.</p>'}
      </div>

      <div class="pattern-section">
        <h4>📊 Day-wise Attendance Trends</h4>
        <div class="chart-container">
          ${data.dayOfWeekTrends.map(d => `
            <div class="bar-chart-item">
              <div class="bar-label">${d.day_of_week}</div>
              <div class="bar-visual">
                <div class="bar-fill" style="width: ${d.attendance_rate}%"></div>
              </div>
              <div class="bar-value">${d.attendance_rate}%</div>
            </div>
          `).join('')}
        </div>
        <p class="insight">
          ${data.summary.lowestAttendanceDay ? 
            `💡 Lowest attendance on ${data.summary.lowestAttendanceDay}` : ''}
        </p>
      </div>
    </div>
  `;
}

// Load on page ready
document.addEventListener('DOMContentLoaded', () => {
  loadTeacherAnalytics();
});
</script>
```

### ✅ Admin Dashboard (`client/dashboard/admin.html`)

**Add bulk operations panel:**

```html
<section class="dashboard-section">
  <div class="section-header">
    <h2>📤 Bulk Operations</h2>
  </div>
  <div class="bulk-operations-panel">
    <div class="bulk-action-card">
      <h3>Import Users</h3>
      <p>Upload CSV or Excel to create multiple users</p>
      <button class="btn btn-primary" onclick="downloadTemplate('users', 'xlsx')">
        <i class="fas fa-download"></i> Download Template
      </button>
      <button class="btn btn-success" onclick="uploadBulkFile('users')">
        <i class="fas fa-upload"></i> Upload Users
      </button>
    </div>

    <div class="bulk-action-card">
      <h3>Export Data</h3>
      <p>Download system data in CSV or Excel format</p>
      <select id="export-type">
        <option value="users">Users</option>
        <option value="attendance">Attendance</option>
        <option value="marks">Marks</option>
      </select>
      <select id="export-format">
        <option value="csv">CSV</option>
        <option value="xlsx">Excel</option>
      </select>
      <button class="btn btn-primary" onclick="exportData()">
        <i class="fas fa-download"></i> Export
      </button>
    </div>
  </div>
</section>

<script>
async function exportData() {
  const type = document.getElementById('export-type').value;
  const format = document.getElementById('export-format').value;
  const token = localStorage.getItem('token');
  
  window.location.href = `/api/bulk/export?type=${type}&format=${format}`;
  showToast('Exporting data...', 'info');
}

// Reuse bulk operation functions from teacher dashboard
</script>
```

---

## Testing

### ✅ Manual Testing

**Test 1: Bulk Import**
```bash
# 1. Download template
curl http://localhost:5000/api/bulk/templates/users?format=csv \
  -H "Authorization: Bearer TOKEN" \
  -O users_template.csv

# 2. Fill template with test data
# 3. Upload via UI or:
curl -X POST http://localhost:5000/api/bulk/users/import \
  -H "Authorization: Bearer TOKEN" \
  -F "file=@users_template.csv"
```

**Test 2: Analytics API**
```bash
# Get student analytics
curl http://localhost:5000/api/analytics/student-performance/1 \
  -H "Authorization: Bearer TOKEN" | jq

# Get attendance patterns
curl http://localhost:5000/api/analytics/attendance-patterns \
  -H "Authorization: Bearer TOKEN" | jq
```

**Test 3: Frontend Components**
1. Login as student
2. Verify study schedule generates
3. Create flashcard deck and add cards
4. Test file manager drag-and-drop
5. View performance analytics

### ✅ Automated Testing (Future)

Create test files:
- `__tests__/bulk-operations.test.js`
- `__tests__/advanced-analytics.test.js`
- `__tests__/components.test.js`

---

## Post-Deployment

### ✅ Monitoring
- [ ] Check server logs for errors
- [ ] Monitor API response times
- [ ] Track bulk operation usage
- [ ] Monitor file upload sizes
- [ ] Check database performance

### ✅ User Training
- [ ] Create video tutorials
- [ ] Conduct training sessions
- [ ] Distribute user guides
- [ ] Set up support channels

### ✅ Feedback Collection
- [ ] Set up feedback forms
- [ ] Monitor user adoption rates
- [ ] Collect feature requests
- [ ] Track bug reports

---

## Rollback Plan

If issues occur:

1. **Stop the application**
```bash
pm2 stop iter-eduhub
```

2. **Revert to previous version**
```bash
git checkout v3.0.0
npm install
```

3. **Restore database backup**
```bash
mysql -u user -p database_name < backup.sql
```

4. **Restart application**
```bash
pm2 start ecosystem.config.js
```

---

## Success Criteria

Deployment is successful when:
- [ ] All API endpoints respond correctly
- [ ] Dashboard integrations work
- [ ] File uploads complete successfully
- [ ] Analytics data displays properly
- [ ] No console errors
- [ ] Mobile responsive works
- [ ] Performance is acceptable (<2s page load)

---

## Next Steps After Deployment

1. **Monitor for 24 hours**
2. **Collect initial feedback**
3. **Fix any critical issues**
4. **Plan next sprint features**
5. **Update documentation as needed**

---

**Ready to deploy? ✅**

**Run:** `npm start` or `pm2 start ecosystem.config.js`

**🚀 Good luck with your deployment!**
