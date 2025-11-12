/**
 * Advanced Analytics Controller
 * Provides comprehensive data visualization and insights
 * Part of ITER EduHub Enhancement Suite
 */
class AdvancedAnalytics {
    constructor(containerId) {
        this.containerId = containerId || 'analyticsContainer';
        this.charts = {};
        this.colors = {
            primary: 'rgb(99, 102, 241)',
            secondary: 'rgb(139, 92, 246)',
            success: 'rgb(16, 185, 129)',
            warning: 'rgb(245, 158, 11)',
            danger: 'rgb(239, 68, 68)'
        };
        this.init();
    }

    init() {
        try {
            this.createPerformanceTrendChart();
        } catch (e) {
            console.error('Performance trend chart failed:', e);
        }
        try {
            this.createAttendanceHeatmap();
        } catch (e) {
            console.error('Attendance heatmap failed:', e);
        }
        try {
            this.createSubjectComparisonRadar();
        } catch (e) {
            console.error('Subject comparison radar failed:', e);
        }
        try {
            this.createGradeDistribution();
        } catch (e) {
            console.error('Grade distribution failed:', e);
        }
        try {
            this.createMonthlyProgressChart();
        } catch (e) {
            console.error('Monthly progress chart failed:', e);
        }
        try {
            this.setupRealTimeUpdates();
        } catch (e) {
            console.error('Real-time updates failed:', e);
        }
    }

