// Admin Settings Page JavaScript
console.log('Admin Settings Page Loaded');

let warnedDbActionsUnavailable = false;

function warnDbActionsUnavailable() {
    if (!warnedDbActionsUnavailable) {
        warnedDbActionsUnavailable = true;
        console.warn('Database management actions are disabled: the server exposes no backup/restore/cache/optimize endpoints yet.');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const notificationForm = document.getElementById('notificationForm');
    notificationForm?.addEventListener('submit', (e) => {
        e.preventDefault();
        warnDbActionsUnavailable();
    });

    const settingsForm = document.getElementById('settingsForm');
    settingsForm?.addEventListener('submit', (e) => {
        e.preventDefault();
        warnDbActionsUnavailable();
    });
});

function backupDatabase() { warnDbActionsUnavailable(); }
function restoreDatabase() { warnDbActionsUnavailable(); }
function clearCache() { warnDbActionsUnavailable(); }
function optimizeDatabase() { warnDbActionsUnavailable(); }
