const fs = require('fs');
const path = require('path');

const rootDir = __dirname;
const archiveDir = path.join(rootDir, 'docs', 'archive');

// Ensure archive directory exists
if (!fs.existsSync(archiveDir)) {
    fs.mkdirSync(archiveDir, { recursive: true });
}

// Files to keep at root (essential docs)
const keepAtRoot = [
    'README.md',
    'ARCHITECTURE.md',
    'DEPLOYMENT_GUIDE.md',
    'QUICKSTART.md',
    'INDEX.md',
    'PROJECT_SUMMARY.md'
];

// Files to delete (demos, banners, old scripts)
const filesToDelete = [
    // Demo/test HTML files
    'client/mobile-demo.html',
    'client/phase9-demo-standalone.html',
    'client/phase9-demo.html',
    'client/student-enhancement-demo.html',
    'client/complete-system-test.html',
    'client/example-with-profile.html',
    'client/simple-integration-example.html',
    'client/clear-session.html',
    
    // Banner files
    'ANALYTICS_COMPLETE_BANNER.txt',
    'BANNER.txt',
    'DASHBOARD_COMPLETE_BANNER.txt',
    'ENHANCEMENT_COMPLETE.txt',
    'ENHANCEMENT_COMPLETE_BANNER.txt',
    'NAVIGATION_FIXED.txt',
    'NO_ANIMATIONS_COMPLETE.txt',
    'PHASE_9_BANNER.txt',
    'PROJECT_100_PERCENT_COMPLETE.txt',
    'STUDENT_UI_COMPLETE.txt',
    
    // Old PowerShell/batch scripts
    'apply-no-animations.ps1',
    'find-and-replace.ps1',
    'reset-mysql-password-guide.ps1',
    'run-notes-schema.bat',
    'run-tests.ps1',
    'setup-enhanced.bat',
    'setup-enhancements.bat',
    'setup-notes-system.bat',
    'update-student-navigation.ps1',
    'update-student-pages.ps1',
    'test-simple.ps1'
];

const movedFiles = [];
const deletedFiles = [];
const errors = [];

// Get all MD files in root
const allFiles = fs.readdirSync(rootDir);
const mdFiles = allFiles.filter(f => f.endsWith('.md'));

// Move MD files to archive (except those to keep)
mdFiles.forEach(file => {
    if (!keepAtRoot.includes(file)) {
        try {
            const src = path.join(rootDir, file);
            const dest = path.join(archiveDir, file);
            fs.renameSync(src, dest);
            movedFiles.push({ from: file, to: `docs/archive/${file}` });
            console.log(`✓ Moved: ${file}`);
        } catch (err) {
            errors.push({ file, error: err.message });
            console.error(`✗ Error moving ${file}:`, err.message);
        }
    }
});

// Delete unnecessary files
filesToDelete.forEach(file => {
    const filePath = path.join(rootDir, file);
    if (fs.existsSync(filePath)) {
        try {
            fs.unlinkSync(filePath);
            deletedFiles.push(file);
            console.log(`✓ Deleted: ${file}`);
        } catch (err) {
            errors.push({ file, error: err.message });
            console.error(`✗ Error deleting ${file}:`, err.message);
        }
    }
});

// Move SQL files to proper database location
const sqlFiles = ['create-mysql-user.sql'];
sqlFiles.forEach(file => {
    const src = path.join(rootDir, file);
    if (fs.existsSync(src)) {
        try {
            const dest = path.join(rootDir, 'server', 'database', 'scripts', file);
            const destDir = path.dirname(dest);
            if (!fs.existsSync(destDir)) {
                fs.mkdirSync(destDir, { recursive: true });
            }
            fs.renameSync(src, dest);
            movedFiles.push({ from: file, to: `server/database/scripts/${file}` });
            console.log(`✓ Moved SQL file: ${file}`);
        } catch (err) {
            errors.push({ file, error: err.message });
            console.error(`✗ Error moving SQL ${file}:`, err.message);
        }
    }
});

// Move old JS test/utility scripts to scripts folder
const jsTestFiles = ['find-mysql-password.js', 'test-db-connection.js', 'setup.js'];
jsTestFiles.forEach(file => {
    const src = path.join(rootDir, file);
    if (fs.existsSync(src)) {
        try {
            const dest = path.join(rootDir, 'scripts', 'utilities', file);
            const destDir = path.dirname(dest);
            if (!fs.existsSync(destDir)) {
                fs.mkdirSync(destDir, { recursive: true });
            }
            fs.renameSync(src, dest);
            movedFiles.push({ from: file, to: `scripts/utilities/${file}` });
            console.log(`✓ Moved utility script: ${file}`);
        } catch (err) {
            errors.push({ file, error: err.message });
            console.error(`✗ Error moving ${file}:`, err.message);
        }
    }
});

// Generate summary
console.log('\n' + '='.repeat(60));
console.log('REFACTORING COMPLETE');
console.log('='.repeat(60));
console.log(`\n📦 Files Moved: ${movedFiles.length}`);
console.log(`🗑️  Files Deleted: ${deletedFiles.length}`);
console.log(`❌ Errors: ${errors.length}`);

// Save detailed report
const report = {
    timestamp: new Date().toISOString(),
    summary: {
        movedCount: movedFiles.length,
        deletedCount: deletedFiles.length,
        errorCount: errors.length
    },
    movedFiles,
    deletedFiles,
    errors
};

fs.writeFileSync(
    path.join(rootDir, 'REFACTOR_REPORT.json'),
    JSON.stringify(report, null, 2)
);

console.log('\n📄 Detailed report saved to: REFACTOR_REPORT.json');