    /**
     * Performance trend over time (Line Chart)
     */
    async createPerformanceTrendChart() {
        const ctx = document.getElementById('performanceTrendChart');
        if (!ctx) return;

        const data = await this.fetchPerformanceData();
        
        this.charts.performanceTrend = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.labels,
                datasets: [{
                    label: 'Your Performance',
                    data: data.studentMarks,
                    borderColor: this.colors.primary,
                    backgroundColor: this.createGradient(ctx, this.colors.primary),
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 6,
                    pointHoverRadius: 8,
                    pointBackgroundColor: this.colors.primary,
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    pointHoverBackgroundColor: '#fff',
                    pointHoverBorderColor: this.colors.primary
                }, {
                    label: 'Class Average',
                    data: data.classAverage,
                    borderColor: this.colors.secondary,
                    backgroundColor: this.createGradient(ctx, this.colors.secondary),
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4,
                    borderDash: [5, 5],
                    pointRadius: 4,
                    pointBackgroundColor: this.colors.secondary,
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2
                }, {
                    label: 'Target',
                    data: data.target,
                    borderColor: this.colors.success,
                    borderWidth: 2,
                    borderDash: [10, 5],
                    fill: false,
                    pointRadius: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            color: '#fff',
                            font: { size: 14, weight: '600' },
                            usePointStyle: true,
                            padding: 20
                        }
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        backgroundColor: 'rgba(0, 0, 0, 0.9)',
                        titleColor: '#fff',
                        bodyColor: '#fff',
                        borderColor: this.colors.primary,
                        borderWidth: 1,
                        padding: 12,
                        displayColors: true,
                        callbacks: {
                            label: (context) => {
                                return `${context.dataset.label}: ${context.parsed.y}%`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)',
                            drawBorder: false
                        },
                        ticks: {
                            color: '#fff',
                            font: { size: 12 },
                            callback: value => value + '%'
                        }
                    },
                    x: {
                        grid: {
                            color: 'rgba(255, 255, 255, 0.05)',
                            drawBorder: false
                        },
                        ticks: {
                            color: '#fff',
                            font: { size: 12 }
                        }
                    }
                },
                interaction: {
                    mode: 'nearest',
                    axis: 'x',
                    intersect: false
                },
                animations: {
                    tension: {
                        duration: 1000,
                        easing: 'easeInOutCubic',
                        from: 0,
                        to: 0.4
                    }
                }
            }
        });
    }

    /**
     * Attendance heatmap (Calendar view)
     */
    async createAttendanceHeatmap() {
        const container = document.getElementById('attendanceHeatmap');
        if (!container) return;

        const data = await this.fetchAttendanceData();
        const heatmap = this.generateHeatmapHTML(data);
        
        container.innerHTML = heatmap;
        this.addHeatmapInteractivity();
    }

    generateHeatmapHTML(data) {
        const weeks = this.getLast12Weeks();
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        
        let html = '<div class="heatmap-container">';
        
        // Legend
        html += '<div class="heatmap-legend">';
        html += '<span class="legend-label">Less</span>';
        html += '<div class="legend-scale">';
        for (let i = 0; i <= 4; i++) {
            html += `<span class="legend-box" data-level="${i}"></span>`;
        }
        html += '</div>';
        html += '<span class="legend-label">More</span>';
        html += '</div>';
        
        // Month labels
        html += '<div class="heatmap-months">';
        months.forEach(month => {
            html += `<span class="month-label">${month}</span>`;
        });
        html += '</div>';
        
        // Calendar grid
        html += '<div class="heatmap-grid">';
        weeks.forEach(week => {
            html += '<div class="heatmap-week">';
            week.forEach(day => {
                const level = this.getAttendanceLevel(day, data);
                const tooltip = this.getAttendanceTooltip(day, data);
                html += `<div class="heatmap-day" data-level="${level}" data-date="${day}" title="${tooltip}"></div>`;
            });
            html += '</div>';
        });
        html += '</div>';
        html += '</div>';
        
        return html;
    }

    getLast12Weeks() {
        const weeks = [];
        const today = new Date();
        
        for (let w = 11; w >= 0; w--) {
            const week = [];
            for (let d = 0; d < 7; d++) {
                const date = new Date(today);
                date.setDate(date.getDate() - (w * 7 + (6 - d)));
                week.push(date.toISOString().split('T')[0]);
            }
            weeks.push(week);
        }
        
        return weeks;
    }

    getAttendanceLevel(date, data) {
        const dayData = data.find(d => d.date === date);
        if (!dayData || dayData.total === 0) return 0;
        
        const percentage = (dayData.present / dayData.total) * 100;
        if (percentage >= 90) return 4;
        if (percentage >= 75) return 3;
        if (percentage >= 60) return 2;
        if (percentage >= 40) return 1;
        return 0;
    }

    getAttendanceTooltip(date, data) {
        const dayData = data.find(d => d.date === date);
        if (!dayData || dayData.total === 0) {
            return `${date}: No classes`;
        }
        const percentage = ((dayData.present / dayData.total) * 100).toFixed(0);
        return `${date}: ${dayData.present}/${dayData.total} classes (${percentage}%)`;
    }

    addHeatmapInteractivity() {
        document.querySelectorAll('.heatmap-day').forEach(day => {
            day.addEventListener('mouseenter', (e) => {
                day.style.transform = 'scale(1.3)';
                day.style.zIndex = '10';
            });
            
            day.addEventListener('mouseleave', (e) => {
                day.style.transform = 'scale(1)';
                day.style.zIndex = '1';
            });
        });
    }

    /**
     * Subject comparison radar chart
     */
    async createSubjectComparisonRadar() {
        const ctx = document.getElementById('subjectRadarChart');
        if (!ctx) return;

        const data = await this.fetchSubjectComparison();
        
        this.charts.subjectRadar = new Chart(ctx, {
            type: 'radar',
            data: {
                labels: data.subjects,
                datasets: [{
                    label: 'Your Performance',
                    data: data.studentScores,
                    backgroundColor: 'rgba(99, 102, 241, 0.2)',
                    borderColor: this.colors.primary,
                    borderWidth: 3,
                    pointBackgroundColor: this.colors.primary,
                    pointBorderColor: '#fff',
                    pointHoverBackgroundColor: '#fff',
                    pointHoverBorderColor: this.colors.primary,
                    pointRadius: 6,
                    pointHoverRadius: 8
                }, {
                    label: 'Class Average',
                    data: data.classAverage,
                    backgroundColor: 'rgba(139, 92, 246, 0.2)',
                    borderColor: this.colors.secondary,
                    borderWidth: 2,
                    pointBackgroundColor: this.colors.secondary,
                    pointBorderColor: '#fff',
                    pointRadius: 4,
                    pointHoverRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    r: {
                        beginAtZero: true,
                        max: 100,
                        ticks: {
                            stepSize: 20,
                            color: '#fff',
                            backdropColor: 'transparent',
                            font: { size: 11 }
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        },
                        pointLabels: {
                            color: '#fff',
                            font: { size: 13, weight: '600' }
                        }
                    }
                },
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            color: '#fff',
                            font: { size: 14, weight: '600' },
                            padding: 15,
                            usePointStyle: true
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                return `${context.dataset.label}: ${context.parsed.r}%`;
                            }
                        }
                    }
                }
            }
        });
    }

    /**
     * Grade distribution (Bar Chart)
     */
    async createGradeDistribution() {
        const ctx = document.getElementById('gradeDistributionChart');
        if (!ctx) return;

        const data = await this.fetchGradeDistribution();
        
        this.charts.gradeDistribution = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: data.grades,
                datasets: [{
                    label: 'Number of Students',
                    data: data.counts,
                    backgroundColor: [
                        'rgba(16, 185, 129, 0.8)',
                        'rgba(59, 130, 246, 0.8)',
                        'rgba(245, 158, 11, 0.8)',
                        'rgba(239, 68, 68, 0.8)',
                        'rgba(107, 114, 128, 0.8)'
                    ],
                    borderColor: [
                        'rgb(16, 185, 129)',
                        'rgb(59, 130, 246)',
                        'rgb(245, 158, 11)',
                        'rgb(239, 68, 68)',
                        'rgb(107, 114, 128)'
                    ],
                    borderWidth: 2,
                    borderRadius: 8,
                    borderSkipped: false
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = ((context.parsed.y / total) * 100).toFixed(1);
                                return `${context.parsed.y} students (${percentage}%)`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        },
                        ticks: {
                            color: '#fff',
                            font: { size: 12 },
                            stepSize: 5
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            color: '#fff',
                            font: { size: 13, weight: '600' }
                        }
                    }
                }
            }
        });
    }

    /**
     * Monthly progress (Doughnut Chart)
     */
    async createMonthlyProgressChart() {
        const ctx = document.getElementById('monthlyProgressChart');
        if (!ctx) return;

        const data = await this.fetchMonthlyProgress();
        
        this.charts.monthlyProgress = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: data.labels,
                datasets: [{
                    data: data.values,
                    backgroundColor: [
                        'rgba(99, 102, 241, 0.8)',
                        'rgba(139, 92, 246, 0.8)',
                        'rgba(236, 72, 153, 0.8)',
                        'rgba(251, 146, 60, 0.8)'
                    ],
                    borderColor: '#0f172a',
                    borderWidth: 3
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: '#fff',
                            font: { size: 13 },
                            padding: 15,
                            usePointStyle: true
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = ((context.parsed / total) * 100).toFixed(1);
                                return `${context.label}: ${percentage}%`;
                            }
                        }
                    }
                },
                cutout: '70%'
            }
        });
    }

    /**
     * Real-time data updates via Socket.IO
     */
    setupRealTimeUpdates() {
        if (typeof io === 'undefined') return;
        
        const socket = io(window.API_BASE_URL || 'http://localhost:5000');
        
        socket.on('marks_updated', (data) => {
            this.updatePerformanceChart(data);
            this.showUpdateToast('Marks updated!', 'success');
        });
        
        socket.on('attendance_marked', (data) => {
            this.updateAttendanceHeatmap(data);
            this.showUpdateToast('Attendance marked!', 'info');
        });
    }

    updatePerformanceChart(newData) {
        if (!this.charts.performanceTrend) return;
        
        // Add new data point
        this.charts.performanceTrend.data.labels.push(newData.label);
        this.charts.performanceTrend.data.datasets[0].data.push(newData.value);
        
        // Keep only last 10 points
        if (this.charts.performanceTrend.data.labels.length > 10) {
            this.charts.performanceTrend.data.labels.shift();
            this.charts.performanceTrend.data.datasets[0].data.shift();
        }
        
        this.charts.performanceTrend.update('active');
    }

    updateAttendanceHeatmap(newData) {
        // Refresh heatmap with new data
        this.createAttendanceHeatmap();
    }

    // API calls
    async fetchPerformanceData() {
        try {
            const response = await fetch('/api/analytics/performance-trend', {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            const result = await response.json();
            return result.data || this.getFallbackPerformanceData();
        } catch (error) {
            console.error('Failed to fetch performance data:', error);
            return this.getFallbackPerformanceData();
        }
    }

    async fetchAttendanceData() {
        try {
            const response = await fetch('/api/analytics/attendance-calendar', {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            const result = await response.json();
            return result.data || this.getFallbackAttendanceData();
        } catch (error) {
            console.error('Failed to fetch attendance data:', error);
            return this.getFallbackAttendanceData();
        }
    }

    async fetchSubjectComparison() {
        try {
            const response = await fetch('/api/analytics/subject-comparison', {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            const result = await response.json();
            return result.data || this.getFallbackSubjectData();
        } catch (error) {
            console.error('Failed to fetch subject comparison:', error);
            return this.getFallbackSubjectData();
        }
    }

    async fetchGradeDistribution() {
        try {
            const response = await fetch('/api/analytics/grade-distribution', {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            const result = await response.json();
            return result.data || this.getFallbackGradeData();
        } catch (error) {
            console.error('Failed to fetch grade distribution:', error);
            return this.getFallbackGradeData();
        }
    }

    async fetchMonthlyProgress() {
        try {
            const response = await fetch('/api/analytics/monthly-progress', {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            const result = await response.json();
            return result.data || this.getFallbackMonthlyData();
        } catch (error) {
            console.error('Failed to fetch monthly progress:', error);
            return this.getFallbackMonthlyData();
        }
    }

    // Fallback data
    getFallbackPerformanceData() {
        return {
            labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5', 'Week 6', 'Week 7', 'Week 8'],
            studentMarks: [75, 78, 82, 79, 85, 88, 86, 90],
            classAverage: [70, 72, 75, 76, 78, 80, 79, 82],
            target: [85, 85, 85, 85, 85, 85, 85, 85]
        };
    }

    getFallbackAttendanceData() {
        const data = [];
        const today = new Date();
        
        for (let i = 0; i < 84; i++) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];
            
            // Skip weekends
            if (date.getDay() === 0 || date.getDay() === 6) continue;
            
            data.push({
                date: dateStr,
                total: Math.floor(Math.random() * 6) + 2,
                present: Math.floor(Math.random() * 5) + 1
            });
        }
        
        return data;
    }

    getFallbackSubjectData() {
        return {
            subjects: ['Mathematics', 'Physics', 'Chemistry', 'Programming', 'English', 'Biology'],
            studentScores: [85, 78, 92, 88, 75, 82],
            classAverage: [75, 72, 80, 79, 78, 76]
        };
    }

    getFallbackGradeData() {
        return {
            grades: ['A+ (90-100)', 'A (80-89)', 'B (70-79)', 'C (60-69)', 'F (<60)'],
            counts: [12, 25, 18, 8, 3]
        };
    }

    getFallbackMonthlyData() {
        return {
            labels: ['Excellent (90+)', 'Good (75-89)', 'Average (60-74)', 'Needs Improvement (<60)'],
            values: [25, 45, 20, 10]
        };
    }

    // Utility functions
    createGradient(ctx, color) {
        const gradient = ctx.createLinearGradient(0, 0, 0, 400);
        const rgbColor = color.match(/\d+/g);
        gradient.addColorStop(0, `rgba(${rgbColor[0]}, ${rgbColor[1]}, ${rgbColor[2]}, 0.3)`);
        gradient.addColorStop(1, `rgba(${rgbColor[0]}, ${rgbColor[1]}, ${rgbColor[2]}, 0.05)`);
        return gradient;
    }

    showUpdateToast(message, type = 'info') {
        if (typeof showToast === 'function') {
            showToast(message, type);
        } else {
            console.log(`[${type.toUpperCase()}] ${message}`);
        }
    }

    // Cleanup
    destroy() {
        Object.values(this.charts).forEach(chart => {
            if (chart) chart.destroy();
        });
    }
}

// Initialize on page load
if (document.getElementById('performanceTrendChart') || 
    document.getElementById('attendanceHeatmap') ||
    document.getElementById('subjectRadarChart')) {
    document.addEventListener('DOMContentLoaded', () => {
        window.advancedAnalytics = new AdvancedAnalytics();
    });
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AdvancedAnalytics;
}
