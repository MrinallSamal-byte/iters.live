(function(){
  'use strict';

  // Auth check
  if (typeof APP === 'undefined' || !APP.isAuthenticated() || APP.getUserRole() !== 'student') {
    try { window.location.href = '/login.html'; } catch(_) {}
    return;
  }
  const user = APP.Storage.get('user') || {};

  document.addEventListener('DOMContentLoaded', init);

  async function init(){
    // Welcome name
    const w = document.getElementById('studentWelcomeName');
    if (w) w.textContent = user.name || 'Student';

    // Stats
    const attendance = await getAttendance();
    setText('overallAttendance', attendance.percent != null ? attendance.percent + '%' : '85%');

    const marks = await getMarks();
    setText('currentCGPA', marks.gpa != null ? String(marks.gpa) : '8.5');

    const assignments = await getAssignments();
    setText('pendingAssignments', String(assignments.pendingCount || 5));

    const events = await getEvents();
    setText('upcomingEvents', String(events.count || 8));

    // Charts
    renderAttendanceChart(attendance.present || 320, attendance.absent || 45);
    renderPerformanceChart(marks.summary || []);

    // Today schedule
    renderTodaySchedule();
    
    // Recent activity
    renderRecentActivity();
  }

  function setText(id, txt){ const el = document.getElementById(id); if (el) el.textContent = txt; }

  async function getAttendance(){
    try { 
      const r = await APP.API.get(`/attendance/student/${user.id}`); 
      return normalizeAttendance(r.data); 
    } catch(_) { 
      if (typeof DummyData !== 'undefined') {
        const r = DummyData.getStudentAttendance(); 
        console.log('Dummy Attendance Data:', r);
        return normalizeAttendance(r.data);
      }
      return { present: 320, absent: 45, total: 365, percent: 88, summary: [] };
    }
  }
  
  function normalizeAttendance(data){
    const summary = data?.summary || [];
    let present = 0, total = 0; 
    summary.forEach(s=>{ 
      present += Number(s.present_count||0); 
      total += Number(s.total_classes||0); 
    });
    const absent = Math.max(0, total - present);
    const percent = total ? Math.round((present/total)*100) : 88;
    console.log('Normalized Attendance:', { present, total, absent, percent });
    return { present: present || 320, total: total || 365, absent: absent || 45, percent, summary };
  }

  async function getMarks(){
    try { 
      const r = await APP.API.get(`/marks/student/${user.id}`); 
      return normalizeMarks(r.data); 
    } catch(_) { 
      if (typeof DummyData !== 'undefined') {
        const r = DummyData.getStudentMarks(); 
        console.log('Dummy Marks Data:', r);
        return normalizeMarks(r.data);
      }
      return { gpa: 8.5, summary: [] };
    }
  }
  
  function normalizeMarks(data){
    const summary = data?.summary || [];
    console.log('Marks Summary:', summary);
    if (!summary.length) {
      // Return dummy data if no summary
      return {
        gpa: 8.14,
        summary: [
          { subject: 'Data Structures', avg_marks: 85, avg_total: 100 },
          { subject: 'Algorithms', avg_marks: 88, avg_total: 100 },
          { subject: 'Database Systems', avg_marks: 82, avg_total: 100 },
          { subject: 'Operating Systems', avg_marks: 90, avg_total: 100 },
          { subject: 'Computer Networks', avg_marks: 78, avg_total: 100 },
          { subject: 'Web Development', avg_marks: 92, avg_total: 100 }
        ]
      };
    }
    let totalPct = 0; 
    summary.forEach(s=>{ 
      totalPct += (Number(s.avg_marks||0)/Number(s.avg_total||100))*100; 
    });
    const avgPct = summary.length ? totalPct/summary.length : 85;
    const gpa = Number((avgPct/10).toFixed(2));
    return { gpa, summary };
  }

  async function getAssignments(){
    try { 
      const r = await APP.API.get('/assignments/student'); 
      return normalizeAssignments(r.data); 
    } catch(_) { 
      if (typeof DummyData !== 'undefined') {
        const r = DummyData.getAssignments(); 
        return normalizeAssignments(r.data);
      }
      return { pendingCount: 5 };
    }
  }
  
  function normalizeAssignments(list){
    const arr = Array.isArray(list)? list : (list?.data || []);
    const pendingCount = arr.filter(a => /pending|not submitted/i.test(String(a.submission_status||''))).length || 5;
    return { pendingCount };
  }

  async function getEvents(){
    try { 
      const r = await APP.API.get('/events'); 
      return { count: (r.data||[]).length || 8 };
    } catch(_) { 
      if (typeof DummyData !== 'undefined') {
        const r = DummyData.getEvents(); 
        return { count: (r.data||[]).length || 8 };
      }
      return { count: 8 };
    }
  }

  function renderAttendanceChart(present, absent){
    const el = document.getElementById('attendanceChart');
    if (!el) return;
    try { 
      new Chart(el, { 
        type: 'doughnut', 
        data: { 
          labels: ['Present','Absent'], 
          datasets: [{ 
            data: [present, absent], 
            backgroundColor: ['#22c55e','#ef4444'], 
            borderWidth: 0 
          }] 
        }, 
        options: { 
          cutout: '70%', 
          plugins: { 
            legend: { 
              display: true,
              position: 'bottom',
              labels: { color: '#fff' }
            } 
          } 
        } 
      }); 
    } catch(err) {
      console.error('Chart error:', err);
    }
  }
  
  function renderPerformanceChart(summary){
    const el = document.getElementById('performanceChart');
    if (!el) return;
    
    // Use dummy data if summary is empty
    if (!summary || !summary.length) {
      summary = [
        { subject: 'Structural Analysis', avg_marks: 78, avg_total: 100 },
        { subject: 'Concrete Technology', avg_marks: 85, avg_total: 100 },
        { subject: 'Surveying', avg_marks: 88, avg_total: 100 },
        { subject: 'Fluid Mechanics', avg_marks: 82, avg_total: 100 },
        { subject: 'Geotechnical Eng', avg_marks: 80, avg_total: 100 },
        { subject: 'Computer Aided Design', avg_marks: 75, avg_total: 100 },
        { subject: 'Const. Management', avg_marks: 92, avg_total: 100 },
        { subject: 'A.I. & ML', avg_marks: 86, avg_total: 100 },
        { subject: 'Big Data Analytics', avg_marks: 83, avg_total: 100 },
        { subject: 'Discrete Mathematics', avg_marks: 89, avg_total: 100 },
        { subject: 'Database Mgmt Systems', avg_marks: 81, avg_total: 100 },
        { subject: 'Operating Systems', avg_marks: 87, avg_total: 100 },
        { subject: 'Computer Networks', avg_marks: 84, avg_total: 100 },
        { subject: 'Machine Learning', avg_marks: 91, avg_total: 100 }
      ];
    }
    
    const labels = summary.map(s=>s.subject || 'Unknown');
    const data = summary.map(s=> {
      const marks = Number(s.avg_marks || 0);
      const total = Number(s.avg_total || 100);
      return Number(((marks/total)*100).toFixed(1));
    });
    
    console.log('Performance Chart Data:', { labels, data });
    
    try { 
      new Chart(el, { 
        type: 'bar', 
        data: { 
          labels, 
          datasets: [{ 
            label: 'Percentage', 
            data, 
            backgroundColor: '#6366f1', 
            borderRadius: 6 
          }] 
        }, 
        options: { 
          plugins: { 
            legend: { display:false } 
          }, 
          scales: { 
            y: { 
              beginAtZero:true, 
              max:100,
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

  function renderTodaySchedule(){
    const container = document.getElementById('todaySchedule'); 
    if (!container) return;
    
    let res;
    try { 
      if (typeof DummyData !== 'undefined') {
        res = DummyData.getTimetable(); 
      }
    } catch(_) {}
    
    const items = res?.data || [];
    const day = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][new Date().getDay()];
    const today = items.filter(x => x.day_of_week === day);
    
    if (!today.length){ 
      container.innerHTML = `
        <div class="schedule-item">
          <div>
            <strong>No classes today</strong>
            <p style="color: var(--text-secondary); font-size: 0.9rem; margin: 0.5rem 0 0 0;">Enjoy your day off!</p>
          </div>
          <div style="color: var(--text-secondary);">—</div>
        </div>
      `; 
      return; 
    }
    
    container.innerHTML = today.map(s=> `
      <div class="schedule-item">
        <div>
          <strong>${s.subject}</strong>
          <p style="color: var(--text-secondary); font-size: 0.85rem; margin: 0.25rem 0 0 0;">
            ${s.teacher_name} • Room ${s.room_number}
          </p>
        </div>
        <div style="color: var(--primary); font-weight: 600;">${s.time_slot}</div>
      </div>
    `).join('');
  }
  
  function renderRecentActivity(){
    const container = document.getElementById('recentActivity');
    if (!container) return;
    
    const activities = [
      { icon: '📝', title: 'Assignment Submitted', description: 'Data Structures Assignment 3', time: '2 hours ago' },
      { icon: '✅', title: 'Attendance Marked', description: 'Present in Database Systems', time: '3 hours ago' },
      { icon: '📊', title: 'Marks Updated', description: 'Algorithms Mid-term results', time: '1 day ago' },
      { icon: '📢', title: 'New Announcement', description: 'Mid-term exam schedule released', time: '2 days ago' },
      { icon: '📚', title: 'Notes Downloaded', description: 'Operating Systems Unit 4', time: '3 days ago' }
    ];
    
    container.innerHTML = activities.map(a => `
      <div class="activity-item">
        <div style="display: flex; gap: 1rem; align-items: flex-start;">
          <div style="font-size: 1.5rem;">${a.icon}</div>
          <div style="flex: 1;">
            <h4 style="margin: 0; color: var(--text-primary); font-size: 0.95rem;">${a.title}</h4>
            <p style="margin: 0.25rem 0 0 0; color: var(--text-secondary); font-size: 0.85rem;">${a.description}</p>
          </div>
          <span style="color: var(--text-secondary); font-size: 0.75rem; white-space: nowrap;">${a.time}</span>
        </div>
      </div>
    `).join('');
  }
})();
