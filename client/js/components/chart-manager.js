/**
 * Chart.js Wrapper Component
 * Provides easy-to-use methods for creating charts throughout the application
 */

class ChartManager {
  constructor() {
    this.charts = new Map();
    this.defaultColors = {
      primary: '#3b82f6',
      success: '#10b981',
      warning: '#f59e0b',
      danger: '#ef4444',
      info: '#06b6d4',
      purple: '#8b5cf6',
      pink: '#ec4899',
      gray: '#6b7280'
    };
    
    this.gradients = {
      blue: ['rgba(59, 130, 246, 0.8)', 'rgba(59, 130, 246, 0.1)'],
      green: ['rgba(16, 185, 129, 0.8)', 'rgba(16, 185, 129, 0.1)'],
      orange: ['rgba(245, 158, 11, 0.8)', 'rgba(245, 158, 11, 0.1)'],
      red: ['rgba(239, 68, 68, 0.8)', 'rgba(239, 68, 68, 0.1)'],
      purple: ['rgba(139, 92, 246, 0.8)', 'rgba(139, 92, 246, 0.1)']
    };
  }

  /**
   * Create gradient for chart backgrounds
   */
  createGradient(ctx, colors, direction = 'vertical') {
    const gradient = direction === 'vertical'
      ? ctx.createLinearGradient(0, 0, 0, 400)
      : ctx.createLinearGradient(0, 0, 400, 0);
    
    gradient.addColorStop(0, colors[0]);
    gradient.addColorStop(1, colors[1]);
    return gradient;
  }

  /**
   * Destroy a chart by ID
   */
  destroyChart(chartId) {
    if (this.charts.has(chartId)) {
      this.charts.get(chartId).destroy();
      this.charts.delete(chartId);
    }
  }

  /**
   * Create attendance heatmap calendar
   */
  createAttendanceHeatmap(canvasId, attendanceData) {
    this.destroyChart(canvasId);
    
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    
    // Transform data for matrix display
    const data = attendanceData.map(day => ({
      x: day.date,
      y: day.dayOfWeek,
      v: day.status === 'present' ? 1 : 0
    }));

    const chart = new Chart(ctx, {
      type: 'matrix',
      data: {
        datasets: [{
          label: 'Attendance',
          data: data,
          backgroundColor(context) {
            const value = context.dataset.data[context.dataIndex]?.v;
            if (value === undefined) return 'rgba(200, 200, 200, 0.2)';
            return value === 1 
              ? 'rgba(16, 185, 129, 0.8)' 
              : 'rgba(239, 68, 68, 0.8)';
          },
          borderColor: 'rgba(255, 255, 255, 0.5)',
          borderWidth: 2,
          width: ({ chart }) => (chart.chartArea || {}).width / 53 - 2,
          height: ({ chart }) => (chart.chartArea || {}).height / 7 - 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title() { return ''; },
              label(context) {
                const v = context.dataset.data[context.dataIndex];
                return `${v.x}: ${v.v === 1 ? 'Present' : 'Absent'}`;
              }
            }
          }
        },
        scales: {
          x: {
            type: 'time',
            time: { unit: 'week' },
            grid: { display: false }
          },
          y: {
            type: 'category',
            labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
            grid: { display: false }
          }
        }
      }
    });

