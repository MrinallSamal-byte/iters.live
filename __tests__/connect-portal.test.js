/**
 * @jest-environment jsdom
 */

describe('connect portal offline status', () => {
    const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

    beforeEach(() => {
        jest.resetModules();
        localStorage.clear();
        sessionStorage.clear();

        document.body.innerHTML = `
            <div id="statusBanner" class="status-banner"></div>
            <button type="button" id="startSessionBtn">Fetch SOA CAPTCHA</button>
            <button type="button" id="refreshCaptchaBtn">Refresh</button>
            <button type="submit" id="importBtn">Import</button>
            <button type="button" id="demoBtn">Demo</button>
            <button type="button" id="useCachedDataBtn">Use Cached</button>
            <button type="button" id="openImportedDataBtn">Open Imported</button>
            <a id="openImportedDataLink" href="/dashboard/student-personal-info.html">Open</a>
            <form id="portalForm"></form>
            <input id="regNumber" />
            <input id="portalPassword" />
            <input id="captchaInput" />
            <input id="sessionDisplay" />
            <input id="rememberRegNo" type="checkbox" />
            <button type="button" id="clearRememberedBtn">Clear</button>
            <div id="captchaShell"></div>
            <div id="captchaFrame"></div>
            <div id="connectionPill"></div>
            <div id="connectionMeta"></div>
            <div id="stepSession"></div>
            <div id="stepCredentials"></div>
            <div id="stepImport"></div>
        `;

        const api = {
            get: jest.fn((path) => {
                if (path === '/soa/status') {
                    return Promise.resolve({
                        portalEnabled: true,
                        connection: {
                            connected: false,
                            hasImportedData: false
                        }
                    });
                }

                if (path === '/soa/captcha') {
                    return Promise.reject({
                        data: {
                            status: 'PORTAL_UNREACHABLE',
                            connection: {
                                connected: false,
                                hasImportedData: false
                            }
                        }
                    });
                }

                return Promise.resolve({});
            }),
            post: jest.fn()
        };

        window.APP = global.APP = {
            API: api,
            Storage: {
                get: jest.fn((key) => {
                    if (key === 'user') {
                        return {
                            role: 'student',
                            registration_number: 'STU20250001'
                        };
                    }

                    return null;
                }),
                set: jest.fn()
            },
            isAuthenticated: jest.fn(() => true),
            navigateToDashboard: jest.fn(),
            sanitize: (value) => String(value || '')
        };
    });

    function loadConnectPortal() {
        jest.isolateModules(() => {
            require('../client/js/connect-portal.js');
        });

        document.dispatchEvent(new Event('DOMContentLoaded', { bubbles: true }));
    }

    it('shows an explicit SOA website offline message when captcha fetch fails', async () => {
        loadConnectPortal();
        await flushPromises();

        document.getElementById('startSessionBtn').dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        await flushPromises();

        const bannerText = document.getElementById('statusBanner').textContent;
        expect(bannerText).toContain('SOA website is currently offline.');
        expect(bannerText).toContain('Please try again later');
    });
});

describe('connect portal token expiry handling', () => {
    const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

    beforeEach(() => {
        jest.resetModules();
        localStorage.clear();
        sessionStorage.clear();

        document.body.innerHTML = `
            <div id="statusBanner" class="status-banner"></div>
            <button type="button" id="startSessionBtn">Fetch SOA CAPTCHA</button>
            <button type="button" id="refreshCaptchaBtn">Refresh</button>
            <button type="submit" id="importBtn">Import</button>
            <button type="button" id="demoBtn">Demo</button>
            <button type="button" id="useCachedDataBtn">Use Cached</button>
            <button type="button" id="openImportedDataBtn">Open Imported</button>
            <a id="openImportedDataLink" href="/dashboard/student-personal-info.html">Open</a>
            <form id="portalForm"></form>
            <input id="regNumber" />
            <input id="portalPassword" />
            <input id="captchaInput" />
            <input id="sessionDisplay" />
            <input id="rememberRegNo" type="checkbox" />
            <button type="button" id="clearRememberedBtn">Clear</button>
            <div id="captchaShell"></div>
            <div id="captchaFrame"></div>
            <div id="connectionPill"></div>
            <div id="connectionMeta"></div>
            <div id="stepSession"></div>
            <div id="stepCredentials"></div>
            <div id="stepImport"></div>
        `;

        const api = {
            get: jest.fn((path) => {
                if (path === '/soa/status') {
                    return Promise.resolve({
                        portalEnabled: true,
                        connection: {
                            connected: false,
                            hasImportedData: false
                        }
                    });
                }

                if (path === '/soa/captcha') {
                    return Promise.reject({
                        status: 401,
                        message: 'Token expired',
                        data: {
                            status: 'AUTH_REQUIRED',
                            message: 'Token expired'
                        }
                    });
                }

                return Promise.resolve({});
            }),
            post: jest.fn()
        };

        window.APP = global.APP = {
            API: api,
            Storage: {
                get: jest.fn((key) => {
                    if (key === 'user') {
                        return {
                            role: 'student',
                            registration_number: 'STU20250001'
                        };
                    }

                    return null;
                }),
                set: jest.fn()
            },
            isAuthenticated: jest.fn(() => true),
            navigateToDashboard: jest.fn(),
            sanitize: (value) => String(value || '')
        };
    });

    function loadConnectPortal() {
        jest.isolateModules(() => {
            require('../client/js/connect-portal.js');
        });

        document.dispatchEvent(new Event('DOMContentLoaded', { bubbles: true }));
    }

    it('shows token-expired detail instead of generic retry text when captcha fetch gets 401', async () => {
        loadConnectPortal();
        await flushPromises();

        document.getElementById('startSessionBtn').dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        await flushPromises();

        const bannerText = document.getElementById('statusBanner').textContent;
        expect(bannerText).toContain('Could not fetch a fresh SOA CAPTCHA.');
        expect(bannerText).toContain('Token expired');
    });
});
