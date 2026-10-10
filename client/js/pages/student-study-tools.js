// Student Study Tools: tabbed host for the GPA calculator, focus timer, calendar and flashcards.
// Loaded as a module so it runs after the component modules have registered their classes.
const tools = {
    gpa: () => new window.GPACalculator('gpa-calculator'),
    timer: () => new window.PomodoroTimer('pomodoro-timer'),
    calendar: () => new window.AssignmentCalendar('assignment-calendar'),
    // flashcard-system.js creates its own instance and renders into #flashcard-container on load
    flashcards: () => true
};

const started = {};

function startTool(name) {
    if (started[name] || !tools[name]) return;
    try {
        started[name] = tools[name]() || true;
    } catch (error) {
        console.error(`Could not start ${name}:`, error);
        const panel = document.getElementById(`panel-${name}`);
        if (panel) {
            panel.insertAdjacentHTML('beforeend', '<div class="empty-state"><p>This tool could not load. Please refresh the page.</p></div>');
        }
    }
}

function showTool(name) {
    document.querySelectorAll('.tools-tabs .tab-btn').forEach((btn) => {
        const active = btn.dataset.tool === name;
        btn.classList.toggle('active', active);
        btn.setAttribute('aria-selected', String(active));
    });
    document.querySelectorAll('.tool-panel').forEach((panel) => {
        panel.hidden = panel.id !== `panel-${name}`;
    });
    startTool(name);
    try { sessionStorage.setItem('studyToolsTab', name); } catch (e) { /* storage unavailable */ }
}

document.querySelectorAll('.tools-tabs .tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => showTool(btn.dataset.tool));
});

let initial = 'gpa';
try {
    const saved = sessionStorage.getItem('studyToolsTab');
    if (saved && tools[saved]) initial = saved;
} catch (e) { /* storage unavailable */ }
showTool(initial);