    this.charts.set(canvasId, chart);
    return chart;
  }

  /**
   * Create performance trend line chart
   */
  createPerformanceTrend(canvasId, marksData) {
    this.destroyChart(canvasId);
    
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const gradient = this.createGradient(ctx, this.gradients.blue);

    const chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: marksData.map(d => d.examName),
        datasets: [{
          label: 'Your Marks',
          data: marksData.map(d => d.marksObtained),
          borderColor: this.defaultColors.primary,
          backgroundColor: gradient,
          borderWidth: 3,
          fill: true,
          tension: 0.4,
          pointRadius: 5,
          pointHoverRadius: 7,
          pointBackgroundColor: this.defaultColors.primary,
          pointBorderColor: '#fff',
          pointBorderWidth: 2
        }, {
          label: 'Class Average',
          data: marksData.map(d => d.classAverage),
          borderColor: this.defaultColors.gray,
          backgroundColor: 'transparent',
          borderWidth: 2,
          borderDash: [5, 5],
          fill: false,
          tension: 0.4,
          pointRadius: 4,
          pointHoverRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false
        },
        plugins: {
          legend: {
            display: true,
            position: 'top',
            labels: {
              usePointStyle: true,
              padding: 15
            }
          },
          tooltip: {
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            padding: 12,
            titleFont: { size: 14 },
            bodyFont: { size: 13 },
            callbacks: {
              label: (context) => {
                return `${context.dataset.label}: ${context.parsed.y} marks`;
              }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            max: 100,
            grid: {
              color: 'rgba(0, 0, 0, 0.05)'
            },
            ticks: {
              callback: (value) => value + '%'
            }
          },
          x: {
            grid: {
              display: false
            }
          }
        }
      }
    });

    this.charts.set(canvasId, chart);
    return chart;
  }

  /**
   * Create attendance percentage bar chart
   */
  createAttendanceBar(canvasId, subjectData) {
    this.destroyChart(canvasId);
    
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    const chart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: subjectData.map(s => s.subject),
        datasets: [{
          label: 'Attendance %',
          data: subjectData.map(s => s.percentage),
          backgroundColor: subjectData.map(s => 
            s.percentage >= 75 
              ? this.defaultColors.success
              : s.percentage >= 65
                ? this.defaultColors.warning
                : this.defaultColors.danger
          ),
          borderRadius: 8,
          borderSkipped: false
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (context) => {
                const data = subjectData[context.dataIndex];
                return [
                  `Attendance: ${data.percentage}%`,
                  `Present: ${data.present}`,
                  `Absent: ${data.absent}`,
                  `Total: ${data.total}`
                ];
              }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            max: 100,
            ticks: {
              callback: (value) => value + '%'
            },
            grid: {
              color: 'rgba(0, 0, 0, 0.05)'
            }
          },
          x: {
            grid: { display: false }
          }
        }
      }
    });

    this.charts.set(canvasId, chart);
    return chart;
  }

  /**
   * Create marks comparison radar chart
   */
  createMarksRadar(canvasId, studentMarks, classAverage) {
    this.destroyChart(canvasId);
    
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    const chart = new Chart(ctx, {
      type: 'radar',
      data: {
        labels: studentMarks.map(s => s.subject),
        datasets: [{
          label: 'Your Marks',
          data: studentMarks.map(s => s.marks),
          backgroundColor: 'rgba(59, 130, 246, 0.2)',
          borderColor: this.defaultColors.primary,
          borderWidth: 2,
          pointBackgroundColor: this.defaultColors.primary,
          pointBorderColor: '#fff',
          pointHoverRadius: 6
        }, {
          label: 'Class Average',
          data: classAverage.map(s => s.marks),
          backgroundColor: 'rgba(107, 114, 128, 0.1)',
          borderColor: this.defaultColors.gray,
          borderWidth: 2,
          borderDash: [5, 5],
          pointBackgroundColor: this.defaultColors.gray,
          pointBorderColor: '#fff',
          pointHoverRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            labels: {
              usePointStyle: true,
              padding: 15
            }
          }
        },
        scales: {
          r: {
            beginAtZero: true,
            max: 100,
            ticks: {
              stepSize: 20,
              callback: (value) => value + '%'
            },
            grid: {
              color: 'rgba(0, 0, 0, 0.1)'
            }
          }
        }
      }
    });

    this.charts.set(canvasId, chart);
    return chart;
  }

  /**
   * Create doughnut chart for grade distribution
   */
  createGradeDistribution(canvasId, gradeData) {
    this.destroyChart(canvasId);
    
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    const chart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: gradeData.map(g => g.grade),
        datasets: [{
          data: gradeData.map(g => g.count),
          backgroundColor: [
            this.defaultColors.success,
            this.defaultColors.primary,
            this.defaultColors.warning,
            this.defaultColors.danger,
            this.defaultColors.gray
          ],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right',
            labels: {
              padding: 15,
              usePointStyle: true
            }
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                const percentage = ((context.parsed / total) * 100).toFixed(1);
                return `${context.label}: ${context.parsed} (${percentage}%)`;
              }
            }
          }
        },
        cutout: '60%'
      }
    });

    this.charts.set(canvasId, chart);
    return chart;
  }

  /**
   * Create SGPA/CGPA progress bar chart
   */
  createGPAProgress(canvasId, semesterData) {
    this.destroyChart(canvasId);
    
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const gradient = this.createGradient(ctx, this.gradients.purple);

    const chart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: semesterData.map(s => `Sem ${s.semester}`),
        datasets: [{
          label: 'SGPA',
          data: semesterData.map(s => s.sgpa),
          backgroundColor: gradient,
          borderRadius: 8,
          borderSkipped: false
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (context) => {
                return `SGPA: ${context.parsed.y.toFixed(2)}`;
              },
              afterLabel: (context) => {
                const data = semesterData[context.dataIndex];
                return `Credits: ${data.credits}`;
              }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            max: 10,
            ticks: {
              stepSize: 1
            },
            grid: {
              color: 'rgba(0, 0, 0, 0.05)'
            }
          },
          x: {
            grid: { display: false }
          }
        }
      }
    });

    this.charts.set(canvasId, chart);
    return chart;
  }

  /**
   * Create assignment submission timeline
   */
  createSubmissionTimeline(canvasId, submissionData) {
    this.destroyChart(canvasId);
    
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    const chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: submissionData.map(d => d.date),
        datasets: [{
          label: 'Submissions',
          data: submissionData.map(d => d.count),
          borderColor: this.defaultColors.success,
          backgroundColor: this.createGradient(ctx, this.gradients.green),
          fill: true,
          tension: 0.4,
          borderWidth: 3,
          pointRadius: 5,
          pointBackgroundColor: this.defaultColors.success,
          pointBorderColor: '#fff',
          pointBorderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: (context) => {
                return new Date(context[0].label).toLocaleDateString();
              },
              label: (context) => {
                return `${context.parsed.y} submissions`;
              }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              stepSize: 1
            },
            grid: {
              color: 'rgba(0, 0, 0, 0.05)'
            }
          },
          x: {
            type: 'time',
            time: {
              unit: 'day'
            },
            grid: { display: false }
          }
        }
      }
    });

    this.charts.set(canvasId, chart);
    return chart;
  }

  /**
   * Create multi-dataset comparison chart
   */
  createComparisonChart(canvasId, datasets, labels, options = {}) {
    this.destroyChart(canvasId);
    
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const colors = [
      this.defaultColors.primary,
      this.defaultColors.success,
      this.defaultColors.warning,
      this.defaultColors.purple,
      this.defaultColors.pink
    ];

    const chartDatasets = datasets.map((dataset, index) => ({
      label: dataset.label,
      data: dataset.data,
      borderColor: colors[index % colors.length],
      backgroundColor: colors[index % colors.length] + '20',
      borderWidth: 2,
      tension: 0.4,
      fill: options.fill !== false
    }));

    const chart = new Chart(ctx, {
      type: options.type || 'line',
      data: {
        labels,
        datasets: chartDatasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            position: 'top'
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: {
              color: 'rgba(0, 0, 0, 0.05)'
            }
          },
          x: {
            grid: { display: false }
          }
        },
        ...options.chartOptions
      }
    });

    this.charts.set(canvasId, chart);
    return chart;
  }

  /**
   * Update chart data
   */
  updateChart(chartId, newData) {
    const chart = this.charts.get(chartId);
    if (!chart) return;

    chart.data = newData;
    chart.update('active');
  }

  /**
   * Destroy all charts
   */
  destroyAll() {
    this.charts.forEach(chart => chart.destroy());
    this.charts.clear();
  }
}

// Export singleton instance
const chartManager = new ChartManager();
export default chartManager;
