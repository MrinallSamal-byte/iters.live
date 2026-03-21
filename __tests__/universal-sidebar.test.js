/**
 * @jest-environment jsdom
 */

describe('universal sidebar mobile navigation', () => {
    const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

    beforeEach(() => {
        jest.resetModules();
        localStorage.clear();
        sessionStorage.clear();

        document.body.innerHTML = '<main class="dashboard-main"></main>';

        Object.defineProperty(window, 'innerWidth', {
            configurable: true,
            writable: true,
            value: 390
        });

        window.APP = global.APP = {
            navigateToDashboard: jest.fn()
        };
        window.LinkEncoding = global.LinkEncoding = {
            navigateTo: jest.fn()
        };

        localStorage.setItem('user', JSON.stringify({
            name: 'Rahul Chatterjee',
            role: 'student'
        }));
    });

    function loadSidebar() {
        jest.isolateModules(() => {
            require('../client/js/universal-sidebar.js');
        });

        document.dispatchEvent(new Event('DOMContentLoaded', { bubbles: true }));
    }

    it('routes dashboard links through secure app navigation and closes the mobile sidebar', async () => {
        loadSidebar();
        await flushPromises();

        const sidebar = document.getElementById('universalSidebar');
        const overlay = document.getElementById('sidebarOverlay');
        const toggle = document.getElementById('mobileSidebarToggle');

        toggle.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        expect(sidebar.classList.contains('mobile-open')).toBe(true);
        expect(overlay.classList.contains('active')).toBe(true);

        const attendanceLink = document.querySelector('.sidebar-nav-link[data-page="attendance"]');
        const dispatchResult = attendanceLink.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

        expect(dispatchResult).toBe(false);
        expect(window.APP.navigateToDashboard).toHaveBeenCalledWith('/dashboard/student-attendance.html');
        expect(sidebar.classList.contains('mobile-open')).toBe(false);
        expect(overlay.classList.contains('active')).toBe(false);
    });

    it('routes touch interactions once for non-dashboard links on mobile', async () => {
        loadSidebar();
        await flushPromises();

        const link = document.querySelector('.sidebar-nav-link[data-page="connect-portal"]');
        link.dispatchEvent(new Event('touchend', { bubbles: true, cancelable: true }));
        link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

        expect(window.LinkEncoding.navigateTo).toHaveBeenCalledTimes(1);
        expect(window.LinkEncoding.navigateTo).toHaveBeenCalledWith('/connect-portal.html');
    });
});
