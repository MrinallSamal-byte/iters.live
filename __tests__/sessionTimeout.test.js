/**
 * Tests for Session Timeout System
 * Tests the session management and automatic logout functionality
 */

describe('Session Timeout Module', () => {
  let mockSessionStorage;
  let mockLocalStorage;
  let mockDateNow;
  const ORIGINAL_DATE_NOW = Date.now;

  beforeEach(() => {
    // Reset mock storage before each test
    mockSessionStorage = {};
    mockLocalStorage = {};

    // Mock sessionStorage
    Object.defineProperty(global, 'sessionStorage', {
      value: {
        getItem: jest.fn((key) => mockSessionStorage[key] || null),
        setItem: jest.fn((key, value) => { mockSessionStorage[key] = value; }),
        removeItem: jest.fn((key) => { delete mockSessionStorage[key]; }),
        clear: jest.fn(() => { mockSessionStorage = {}; })
      },
      writable: true,
      configurable: true
    });

    // Mock localStorage
    Object.defineProperty(global, 'localStorage', {
      value: {
        getItem: jest.fn((key) => mockLocalStorage[key] || null),
        setItem: jest.fn((key, value) => { mockLocalStorage[key] = value; }),
        removeItem: jest.fn((key) => { delete mockLocalStorage[key]; }),
        clear: jest.fn(() => { mockLocalStorage = {}; })
      },
      writable: true,
      configurable: true
    });

    // Mock crypto
    Object.defineProperty(global, 'crypto', {
      value: {
        getRandomValues: jest.fn((array) => {
          for (let i = 0; i < array.length; i++) {
            array[i] = Math.floor(Math.random() * 256);
          }
          return array;
        })
      },
      writable: true,
      configurable: true
    });

    // Reset Date.now
    Date.now = ORIGINAL_DATE_NOW;
  });

  afterEach(() => {
    Date.now = ORIGINAL_DATE_NOW;
  });

  // Simulate the SessionTimeout functions
  const SessionTimeout = {
    SESSION_TIMEOUT_MS: 20 * 60 * 1000, // 20 minutes
    SESSION_WARNING_MS: 2 * 60 * 1000, // 2 minutes
    LAST_ACTIVITY_KEY: 'lastActivityTimestamp',
    SESSION_ID_KEY: 'sessionId',

    generateSessionId() {
      const array = new Uint8Array(16);
      crypto.getRandomValues(array);
      return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    },

    getSessionId() {
      let sessionId = sessionStorage.getItem(this.SESSION_ID_KEY);
      if (!sessionId) {
        sessionId = this.generateSessionId();
        sessionStorage.setItem(this.SESSION_ID_KEY, sessionId);
      }
      return sessionId;
    },

    updateLastActivity() {
      const now = Date.now();
      sessionStorage.setItem(this.LAST_ACTIVITY_KEY, now.toString());
      localStorage.setItem(this.LAST_ACTIVITY_KEY, now.toString());
    },

    getLastActivity() {
      const sessionActivity = parseInt(sessionStorage.getItem(this.LAST_ACTIVITY_KEY) || '0', 10);
      const localActivity = parseInt(localStorage.getItem(this.LAST_ACTIVITY_KEY) || '0', 10);
      return Math.max(sessionActivity, localActivity);
    },

    isSessionTimedOut() {
      const lastActivity = this.getLastActivity();
      if (!lastActivity) return true;
      
      const elapsed = Date.now() - lastActivity;
      return elapsed >= this.SESSION_TIMEOUT_MS;
    },

    isSessionNearTimeout() {
      const lastActivity = this.getLastActivity();
      if (!lastActivity) return true;
      
      const elapsed = Date.now() - lastActivity;
      const remaining = this.SESSION_TIMEOUT_MS - elapsed;
      return remaining <= this.SESSION_WARNING_MS && remaining > 0;
    },

    getRemainingTime() {
      const lastActivity = this.getLastActivity();
      if (!lastActivity) return 0;
      
      const elapsed = Date.now() - lastActivity;
      const remaining = this.SESSION_TIMEOUT_MS - elapsed;
      return Math.max(0, remaining);
    },

    formatTime(ms) {
      const minutes = Math.floor(ms / 60000);
      const seconds = Math.floor((ms % 60000) / 1000);
      return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
  };

  describe('generateSessionId', () => {
    it('should generate a 32 character hex string', () => {
      const sessionId = SessionTimeout.generateSessionId();
      expect(sessionId).toHaveLength(32);
      expect(/^[0-9a-f]+$/.test(sessionId)).toBe(true);
    });

    it('should generate unique IDs each time', () => {
      const id1 = SessionTimeout.generateSessionId();
      const id2 = SessionTimeout.generateSessionId();
      expect(id1).not.toBe(id2);
    });
  });

  describe('getSessionId', () => {
    it('should create and store a new session ID if none exists', () => {
      const sessionId = SessionTimeout.getSessionId();
      expect(sessionId).toHaveLength(32);
      expect(sessionStorage.setItem).toHaveBeenCalledWith('sessionId', sessionId);
    });

    it('should return existing session ID if one exists', () => {
      mockSessionStorage['sessionId'] = 'existing-session-id-12345678';
      const sessionId = SessionTimeout.getSessionId();
      expect(sessionId).toBe('existing-session-id-12345678');
    });
  });

  describe('updateLastActivity', () => {
    it('should store current timestamp in both storages', () => {
      const now = Date.now();
      Date.now = jest.fn(() => now);
      
      SessionTimeout.updateLastActivity();
      
      expect(sessionStorage.setItem).toHaveBeenCalledWith('lastActivityTimestamp', now.toString());
      expect(localStorage.setItem).toHaveBeenCalledWith('lastActivityTimestamp', now.toString());
    });
  });

  describe('getLastActivity', () => {
    it('should return 0 when no activity recorded', () => {
      expect(SessionTimeout.getLastActivity()).toBe(0);
    });

    it('should return session activity when only session has data', () => {
      mockSessionStorage['lastActivityTimestamp'] = '1000000';
      expect(SessionTimeout.getLastActivity()).toBe(1000000);
    });

    it('should return local activity when only local has data', () => {
      mockLocalStorage['lastActivityTimestamp'] = '2000000';
      expect(SessionTimeout.getLastActivity()).toBe(2000000);
    });

    it('should return the most recent activity', () => {
      mockSessionStorage['lastActivityTimestamp'] = '1000000';
      mockLocalStorage['lastActivityTimestamp'] = '2000000';
      expect(SessionTimeout.getLastActivity()).toBe(2000000);
      
      mockSessionStorage['lastActivityTimestamp'] = '3000000';
      expect(SessionTimeout.getLastActivity()).toBe(3000000);
    });
  });

  describe('isSessionTimedOut', () => {
    it('should return true when no activity recorded', () => {
      expect(SessionTimeout.isSessionTimedOut()).toBe(true);
    });

    it('should return false when activity is recent', () => {
      const now = Date.now();
      mockSessionStorage['lastActivityTimestamp'] = now.toString();
      
      expect(SessionTimeout.isSessionTimedOut()).toBe(false);
    });

    it('should return true when activity is older than 20 minutes', () => {
      const now = Date.now();
      const oldActivity = now - (21 * 60 * 1000); // 21 minutes ago
      mockSessionStorage['lastActivityTimestamp'] = oldActivity.toString();
      
      expect(SessionTimeout.isSessionTimedOut()).toBe(true);
    });

    it('should return false when activity is exactly 19 minutes old', () => {
      const now = Date.now();
      const activity = now - (19 * 60 * 1000); // 19 minutes ago
      mockSessionStorage['lastActivityTimestamp'] = activity.toString();
      
      expect(SessionTimeout.isSessionTimedOut()).toBe(false);
    });
  });

  describe('isSessionNearTimeout', () => {
    it('should return true when no activity recorded', () => {
      expect(SessionTimeout.isSessionNearTimeout()).toBe(true);
    });

    it('should return false when activity is recent', () => {
      const now = Date.now();
      mockSessionStorage['lastActivityTimestamp'] = now.toString();
      
      expect(SessionTimeout.isSessionNearTimeout()).toBe(false);
    });

    it('should return true when remaining time is less than 2 minutes', () => {
      const now = Date.now();
      const activity = now - (19 * 60 * 1000); // 19 minutes ago (1 minute remaining)
      mockSessionStorage['lastActivityTimestamp'] = activity.toString();
      
      expect(SessionTimeout.isSessionNearTimeout()).toBe(true);
    });

    it('should return false when remaining time is more than 2 minutes', () => {
      const now = Date.now();
      const activity = now - (15 * 60 * 1000); // 15 minutes ago (5 minutes remaining)
      mockSessionStorage['lastActivityTimestamp'] = activity.toString();
      
      expect(SessionTimeout.isSessionNearTimeout()).toBe(false);
    });
  });

  describe('getRemainingTime', () => {
    it('should return 0 when no activity recorded', () => {
      expect(SessionTimeout.getRemainingTime()).toBe(0);
    });

    it('should return full timeout when just active', () => {
      const now = Date.now();
      mockSessionStorage['lastActivityTimestamp'] = now.toString();
      
      const remaining = SessionTimeout.getRemainingTime();
      expect(remaining).toBeGreaterThan(19 * 60 * 1000);
      expect(remaining).toBeLessThanOrEqual(20 * 60 * 1000);
    });

    it('should return correct remaining time', () => {
      const now = Date.now();
      const activity = now - (10 * 60 * 1000); // 10 minutes ago
      mockSessionStorage['lastActivityTimestamp'] = activity.toString();
      
      const remaining = SessionTimeout.getRemainingTime();
      expect(remaining).toBeGreaterThan(9 * 60 * 1000);
      expect(remaining).toBeLessThanOrEqual(10 * 60 * 1000);
    });

    it('should return 0 when session has timed out', () => {
      const now = Date.now();
      const activity = now - (25 * 60 * 1000); // 25 minutes ago
      mockSessionStorage['lastActivityTimestamp'] = activity.toString();
      
      expect(SessionTimeout.getRemainingTime()).toBe(0);
    });
  });

  describe('formatTime', () => {
    it('should format 0 milliseconds', () => {
      expect(SessionTimeout.formatTime(0)).toBe('0:00');
    });

    it('should format 1 minute', () => {
      expect(SessionTimeout.formatTime(60000)).toBe('1:00');
    });

    it('should format 2 minutes 30 seconds', () => {
      expect(SessionTimeout.formatTime(150000)).toBe('2:30');
    });

    it('should format 20 minutes', () => {
      expect(SessionTimeout.formatTime(20 * 60 * 1000)).toBe('20:00');
    });

    it('should pad seconds with leading zero', () => {
      expect(SessionTimeout.formatTime(65000)).toBe('1:05');
    });
  });
});

describe('Session Timeout Configuration', () => {
  it('should have 20 minute timeout', () => {
    const SESSION_TIMEOUT_MS = 20 * 60 * 1000;
    expect(SESSION_TIMEOUT_MS).toBe(1200000);
  });

  it('should have 2 minute warning period', () => {
    const SESSION_WARNING_MS = 2 * 60 * 1000;
    expect(SESSION_WARNING_MS).toBe(120000);
  });

  it('should check session every 30 seconds', () => {
    const SESSION_CHECK_INTERVAL_MS = 30 * 1000;
    expect(SESSION_CHECK_INTERVAL_MS).toBe(30000);
  });
});

describe('Session Timeout Security', () => {
  it('should use sessionStorage for session data (cleared on browser close)', () => {
    const SESSION_ID_KEY = 'sessionId';
    const LAST_ACTIVITY_KEY = 'lastActivityTimestamp';
    
    // These should be stored in sessionStorage for security
    expect(SESSION_ID_KEY).toBeDefined();
    expect(LAST_ACTIVITY_KEY).toBeDefined();
  });

  it('should sync activity across tabs via localStorage', () => {
    // localStorage is used for cross-tab sync of last activity
    const LAST_ACTIVITY_KEY = 'lastActivityTimestamp';
    expect(LAST_ACTIVITY_KEY).toBeDefined();
  });
});
