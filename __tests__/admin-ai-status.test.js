/**
 * @jest-environment jsdom
 */

describe('admin dashboard AI status panel', () => {
  async function flushPromises() {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  }

  function buildAdminDom() {
    document.body.innerHTML = `
      <span id="adminName"></span>
      <button id="refreshAiStatusBtn" type="button">Refresh</button>
      <span id="aiServiceCheckedAt"></span>
      <span id="aiServiceStatusText"></span>
      <span id="aiServiceStatusBadge"></span>
      <span id="aiOpenRouterState"></span>
      <span id="aiOpenRouterBadge"></span>
      <span id="aiGeminiState"></span>
      <span id="aiGeminiBadge"></span>
      <strong id="aiDiagnosticsText"></strong>
      <a id="aiDiagnosticsLink" href="/api/health/ai-service">Open JSON status</a>
      <p id="aiServiceSummary"></p>
      <div id="aiServiceRecommendations"></div>
      <div id="recentActivity"></div>
      <span id="approvalCount"></span>
      <table><tbody id="approvalsTableBody"></tbody></table>
      <div id="totalUsers"></div>
      <div id="totalStudents"></div>
      <div id="totalTeachers"></div>
      <div id="pendingApprovals"></div>
      <div id="totalFiles"></div>
      <div id="totalAssignments"></div>
      <div id="totalEvents"></div>
      <div id="avgAttendance"></div>
      <canvas id="userChart"></canvas>
      <canvas id="deptChart"></canvas>
    `;
  }

  function mockAppApi() {
    return {
      get: jest.fn(async (path) => {
        if (path === '/admin/stats') {
          return {
            data: {
              totalUsers: 10,
              totalStudents: 8,
              totalTeachers: 1,
              totalAdmins: 1,
              pendingApprovals: 2,
              totalFiles: 5,
              totalAssignments: 4,
              totalEvents: 3,
              avgAttendance: 91,
              departments: [
                { name: 'CSE', count: 5 }
              ]
            }
          };
        }

        if (path === '/admin/approvals') {
          return {
            data: [
              {
                id: 1,
                type: 'notes',
                uploaded_by: 'Admin',
                title: 'Sample',
                created_at: new Date().toISOString()
              }
            ]
          };
        }

        throw new Error(`Unexpected APP.API.get path: ${path}`);
      })
    };
  }

  beforeEach(() => {
    jest.resetModules();
    jest.useFakeTimers();
    buildAdminDom();

    const api = mockAppApi();
    global.APP = {
      isAuthenticated: () => true,
      getUserRole: () => 'admin',
      Storage: {
        get: (key) => {
          if (key === 'user') {
            return { name: 'Admin User', role: 'admin' };
          }
          return null;
        }
      },
      API: api
    };
    window.APP = global.APP;

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 'available',
        timestamp: '2026-03-21T10:15:00.000Z',
        services: {
          openRouter: {
            configured: true,
            available: true
          },
          gemini: {
            configured: false
          }
        },
        recommendations: []
      })
    });
    window.fetch = global.fetch;

    global.Chart = undefined;
    window.Chart = undefined;
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    delete global.APP;
    delete window.APP;
    delete global.fetch;
    delete window.fetch;
    delete global.Chart;
    delete window.Chart;
  });

  it('renders live AI availability details in the admin panel', async () => {
    jest.isolateModules(() => {
      require('../client/js/admin.js');
    });

    document.dispatchEvent(new Event('DOMContentLoaded'));
    await flushPromises();

    expect(global.fetch).toHaveBeenCalledWith('/api/health/ai-service', expect.objectContaining({
      method: 'GET',
      cache: 'no-store',
      credentials: 'same-origin'
    }));
    expect(document.getElementById('adminName').textContent).toBe('Admin User');
    expect(document.getElementById('aiServiceStatusText').textContent).toBe('AI replies should be available');
    expect(document.getElementById('aiServiceStatusBadge').textContent).toBe('Available');
    expect(document.getElementById('aiOpenRouterState').textContent).toBe('Configured and available');
    expect(document.getElementById('aiGeminiState').textContent).toBe('Not configured');
    expect(document.getElementById('aiServiceRecommendations').textContent).toContain('No immediate action needed');
    expect(document.getElementById('refreshAiStatusBtn').textContent).toBe('Refresh');
  });
});
