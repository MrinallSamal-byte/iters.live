// Batch update script for student pages
// This updates the header section of all student pages to use the sidebar

const pagesToUpdate = [
    'student-timetable.html',
    'student-notes.html',
    'student-events.html',
    'student-clubs.html',
    'student-hostel-menu.html'
];

const updatedHeader = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{PAGE_TITLE}} - ITER EduHub</title>
    <link rel="stylesheet" href="../css/style.css">
    <link rel="stylesheet" href="../css/components.css">
    <link rel="stylesheet" href="../css/clean-dashboard.css">
    <link rel="stylesheet" href="../css/student-sidebar.css">
    <link rel="manifest" href="../manifest.json">
</head>
<body>
    <!-- Background -->
    <div class="bg-animation">
        <div class="gradient-orb orb-1"></div>
        <div class="gradient-orb orb-2"></div>
        <div class="gradient-orb orb-3"></div>
    </div>

    <!-- Sidebar will be injected by student-sidebar.js -->
    
    <!-- Main Content -->
    <main class="dashboard-main">`;

console.log('Pages need manual update:');
pagesToUpdate.forEach(page => {
    console.log(`- ${page}: Replace top nav with sidebar script`);
});

console.log('\nKey changes needed:');
console.log('1. Remove <nav class="dashboard-nav"> section');
console.log('2. Add student-sidebar.css to head');
console.log('3. Add student-sidebar.js before other scripts');
console.log('4. Ensure main has class="dashboard-main"');
