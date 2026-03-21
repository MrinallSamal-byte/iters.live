const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const DASHBOARD_DIR = path.join(__dirname, '..', '..', 'client', 'dashboard');
const BASE_URL = process.env.RESPONSIVE_AUDIT_BASE_URL || 'http://localhost:3000';
const VIEWPORTS = [
    { name: 'mobile', width: 390, height: 844 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'laptop', width: 1280, height: 800 }
];

function getDashboardPages() {
    return fs.readdirSync(DASHBOARD_DIR)
        .filter(file => file.endsWith('.html'))
        .filter(file => file !== 'update-student-pages.js')
        .map(file => ({
            file,
            route: `/dashboard/${file.replace(/\.html$/, '')}`,
            role: file.startsWith('teacher-') || file === 'teacher.html'
                ? 'teacher'
                : file.startsWith('admin-') || file === 'admin.html'
                    ? 'admin'
                    : 'student'
        }));
}

function buildUser(role) {
    return {
        id: `${role}-audit-user`,
        name: `${role[0].toUpperCase()}${role.slice(1)} Audit`,
        email: `${role}@audit.local`,
        role
    };
}

function buildApiPayload(requestUrl) {
    const user = buildUser('student');

    if (requestUrl.includes('/api/notes')) {
        return { notes: [] };
    }

    if (requestUrl.includes('/api/forum')) {
        return { posts: [], categories: [], stats: {} };
    }

    if (requestUrl.includes('/api/attendance')) {
        return { attendance: [], summary: {}, subjects: [] };
    }

    if (requestUrl.includes('/api/marks')) {
        return { marks: [], semesters: [], summary: {} };
    }

    if (requestUrl.includes('/api/timetable')) {
        return { timetable: [], schedule: [], classes: [] };
    }

    if (requestUrl.includes('/api/events')) {
        return { events: [] };
    }

    if (requestUrl.includes('/api/clubs')) {
        return { clubs: [] };
    }

    if (requestUrl.includes('/api/profile')) {
        return { profile: user, user };
    }

    if (requestUrl.includes('/api/payment')) {
        return { payments: [], invoices: [], summary: {} };
    }

    if (requestUrl.includes('/api/teacher')) {
        return {
            assignments: [],
            students: [],
            attendance: [],
            marks: [],
            notes: [],
            questionBanks: []
        };
    }

    if (requestUrl.includes('/api/admin')) {
        return {
            users: [],
            departments: [],
            analytics: {},
            announcements: [],
            approvals: []
        };
    }

    if (requestUrl.includes('/api/mobile/snapshot')) {
        return { snapshot: {}, stats: {}, notifications: [] };
    }

    return {
        success: true,
        user,
        data: [],
        items: [],
        rows: [],
        stats: {},
        summary: {}
    };
}

async function auditPage(page, pageSpec, viewport) {
    const runtimeErrors = [];

    page.on('pageerror', error => {
        runtimeErrors.push(`pageerror: ${error.message}`);
    });

    page.on('console', message => {
        if (message.type() === 'error') {
            runtimeErrors.push(`console: ${message.text()}`);
        }
    });

    await page.route('**/api/**', async route => {
        const body = JSON.stringify(buildApiPayload(route.request().url()));
        await route.fulfill({
            status: 200,
            headers: {
                'access-control-allow-origin': '*',
                'content-type': 'application/json'
            },
            body
        });
    });

    await page.addInitScript(({ role }) => {
        const user = {
            id: `${role}-audit-user`,
            name: `${role[0].toUpperCase()}${role.slice(1)} Audit`,
            email: `${role}@audit.local`,
            role
        };

        localStorage.setItem('token', 'responsive-audit-token');
        localStorage.setItem('accessToken', 'responsive-audit-token');
        localStorage.setItem('user', JSON.stringify(user));
        localStorage.setItem('theme', 'dark');
        sessionStorage.removeItem('loginRedirect');
        sessionStorage.removeItem('loginMessage');
    }, { role: pageSpec.role });

    await page.setViewportSize({ width: viewport.width, height: viewport.height });

    const response = await page.goto(`${BASE_URL}${pageSpec.route}`, {
        waitUntil: 'networkidle',
        timeout: 20000
    });

    await page.waitForTimeout(500);

    const audit = await page.evaluate(() => {
        const viewportWidth = window.innerWidth;
        const elements = Array.from(document.body.querySelectorAll('*'));
        const offenders = [];

        for (const element of elements) {
            const style = window.getComputedStyle(element);

            if (style.display === 'none' || style.visibility === 'hidden') {
                continue;
            }

            const rect = element.getBoundingClientRect();
            const overflowLeft = rect.left < -2;
            const overflowRight = rect.right > viewportWidth + 2;
            const tooWide = rect.width > viewportWidth + 2;

            if (!overflowLeft && !overflowRight && !tooWide) {
                continue;
            }

            offenders.push({
                selector: (() => {
                    const tagName = element.tagName.toLowerCase();
                    const id = element.id ? `#${element.id}` : '';
                    const classNames = Array.from(element.classList || []).slice(0, 3).join('.');
                    return `${tagName}${id}${classNames ? `.${classNames}` : ''}`;
                })(),
                width: Number(rect.width.toFixed(1)),
                left: Number(rect.left.toFixed(1)),
                right: Number(rect.right.toFixed(1)),
                position: style.position,
                overflowX: style.overflowX
            });

            if (offenders.length >= 12) {
                break;
            }
        }

        return {
            path: window.location.pathname,
            bodyClass: document.body.className,
            scrollWidth: document.documentElement.scrollWidth,
            clientWidth: document.documentElement.clientWidth,
            overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
            offenders
        };
    });

    return {
        route: pageSpec.route,
        file: pageSpec.file,
        role: pageSpec.role,
        viewport: viewport.name,
        status: response ? response.status() : 0,
        audit,
        errors: runtimeErrors.slice(0, 8)
    };
}

async function main() {
    const pages = getDashboardPages();
    const browser = await chromium.launch({ headless: true });
    const results = [];

    try {
        for (const viewport of VIEWPORTS) {
            for (const pageSpec of pages) {
                const context = await browser.newContext({
                    viewport: { width: viewport.width, height: viewport.height },
                    userAgent: `responsive-audit/${viewport.name}`
                });
                const page = await context.newPage();

                try {
                    const result = await auditPage(page, pageSpec, viewport);
                    results.push(result);
                } catch (error) {
                    results.push({
                        route: pageSpec.route,
                        file: pageSpec.file,
                        role: pageSpec.role,
                        viewport: viewport.name,
                        status: 0,
                        audit: {
                            path: pageSpec.route,
                            scrollWidth: 0,
                            clientWidth: viewport.width,
                            overflow: 0,
                            offenders: []
                        },
                        errors: [`audit failed: ${error.message}`]
                    });
                } finally {
                    await context.close();
                }
            }
        }
    } finally {
        await browser.close();
    }

    const failures = results.filter(result =>
        result.errors.length > 0 || result.audit.overflow > 2
    );

    const summary = {
        baseUrl: BASE_URL,
        totalChecks: results.length,
        failures: failures.length,
        results
    };

    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);

    if (failures.length > 0) {
        process.exitCode = 1;
    }
}

main().catch(error => {
    process.stderr.write(`${error.stack || error.message}\n`);
    process.exit(1);
});
