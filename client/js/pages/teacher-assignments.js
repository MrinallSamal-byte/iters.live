// Teacher Assignments Page JavaScript
console.log('Teacher Assignments Page Loaded');

// Load dummy data on page load
document.addEventListener('DOMContentLoaded', () => {
    loadAssignmentStats();
    loadActiveAssignments();
    loadPendingSubmissions();
    initializeForm();
});

// Load assignment statistics
function loadAssignmentStats() {
    try {
        if (typeof DummyData === 'undefined') {
            console.warn('DummyData not available');
            return;
        }

        const result = DummyData.getTeacherAssignments();
        if (result.success) {
            const assignments = result.data;
            
            // Calculate stats
            const totalAssignments = assignments.length;
            const activeAssignments = assignments.filter(a => new Date(a.deadline) > new Date()).length;
            const totalPending = assignments.reduce((sum, a) => sum + a.pending_count, 0);
            
            // Calculate average submission rate
            const totalStudents = assignments.reduce((sum, a) => sum + a.total_students, 0);
            const totalSubmissions = assignments.reduce((sum, a) => sum + a.submissions_count, 0);
            const avgSubmissionRate = totalStudents > 0 ? Math.round((totalSubmissions / totalStudents) * 100) : 0;

            // Update stat boxes
            document.getElementById('totalAssignments').textContent = totalAssignments;
            document.getElementById('activeAssignments').textContent = activeAssignments;
            document.getElementById('pendingSubmissions').textContent = totalPending;
            document.getElementById('avgSubmissionRate').textContent = avgSubmissionRate + '%';
            
            console.log('✅ Assignment stats loaded:', { totalAssignments, activeAssignments, totalPending });
        }
    } catch (error) {
        console.error('Error loading assignment stats:', error);
    }
}

// Load active assignments list
function loadActiveAssignments() {
    try {
        if (typeof DummyData === 'undefined') return;

        const result = DummyData.getTeacherAssignments();
        if (result.success) {
            const assignments = result.data;
            const container = document.querySelector('.assignments-grid') || document.querySelector('[class*="assignment"]');
            
            if (container) {
                container.innerHTML = assignments.slice(0, 6).map(assignment => {
                    const deadline = new Date(assignment.deadline);
                    const isOverdue = deadline < new Date();
                    const statusClass = isOverdue ? 'danger' : 'success';
                    const submissionRate = Math.round((assignment.submissions_count / assignment.total_students) * 100);

                    return `
                        <div class="assignment-card glass-card hover-lift">
                            <h4 class="assignment-title">${assignment.title}</h4>
                            <p class="assignment-subject">📖 ${assignment.subject}</p>
                            <div class="assignment-meta">
                                <span class="meta-item">👥 ${assignment.submissions_count}/${assignment.total_students} submitted</span>
                                <span class="meta-item ${statusClass}">📅 ${deadline.toLocaleDateString()}</span>
                            </div>
                            <div class="progress-bar">
                                <div class="progress-fill ${statusClass}" style="width: ${submissionRate}%"></div>
                            </div>
                            <p class="submission-rate">${submissionRate}% submission rate</p>
                            <div class="assignment-actions">
                                <button class="btn btn-sm btn-primary" onclick="viewAssignment(${assignment.id})">View Details</button>
                                <button class="btn btn-sm btn-secondary" onclick="gradeSubmissions(${assignment.id})">Grade (${assignment.pending_count})</button>
                            </div>
                        </div>
                    `;
                }).join('');
                
                console.log('✅ Assignments loaded:', assignments.length);
            }
        }
    } catch (error) {
        console.error('Error loading assignments:', error);
    }
}

// Load pending submissions
function loadPendingSubmissions() {
    try {
        if (typeof DummyData === 'undefined') return;

        const result = DummyData.getTeacherSubmissions('pending');
        if (result.success) {
            const submissions = result.data;
            const tbody = document.querySelector('#pendingSubmissionsTable tbody');
            const countElement = document.querySelector('.pending-count');
            
            if (countElement) {
                countElement.textContent = submissions.length;
            }
            
            if (tbody) {
                if (submissions.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">No pending submissions</td></tr>';
                } else {
                    tbody.innerHTML = submissions.slice(0, 10).map(sub => {
                        const submittedDate = new Date(sub.submitted_at);
                        return `
                            <tr>
                                <td>${sub.assignment_title}</td>
                                <td>${sub.student_name}</td>
                                <td>${sub.student_reg}</td>
                                <td>${submittedDate.toLocaleDateString()}</td>
                                <td><span class="badge badge-warning">Pending</span></td>
                                <td>
                                    <button class="btn btn-sm btn-primary" onclick="gradeSubmission(${sub.id})">Grade</button>
                                    <button class="btn btn-sm btn-secondary" onclick="viewFile('${sub.file_name}')">View</button>
                                </td>
                            </tr>
                        `;
                    }).join('');
                }
                
                console.log('✅ Pending submissions loaded:', submissions.length);
            }
        }
    } catch (error) {
        console.error('Error loading pending submissions:', error);
    }
}

// Initialize form
function initializeForm() {
    const assignmentForm = document.getElementById('createAssignmentForm');
    
    if (assignmentForm) {
        assignmentForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            console.log('Creating assignment...');
            
            // Show success toast
            if (typeof showToast === 'function') {
                showToast('Assignment created successfully!', 'success');
            }
            
            // Reset form
            assignmentForm.reset();
            
            // Reload data
            setTimeout(() => {
                loadAssignmentStats();
                loadActiveAssignments();
            }, 500);
        });
    }
}

// Helper functions for actions
function viewAssignment(id) {
    console.log('Viewing assignment:', id);
    if (typeof showToast === 'function') {
        showToast('Opening assignment details...', 'info');
    }
}

function gradeSubmissions(assignmentId) {
    console.log('Grading submissions for assignment:', assignmentId);
    if (typeof showToast === 'function') {
        showToast('Opening grading interface...', 'info');
    }
}

function gradeSubmission(submissionId) {
    console.log('Grading submission:', submissionId);
    if (typeof showToast === 'function') {
        showToast('Opening submission for grading...', 'info');
    }
}

function viewFile(fileName) {
    console.log('Viewing file:', fileName);
    if (typeof showToast === 'function') {
        showToast('Opening file: ' + fileName, 'info');
    }
}
