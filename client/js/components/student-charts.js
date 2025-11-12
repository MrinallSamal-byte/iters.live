/**
 * Student Dashboard Charts Integration
 * Loads and displays all performance visualizations
 */

import chartManager from './chart-manager.js';

class StudentDashboardCharts {
  constructor() {
    this.isInitialized = false;
  }

  /**
   * Initialize all dashboard charts
   */
  async init() {
    if (this.isInitialized) return;

    try {
      // Create chart containers if they don't exist
      this.createChartContainers();

      // Load data and create charts
      await Promise.all([
        this.loadAttendanceCharts(),
        this.loadPerformanceCharts(),
        this.loadAssignmentCharts()
      ]);

      this.isInitialized = true;
      console.log('✓ Student dashboard charts initialized');
    } catch (error) {
      console.error('Failed to initialize charts:', error);
      this.showError('Failed to load charts. Please refresh the page.');
    }
  }

  /**
   * Create chart container elements
   */
  createChartContainers() {
    const dashboardContent = document.querySelector('.dashboard-content');
    if (!dashboardContent) return;

    const chartsHTML = `
      <div class="charts-section">
        <!-- Performance Overview -->
        <div class="chart-row">
          <div class="chart-card">
            <div class="chart-header">
              <h3>📊 Performance Trend</h3>
              <div class="chart-filters">
                <select id="performance-filter" class="chart-filter">
                  <option value="semester">This Semester</option>
                  <option value="year">This Year</option>
                  <option value="all">All Time</option>
                </select>
              </div>
            </div>
            <div class="chart-container">
              <canvas id="performance-trend-chart"></canvas>
            </div>
          </div>

          <div class="chart-card">
            <div class="chart-header">
              <h3>🎯 Marks Comparison</h3>
              <p class="chart-subtitle">You vs Class Average</p>
            </div>
            <div class="chart-container">
              <canvas id="marks-radar-chart"></canvas>
            </div>
          </div>
        </div>

        <!-- Attendance Overview -->
        <div class="chart-row">
          <div class="chart-card full-width">
            <div class="chart-header">
              <h3>📅 Attendance Heatmap</h3>
              <p class="chart-subtitle">Last 12 weeks</p>
            </div>
            <div class="chart-container chart-container-large">
              <canvas id="attendance-heatmap-chart"></canvas>
            </div>
          </div>
        </div>

        <!-- Subject-wise Attendance -->
        <div class="chart-row">
          <div class="chart-card">
            <div class="chart-header">
              <h3>📚 Subject-wise Attendance</h3>
              <div class="attendance-legend">
                <span class="legend-item safe">≥75% Safe</span>
                <span class="legend-item warning">65-74% Warning</span>
                <span class="legend-item danger"><75% Critical</span>
              </div>
            </div>
            <div class="chart-container">
              <canvas id="attendance-bar-chart"></canvas>
            </div>
          </div>

          <div class="chart-card">
            <div class="chart-header">
              <h3>📈 SGPA Progress</h3>
              <div class="gpa-info">
                <span class="current-cgpa">CGPA: <strong id="current-cgpa">0.00</strong></span>
              </div>
            </div>
            <div class="chart-container">
              <canvas id="gpa-progress-chart"></canvas>
            </div>
          </div>
        </div>

        <!-- Grade Distribution -->
        <div class="chart-row">
          <div class="chart-card">
            <div class="chart-header">
              <h3>🏆 Grade Distribution</h3>
              <p class="chart-subtitle">Your performance breakdown</p>
            </div>
            <div class="chart-container">
              <canvas id="grade-distribution-chart"></canvas>
            </div>
          </div>

          <div class="chart-card">
            <div class="chart-header">
              <h3>📝 Assignment Submissions</h3>
              <p class="chart-subtitle">Last 30 days</p>
            </div>
            <div class="chart-container">
              <canvas id="submission-timeline-chart"></canvas>
            </div>
          </div>
        </div>
      </div>
    `;

    // Insert charts section
    const existingCharts = dashboardContent.querySelector('.charts-section');
    if (!existingCharts) {
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = chartsHTML;
      dashboardContent.insertBefore(tempDiv.firstElementChild, dashboardContent.firstChild);
    }
  }

