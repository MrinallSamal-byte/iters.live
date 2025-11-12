// Student Marks Page Logic

if (typeof APP === 'undefined' || !APP.isAuthenticated() || APP.getUserRole() !== 'student') {
    window.location.href = '/login.html';
    throw new Error('Not authenticated');
}

const user = APP.Storage.get('user') || {};

document.addEventListener('DOMContentLoaded', async () => {
    if (typeof NavLoader !== 'undefined') {
        await NavLoader.load('student', 'marks');
    }

    if (typeof ParticleSystem !== 'undefined' && document.getElementById('particleCanvas')) {
        new ParticleSystem('particleCanvas', { 
            particleCount: 50, 
            particleColor: 'rgba(99, 102, 241, 0.5)', 
            speed: 0.3 
        });
    }

    loadMarksData();
});

async function loadMarksData() {
    try {
        let response;
        try {
            response = await APP.API.get(`/marks/student/${user.id}`);
        } catch (error) {
            console.warn('Using dummy data for marks');
            if (typeof DummyData !== 'undefined') {
                response = DummyData.getStudentMarks();
            } else {
                // Hardcoded fallback
                response = {
                    success: true,
                    data: {
                        summary: [
                            { subject: 'Data Structures', subject_code: 'CS301', avg_marks: 85, avg_total: 100, credits: 4 },
                            { subject: 'Algorithms', subject_code: 'CS302', avg_marks: 88, avg_total: 100, credits: 4 },
                            { subject: 'Database Systems', subject_code: 'CS303', avg_marks: 82, avg_total: 100, credits: 3 },
                            { subject: 'Operating Systems', subject_code: 'CS304', avg_marks: 90, avg_total: 100, credits: 4 },
                            { subject: 'Computer Networks', subject_code: 'CS305', avg_marks: 78, avg_total: 100, credits: 3 },
                            { subject: 'Software Engineering', subject_code: 'CS306', avg_marks: 92, avg_total: 100, credits: 3 }
                        ],
                        marks: []
                    }
                };
            }
        }

        if (response.success && response.data) {
            displayMarks(response.data);
        } else {
            throw new Error('Invalid response');
        }
    } catch (error) {
        console.error('Failed to load marks:', error);
        if (typeof Toast !== 'undefined') {
            Toast.error('Failed to load marks data', 'Error');
        }
        // Display fallback data
        displayMarks({
            summary: [
                { subject: 'Data Structures', subject_code: 'CS301', avg_marks: 85, avg_total: 100, credits: 4 },
                { subject: 'Algorithms', subject_code: 'CS302', avg_marks: 88, avg_total: 100, credits: 4 },
                { subject: 'Database Systems', subject_code: 'CS303', avg_marks: 82, avg_total: 100, credits: 3 },
                { subject: 'Operating Systems', subject_code: 'CS304', avg_marks: 90, avg_total: 100, credits: 4 },
                { subject: 'Computer Networks', subject_code: 'CS305', avg_marks: 78, avg_total: 100, credits: 3 },
                { subject: 'Software Engineering', subject_code: 'CS306', avg_marks: 92, avg_total: 100, credits: 3 }
            ]
        });
    }
}

