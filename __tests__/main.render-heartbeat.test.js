/**
 * @jest-environment jsdom
 */

describe('main.js Render heartbeat', () => {
    let visibilityState = 'visible';

    async function flushPromises() {
        await Promise.resolve();
        await Promise.resolve();
    }

    function loadMain() {
        jest.isolateModules(() => {
            require('../client/js/main.js');
        });

        document.dispatchEvent(new Event('DOMContentLoaded'));
    }

    beforeEach(() => {
        jest.resetModules();
        jest.useFakeTimers();

        document.body.className = '';
        document.body.innerHTML = '<main>Heartbeat test</main>';
        document.documentElement.removeAttribute('data-render-heartbeat-status');

        visibilityState = 'visible';
        Object.defineProperty(document, 'visibilityState', {
            configurable: true,
            get: () => visibilityState
        });

        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            status: 200
        });

        global.IntersectionObserver = class {
            observe() {}
            unobserve() {}
            disconnect() {}
        };

        window.scrollTo = jest.fn();

        delete window.APP;
        delete window.__renderHeartbeatInitialized;
    });

    afterEach(() => {
        jest.clearAllTimers();
        jest.useRealTimers();

        delete global.fetch;
        delete global.IntersectionObserver;
        delete window.APP;
        delete window.__renderHeartbeatInitialized;
    });

    it('pings the health endpoint immediately and schedules the keep-alive interval', async () => {
        loadMain();
        await flushPromises();

        expect(global.fetch).toHaveBeenCalledWith(
            'http://localhost:5000/health',
            expect.objectContaining({
                method: 'GET',
                cache: 'no-store',
                keepalive: true
            })
        );

        expect(window.APP.RenderHeartbeat.getState()).toEqual(expect.objectContaining({
            enabled: true,
            endpoint: 'http://localhost:5000/health',
            intervalMs: 14 * 60 * 1000,
            status: 'active'
        }));
        expect(document.documentElement.dataset.renderHeartbeatStatus).toBe('active');
        expect(jest.getTimerCount()).toBe(1);
    });

    it('pauses when the tab is hidden and resumes with a fresh ping when visible again', async () => {
        loadMain();
        await flushPromises();

        global.fetch.mockClear();

        visibilityState = 'hidden';
        document.dispatchEvent(new Event('visibilitychange'));

        expect(jest.getTimerCount()).toBe(0);

        jest.advanceTimersByTime(14 * 60 * 1000);
        expect(global.fetch).not.toHaveBeenCalled();

        visibilityState = 'visible';
        document.dispatchEvent(new Event('visibilitychange'));
        await flushPromises();

        expect(global.fetch).toHaveBeenCalledTimes(1);
        expect(jest.getTimerCount()).toBe(1);
    });
});
