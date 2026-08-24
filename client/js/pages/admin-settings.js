// Role guard (must run before any page logic or API calls)
(function () {
  if (typeof APP === 'undefined' || typeof APP.requirePageRole !== 'function' || !APP.requirePageRole('admin')) {
    // Stop all further execution on this page when the guard fails
    throw new Error('Access denied: page requires admin role');
  }
})();

// Admin Settings Page JavaScript
console.log('Admin Settings Page Loaded');

(function () {
    'use strict';

    // Every settings form on admin-settings.html (see the tabbed interface)
    const SETTINGS_FORM_IDS = [
        'generalForm',
        'systemPrefsForm',
        'academicForm',
        'gradingForm',
        'emailNotifForm',
        'pushNotifForm',
        'securityForm',
        'appearanceForm'
    ];

    const FORMS_SELECTOR = SETTINGS_FORM_IDS.map((id) => `#${id}`).join(',');

    let warnedDbActionsUnavailable = false;

    function warnDbActionsUnavailable() {
        if (!warnedDbActionsUnavailable) {
            warnedDbActionsUnavailable = true;
            console.warn('Database management actions are disabled: the server exposes no backup/restore/cache/optimize endpoints yet.');
        }
    }

    function notify(message, type) {
        if (window.Toast?.[type]) window.Toast[type](message);
        else if (window.Toast?.show) window.Toast.show({ type, message });
        else console.log(`[${type}] ${message}`);
    }

    function getForms() {
        return Array.from(document.querySelectorAll(FORMS_SELECTOR));
    }

    // ---- Collect / apply -------------------------------------------------

    // Flatten every named input across all forms into a plain key/value object.
    // Checkbox toggles are stored as true/false; numbers stay as strings so the
    // server's coerceSettingValue() decides their final type.
    function collectSettings() {
        const values = {};
        for (const form of getForms()) {
            for (const field of form.querySelectorAll('input[name], select[name], textarea[name]')) {
                if (field.type === 'checkbox') {
                    values[field.name] = field.checked;
                } else if (field.name) {
                    values[field.name] = field.value;
                }
            }
        }
        return values;
    }

    function applySettings(values) {
        if (!values || typeof values !== 'object') return;
        for (const form of getForms()) {
            for (const field of form.querySelectorAll('input[name], select[name], textarea[name]')) {
                if (!(field.name in values)) continue;
                const saved = values[field.name];
                if (field.type === 'checkbox') {
                    field.checked = saved === true || saved === 'true';
                } else {
                    field.value = saved == null ? '' : String(saved);
                }
            }
        }
    }

    // ---- Load / save -----------------------------------------------------

    async function loadSettings() {
        let data;
        try {
            const res = await APP.API.get('/admin/settings');
            data = res?.data;
        } catch (err) {
            console.error('Error loading settings:', err);
            notify('Failed to load settings. Showing saved defaults.', 'error');
            return;
        }

        // The endpoint returns an array of { key, value } items.
        const map = {};
        if (Array.isArray(data)) {
            data.forEach((item) => { if (item && item.key) map[item.key] = item.value; });
        } else if (data && typeof data === 'object') {
            Object.assign(map, data);
        }
        applySettings(map);
    }

    async function saveAllSettings() {
        const saveBtn = document.getElementById('saveAllBtn');
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.textContent = 'Saving…';
        }

        try {
            await APP.API.put('/admin/settings', collectSettings());
            notify('All settings saved successfully.', 'success');
        } catch (err) {
            console.error('Error saving settings:', err);
            notify(`Failed to save settings: ${err.message || 'request failed'}`, 'error');
        } finally {
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.textContent = 'Save All Changes';
            }
        }
    }

    // ---- Wiring ----------------------------------------------------------

    document.addEventListener('DOMContentLoaded', () => {
        // Individual form submits also trigger a full save (forms have no
        // per-form save buttons on this page - #saveAllBtn is the primary action).
        getForms().forEach((form) => {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                saveAllSettings();
            });
        });

        document.getElementById('saveAllBtn')?.addEventListener('click', saveAllSettings);

        loadSettings();
    });

    // Database tab actions (buttons are disabled server-side until endpoints exist)
    window.backupDatabase = function () { warnDbActionsUnavailable(); };
    window.restoreDatabase = function () { warnDbActionsUnavailable(); };
    window.clearCache = function () { warnDbActionsUnavailable(); };
    window.optimizeDatabase = function () { warnDbActionsUnavailable(); };
})();