function displayMarks(data) {
    const { summary } = data;
    
    if (!summary || summary.length === 0) {
        document.getElementById('marksTableBody').innerHTML = 
            '<tr><td colspan="7" style="text-align:center;">No marks data available</td></tr>';
        return;
    }

    // Calculate statistics
    let totalPercentage = 0;
    let highestMarks = 0;
    let lowestPercentage = 100;
    let topSubject = '';
    let weakSubject = '';
    let totalCredits = 0;
    
    summary.forEach(s => {
        const marks = Number(s.avg_marks || 0);
        const total = Number(s.avg_total || 100);
        const percentage = (marks / total) * 100;
        const credits = Number(s.credits || 3);
        
        totalPercentage += percentage;
        totalCredits += credits;
        
        if (marks > highestMarks) {
            highestMarks = marks;
            topSubject = s.subject;
        }
        
        if (percentage < lowestPercentage) {
            lowestPercentage = percentage;
            weakSubject = s.subject;
        }
    });

    const avgPercentage = totalPercentage / summary.length;
    const cgpa = (avgPercentage / 10).toFixed(2);
    const sgpa = (avgPercentage / 10).toFixed(2);

    // Update stats
    const cgpaEl = document.getElementById('currentCGPA');
    const sgpaEl = document.getElementById('currentSGPA');
    const subjectsEl = document.getElementById('totalSubjects');
    const rankEl = document.getElementById('classRank');
    
    if (cgpaEl) cgpaEl.textContent = cgpa;
    if (sgpaEl) sgpaEl.textContent = sgpa;
    if (subjectsEl) subjectsEl.textContent = summary.length;
    if (rankEl) rankEl.textContent = Math.floor(Math.random() * 10) + 5; // Random rank for demo

    // Update insights
    const topEl = document.getElementById('topSubject');
    const avgEl = document.getElementById('averageScore');
    const weakEl = document.getElementById('weakSubject');
    
    if (topEl) topEl.textContent = `${topSubject} with ${Math.round(highestMarks)}%`;
    if (avgEl) avgEl.textContent = `${Math.round(avgPercentage)}% across all subjects`;
    if (weakEl) weakEl.textContent = `${weakSubject} - Focus on improvement`;

    // Create performance chart
    const ctx = document.getElementById('performanceChart');
    if (ctx && typeof Chart !== 'undefined') {
        try {
            new Chart(ctx, {
                type: 'line',
                data: {
                    labels: ['Sem 1', 'Sem 2', 'Sem 3', 'Current'],
                    datasets: [{
                        label: 'SGPA',
                        data: [7.8, 8.2, 8.5, parseFloat(sgpa)],
                        borderColor: '#6366f1',
                        backgroundColor: 'rgba(99, 102, 241, 0.1)',
                        tension: 0.4,
                        fill: true
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false }
                    },
                    scales: {
                        y: { 
                            beginAtZero: false,
                            min: 7,
                            max: 10,
                            ticks: { color: '#fff' },
                            grid: { color: 'rgba(255,255,255,0.1)' }
                        },
                        x: {
                            ticks: { color: '#fff' },
                            grid: { display: false }
                        }
                    }
                }
            });
        } catch(err) {
            console.error('Chart error:', err);
        }
    }

    // Create grade distribution chart
    const gradeCtx = document.getElementById('gradeDistChart');
    if (gradeCtx && typeof Chart !== 'undefined') {
        try {
            // Calculate grade distribution
            const grades = { 'A+': 0, 'A': 0, 'B+': 0, 'B': 0, 'C': 0 };
            summary.forEach(s => {
                const pct = (s.avg_marks / s.avg_total) * 100;
                if (pct >= 90) grades['A+']++;
                else if (pct >= 80) grades['A']++;
                else if (pct >= 70) grades['B+']++;
                else if (pct >= 60) grades['B']++;
                else grades['C']++;
            });

            new Chart(gradeCtx, {
                type: 'doughnut',
                data: {
                    labels: Object.keys(grades),
                    datasets: [{
                        data: Object.values(grades),
                        backgroundColor: ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#6b7280'],
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: {
                                color: '#fff',
                                font: { size: 12 }
                            }
                        }
                    }
                }
            });
        } catch(err) {
            console.error('Grade chart error:', err);
        }
    }

    // Populate marks table
    const tbody = document.getElementById('marksTableBody');
    if (tbody) {
        tbody.innerHTML = '';
        
        summary.forEach(subject => {
            const marks = Number(subject.avg_marks || 0);
            const total = Number(subject.avg_total || 100);
            const percentage = ((marks / total) * 100).toFixed(1);
            const grade = percentage >= 90 ? 'A+' : percentage >= 80 ? 'A' : percentage >= 70 ? 'B+' : percentage >= 60 ? 'B' : 'C';
            const internal = Math.round(marks * 0.3);
            const external = Math.round(marks * 0.7);
            const credits = subject.credits || 3;
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td><strong>${subject.subject_code || 'N/A'}</strong></td>
                <td>${subject.subject || 'Unknown'}</td>
                <td>${internal}</td>
                <td>${external}</td>
                <td><strong>${marks.toFixed(1)}</strong></td>
                <td><span class="badge badge-${grade.replace('+', '')}">${grade}</span></td>
                <td>${credits}</td>
            `;
            tbody.appendChild(row);
        });
    }

    // Populate semester history
    const historyEl = document.getElementById('semesterHistory');
    if (historyEl) {
        const semesters = [
            { sem: 1, sgpa: 7.8, cgpa: 7.8, year: '2023-24' },
            { sem: 2, sgpa: 8.2, cgpa: 8.0, year: '2023-24' },
            { sem: 3, sgpa: 8.5, cgpa: 8.2, year: '2024-25' },
            { sem: 'Current', sgpa: parseFloat(sgpa), cgpa: parseFloat(cgpa), year: '2024-25' }
        ];

        historyEl.innerHTML = semesters.map(s => `
            <div class="semester-card">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                    <h4 style="margin: 0; color: var(--primary);">Semester ${s.sem}</h4>
                    <span style="color: var(--text-secondary); font-size: 0.85rem;">${s.year}</span>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                    <div>
                        <p style="margin: 0; color: var(--text-secondary); font-size: 0.85rem;">SGPA</p>
                        <p style="margin: 0.25rem 0 0 0; font-size: 1.5rem; font-weight: 700; color: var(--text-primary);">${s.sgpa}</p>
                    </div>
                    <div>
                        <p style="margin: 0; color: var(--text-secondary); font-size: 0.85rem;">CGPA</p>
                        <p style="margin: 0.25rem 0 0 0; font-size: 1.5rem; font-weight: 700; color: var(--text-primary);">${s.cgpa}</p>
                    </div>
                </div>
            </div>
        `).join('');
    }
}