  /**
   * Load attendance-related charts
   */
  async loadAttendanceCharts() {
    try {
      // Fetch attendance data
      const response = await fetch('/api/attendance/summary', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) throw new Error('Failed to fetch attendance data');

      const data = await response.json();

      // Create attendance heatmap
      if (data.heatmapData) {
        chartManager.createAttendanceHeatmap('attendance-heatmap-chart', data.heatmapData);
      }

      // Create subject-wise attendance bar chart
      if (data.subjectWise) {
        chartManager.createAttendanceBar('attendance-bar-chart', data.subjectWise);
      }

    } catch (error) {
      console.error('Failed to load attendance charts:', error);
    }
  }

  /**
   * Load performance-related charts
   */
  async loadPerformanceCharts() {
    try {
      // Fetch marks data
      const response = await fetch('/api/marks/summary', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) throw new Error('Failed to fetch marks data');

      const data = await response.json();

      // Create performance trend chart
      if (data.trendData) {
        chartManager.createPerformanceTrend('performance-trend-chart', data.trendData);
      }

      // Create marks radar comparison
      if (data.subjectMarks && data.classAverage) {
        chartManager.createMarksRadar(
          'marks-radar-chart',
          data.subjectMarks,
          data.classAverage
        );
      }

      // Create grade distribution
      if (data.gradeDistribution) {
        chartManager.createGradeDistribution('grade-distribution-chart', data.gradeDistribution);
      }

      // Create SGPA progress chart
      if (data.semesterData) {
        chartManager.createGPAProgress('gpa-progress-chart', data.semesterData);
        
        // Update CGPA display
        if (data.cgpa) {
          const cgpaElement = document.getElementById('current-cgpa');
          if (cgpaElement) {
            cgpaElement.textContent = data.cgpa.toFixed(2);
          }
        }
      }

    } catch (error) {
      console.error('Failed to load performance charts:', error);
    }
  }

  /**
   * Load assignment-related charts
   */
  async loadAssignmentCharts() {
    try {
      // Fetch assignment data
      const response = await fetch('/api/assignments/statistics', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) throw new Error('Failed to fetch assignment data');

      const data = await response.json();

      // Create submission timeline
      if (data.submissionTimeline) {
        chartManager.createSubmissionTimeline('submission-timeline-chart', data.submissionTimeline);
      }

    } catch (error) {
      console.error('Failed to load assignment charts:', error);
    }
  }

  /**
   * Update charts with new filters
   */
  async updateCharts(filter) {
    try {
      const response = await fetch(`/api/marks/summary?filter=${filter}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) throw new Error('Failed to fetch filtered data');

      const data = await response.json();

      if (data.trendData) {
        chartManager.updateChart('performance-trend-chart', {
          labels: data.trendData.map(d => d.examName),
          datasets: [
            {
              label: 'Your Marks',
              data: data.trendData.map(d => d.marksObtained)
            },
            {
              label: 'Class Average',
              data: data.trendData.map(d => d.classAverage)
            }
          ]
        });
      }
    } catch (error) {
      console.error('Failed to update charts:', error);
    }
  }

  /**
   * Show error message
   */
  showError(message) {
    const errorHTML = `
      <div class="chart-error">
        <i class="fas fa-exclamation-triangle"></i>
        <p>${message}</p>
      </div>
    `;

    const chartsSection = document.querySelector('.charts-section');
    if (chartsSection) {
      chartsSection.innerHTML = errorHTML;
    }
  }

  /**
   * Refresh all charts
   */
  async refresh() {
    chartManager.destroyAll();
    this.isInitialized = false;
    await this.init();
  }
}

// Initialize on page load
const studentCharts = new StudentDashboardCharts();

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => studentCharts.init());
} else {
  studentCharts.init();
}

// Listen for filter changes
document.addEventListener('change', (e) => {
  if (e.target.id === 'performance-filter') {
    studentCharts.updateCharts(e.target.value);
  }
});

export default studentCharts;
