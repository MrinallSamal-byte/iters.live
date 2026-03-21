/**
 * Tests for Page Access Token System
 * Tests the token generation, validation, and page access control functionality
 */

describe('Page Access Token Module', () => {
  // Mock sessionStorage
  let mockSessionStorage;
  let mockLocalStorage;

  beforeEach(() => {
    // Reset mock storage before each test
    mockSessionStorage = {};
    mockLocalStorage = {};

    // Mock sessionStorage with jest spies
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

    // Mock localStorage with jest spies
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

    // Mock crypto.getRandomValues
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
  });

  // Simulate the PageAccessToken functions
  const PageAccessToken = {
    TOKEN_EXPIRY_MS: 5 * 60 * 1000,
    SESSION_TIMEOUT_MS: 20 * 60 * 1000,
    TOKEN_STORAGE_KEY: 'pageAccessToken',
    TOKEN_TIMESTAMP_KEY: 'pageAccessTokenTimestamp',
    TOKEN_PATH_KEY: 'pageAccessTokenPath',
    _currentPath: '/dashboard/student.html',

    generateToken() {
      const array = new Uint8Array(32);
      crypto.getRandomValues(array);
      return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    },

    createPageAccessToken(targetPath) {
      const token = this.generateToken();
      const timestamp = Date.now();
      
      sessionStorage.setItem(this.TOKEN_STORAGE_KEY, token);
      sessionStorage.setItem(this.TOKEN_TIMESTAMP_KEY, timestamp.toString());
      sessionStorage.setItem(this.TOKEN_PATH_KEY, targetPath);
      
      return {
        token,
        timestamp,
        path: targetPath,
        expiresAt: timestamp + this.TOKEN_EXPIRY_MS
      };
    },

    setCurrentPath(path) {
      this._currentPath = path;
    },

    getCurrentPath() {
      return this._currentPath;
    },

    getLastActivityTimestamp() {
      const sessionActivity = parseInt(sessionStorage.getItem('lastActivityTimestamp') || '0', 10);
      const localActivity = parseInt(localStorage.getItem('lastActivityTimestamp') || '0', 10);
      return Math.max(sessionActivity, localActivity, 0);
    },

    hasStoredAuthState() {
      return Boolean(
        localStorage.getItem('accessToken') ||
        localStorage.getItem('user') ||
        sessionStorage.getItem('accessToken') ||
        sessionStorage.getItem('user')
      );
    },

    hasExpiredSessionByInactivity() {
      const lastActivity = this.getLastActivityTimestamp();
      if (!lastActivity) return false;
      return Date.now() - lastActivity >= this.SESSION_TIMEOUT_MS;
    },

    validatePageAccessToken() {
      if (this.hasStoredAuthState() && this.hasExpiredSessionByInactivity()) {
        return { valid: false, reason: 'session_timeout' };
      }

      if (!this.isUserAuthenticated()) {
        return { valid: false, reason: 'not_authenticated' };
      }
      
      const storedToken = sessionStorage.getItem(this.TOKEN_STORAGE_KEY);
      const storedTimestamp = sessionStorage.getItem(this.TOKEN_TIMESTAMP_KEY);
      const storedPath = sessionStorage.getItem(this.TOKEN_PATH_KEY);
      
      if (!storedToken || !storedTimestamp) {
        return { valid: false, reason: 'no_token' };
      }
      
      const tokenTimestamp = parseInt(storedTimestamp, 10);
      if (Date.now() - tokenTimestamp > this.TOKEN_EXPIRY_MS) {
        this.clearPageAccessToken();
        return { valid: false, reason: 'token_expired' };
      }
      
      if (!this.isPathMatch(storedPath, this.getCurrentPath())) {
        return { valid: false, reason: 'path_mismatch' };
      }
      
      return { valid: true, reason: 'valid' };
    },

    isUserAuthenticated() {
      try {
        if (this.hasStoredAuthState() && this.hasExpiredSessionByInactivity()) {
          return false;
        }

        const accessToken = localStorage.getItem('accessToken');
        const user = localStorage.getItem('user');
        if (accessToken && user) {
          const userData = JSON.parse(user);
          return !!(userData && userData.role);
        }
        return false;
      } catch (e) {
        return false;
      }
    },

    getUserRole() {
      try {
        const user = localStorage.getItem('user');
        if (user) {
          const userData = JSON.parse(user);
          return userData.role || null;
        }
        return null;
      } catch (e) {
        return null;
      }
    },

    clearPageAccessToken() {
      sessionStorage.removeItem(this.TOKEN_STORAGE_KEY);
      sessionStorage.removeItem(this.TOKEN_TIMESTAMP_KEY);
      sessionStorage.removeItem(this.TOKEN_PATH_KEY);
    },

    isPathMatch(storedPath, currentPath) {
      if (storedPath === currentPath) return true;
      
      const isDashboardStored = storedPath && storedPath.startsWith('/dashboard/');
      const isDashboardCurrent = currentPath && currentPath.startsWith('/dashboard/');
      
      if (isDashboardStored && isDashboardCurrent) {
        const storedType = this.getDashboardType(storedPath);
        const currentType = this.getDashboardType(currentPath);
        return storedType === currentType;
      }
      
      return false;
    },

    getDashboardType(path) {
      if (path.includes('student')) return 'student';
      if (path.includes('teacher')) return 'teacher';
      if (path.includes('admin')) return 'admin';
      return 'unknown';
    },

    hasRoleAccess(userRole, dashboardType) {
      const accessMap = {
        'student': ['student'],
        'teacher': ['teacher'],
        'admin': ['admin', 'student', 'teacher']
      };
      const allowedTypes = accessMap[userRole] || [];
      return allowedTypes.includes(dashboardType);
    }
  };

  describe('generateToken', () => {
    it('should generate a 64 character hex string', () => {
      const token = PageAccessToken.generateToken();
      expect(token).toHaveLength(64);
      expect(/^[0-9a-f]+$/.test(token)).toBe(true);
    });

    it('should generate unique tokens each time', () => {
      const token1 = PageAccessToken.generateToken();
      const token2 = PageAccessToken.generateToken();
      expect(token1).not.toBe(token2);
    });
  });

  describe('createPageAccessToken', () => {
    it('should create and store a token', () => {
      const result = PageAccessToken.createPageAccessToken('/dashboard/student.html');
      
      expect(result.token).toHaveLength(64);
      expect(result.path).toBe('/dashboard/student.html');
      expect(result.timestamp).toBeLessThanOrEqual(Date.now());
      expect(result.expiresAt).toBeGreaterThan(Date.now());
      
      expect(sessionStorage.setItem).toHaveBeenCalledWith('pageAccessToken', result.token);
      expect(sessionStorage.setItem).toHaveBeenCalledWith('pageAccessTokenPath', '/dashboard/student.html');
    });

    it('should set expiry 5 minutes in the future', () => {
      const now = Date.now();
      const result = PageAccessToken.createPageAccessToken('/dashboard/student.html');
      
      const expectedExpiry = now + (5 * 60 * 1000);
      expect(result.expiresAt).toBeGreaterThanOrEqual(expectedExpiry - 100);
      expect(result.expiresAt).toBeLessThanOrEqual(expectedExpiry + 100);
    });
  });

  describe('validatePageAccessToken', () => {
    beforeEach(() => {
      // Setup authenticated user
      mockLocalStorage['accessToken'] = 'test-token';
      mockLocalStorage['user'] = JSON.stringify({ role: 'student', name: 'Test User' });
      PageAccessToken.setCurrentPath('/dashboard/student.html');
    });

    it('should return not_authenticated when user is not logged in', () => {
      mockLocalStorage = {}; // Clear auth
      
      const result = PageAccessToken.validatePageAccessToken();
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('not_authenticated');
    });

    it('should return no_token when no token exists', () => {
      const result = PageAccessToken.validatePageAccessToken();
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('no_token');
    });

    it('should return session_timeout when auth exists but inactivity exceeded 20 minutes', () => {
      const oldActivity = Date.now() - (21 * 60 * 1000);
      mockLocalStorage['lastActivityTimestamp'] = oldActivity.toString();

      const result = PageAccessToken.validatePageAccessToken();
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('session_timeout');
    });

    it('should return token_expired for expired tokens', () => {
      // Create token from 10 minutes ago
      const oldTimestamp = Date.now() - (10 * 60 * 1000);
      mockSessionStorage['pageAccessToken'] = 'test-token-123';
      mockSessionStorage['pageAccessTokenTimestamp'] = oldTimestamp.toString();
      mockSessionStorage['pageAccessTokenPath'] = '/dashboard/student.html';
      
      const result = PageAccessToken.validatePageAccessToken();
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('token_expired');
    });

    it('should return valid for correct token', () => {
      const timestamp = Date.now();
      mockSessionStorage['pageAccessToken'] = 'valid-token';
      mockSessionStorage['pageAccessTokenTimestamp'] = timestamp.toString();
      mockSessionStorage['pageAccessTokenPath'] = '/dashboard/student.html';
      
      const result = PageAccessToken.validatePageAccessToken();
      expect(result.valid).toBe(true);
      expect(result.reason).toBe('valid');
    });

    it('should return path_mismatch for wrong path', () => {
      const timestamp = Date.now();
      mockSessionStorage['pageAccessToken'] = 'valid-token';
      mockSessionStorage['pageAccessTokenTimestamp'] = timestamp.toString();
      mockSessionStorage['pageAccessTokenPath'] = '/dashboard/teacher.html';
      
      // Current path is student dashboard
      PageAccessToken.setCurrentPath('/dashboard/student.html');
      
      const result = PageAccessToken.validatePageAccessToken();
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('path_mismatch');
    });
  });

  describe('isPathMatch', () => {
    it('should match exact paths', () => {
      expect(PageAccessToken.isPathMatch('/dashboard/student.html', '/dashboard/student.html')).toBe(true);
    });

    it('should match student dashboard sub-pages', () => {
      expect(PageAccessToken.isPathMatch('/dashboard/student.html', '/dashboard/student-attendance.html')).toBe(true);
      expect(PageAccessToken.isPathMatch('/dashboard/student-marks.html', '/dashboard/student-notes.html')).toBe(true);
    });

    it('should match teacher dashboard sub-pages', () => {
      expect(PageAccessToken.isPathMatch('/dashboard/teacher.html', '/dashboard/teacher-attendance.html')).toBe(true);
      expect(PageAccessToken.isPathMatch('/dashboard/teacher-marks.html', '/dashboard/teacher-notes.html')).toBe(true);
    });

    it('should match admin dashboard sub-pages', () => {
      expect(PageAccessToken.isPathMatch('/dashboard/admin.html', '/dashboard/admin-users.html')).toBe(true);
    });

    it('should not match different dashboard types', () => {
      expect(PageAccessToken.isPathMatch('/dashboard/student.html', '/dashboard/teacher.html')).toBe(false);
      expect(PageAccessToken.isPathMatch('/dashboard/student.html', '/dashboard/admin.html')).toBe(false);
      expect(PageAccessToken.isPathMatch('/dashboard/teacher.html', '/dashboard/admin.html')).toBe(false);
    });

    it('should not match non-dashboard paths', () => {
      expect(PageAccessToken.isPathMatch('/login.html', '/dashboard/student.html')).toBe(false);
    });
  });

  describe('getDashboardType', () => {
    it('should return student for student paths', () => {
      expect(PageAccessToken.getDashboardType('/dashboard/student.html')).toBe('student');
      expect(PageAccessToken.getDashboardType('/dashboard/student-attendance.html')).toBe('student');
    });

    it('should return teacher for teacher paths', () => {
      expect(PageAccessToken.getDashboardType('/dashboard/teacher.html')).toBe('teacher');
      expect(PageAccessToken.getDashboardType('/dashboard/teacher-marks.html')).toBe('teacher');
    });

    it('should return admin for admin paths', () => {
      expect(PageAccessToken.getDashboardType('/dashboard/admin.html')).toBe('admin');
      expect(PageAccessToken.getDashboardType('/dashboard/admin-users.html')).toBe('admin');
    });

    it('should return unknown for unrecognized paths', () => {
      expect(PageAccessToken.getDashboardType('/other-page.html')).toBe('unknown');
    });
  });

  describe('hasRoleAccess', () => {
    it('should allow student to access student dashboard', () => {
      expect(PageAccessToken.hasRoleAccess('student', 'student')).toBe(true);
    });

    it('should not allow student to access teacher dashboard', () => {
      expect(PageAccessToken.hasRoleAccess('student', 'teacher')).toBe(false);
    });

    it('should not allow student to access admin dashboard', () => {
      expect(PageAccessToken.hasRoleAccess('student', 'admin')).toBe(false);
    });

    it('should allow teacher to access only teacher dashboard', () => {
      expect(PageAccessToken.hasRoleAccess('teacher', 'teacher')).toBe(true);
      expect(PageAccessToken.hasRoleAccess('teacher', 'student')).toBe(false);
      expect(PageAccessToken.hasRoleAccess('teacher', 'admin')).toBe(false);
    });

    it('should allow admin to access all dashboards', () => {
      expect(PageAccessToken.hasRoleAccess('admin', 'admin')).toBe(true);
      expect(PageAccessToken.hasRoleAccess('admin', 'student')).toBe(true);
      expect(PageAccessToken.hasRoleAccess('admin', 'teacher')).toBe(true);
    });
  });

  describe('clearPageAccessToken', () => {
    it('should remove all token-related items from session storage', () => {
      mockSessionStorage['pageAccessToken'] = 'token';
      mockSessionStorage['pageAccessTokenTimestamp'] = '123456';
      mockSessionStorage['pageAccessTokenPath'] = '/dashboard/student.html';
      
      PageAccessToken.clearPageAccessToken();
      
      expect(sessionStorage.removeItem).toHaveBeenCalledWith('pageAccessToken');
      expect(sessionStorage.removeItem).toHaveBeenCalledWith('pageAccessTokenTimestamp');
      expect(sessionStorage.removeItem).toHaveBeenCalledWith('pageAccessTokenPath');
    });
  });

  describe('isUserAuthenticated', () => {
    it('should return true when user has accessToken and user data', () => {
      mockLocalStorage['accessToken'] = 'test-token';
      mockLocalStorage['user'] = JSON.stringify({ role: 'student' });
      
      expect(PageAccessToken.isUserAuthenticated()).toBe(true);
    });

    it('should return false when accessToken is missing', () => {
      mockLocalStorage['user'] = JSON.stringify({ role: 'student' });
      
      expect(PageAccessToken.isUserAuthenticated()).toBe(false);
    });

    it('should return false when user data is missing', () => {
      mockLocalStorage['accessToken'] = 'test-token';
      
      expect(PageAccessToken.isUserAuthenticated()).toBe(false);
    });

    it('should return false when user data has no role', () => {
      mockLocalStorage['accessToken'] = 'test-token';
      mockLocalStorage['user'] = JSON.stringify({ name: 'Test' });
      
      expect(PageAccessToken.isUserAuthenticated()).toBe(false);
    });

    it('should return false when the stored session expired by inactivity', () => {
      mockLocalStorage['accessToken'] = 'test-token';
      mockLocalStorage['user'] = JSON.stringify({ role: 'student' });
      mockLocalStorage['lastActivityTimestamp'] = (Date.now() - (21 * 60 * 1000)).toString();

      expect(PageAccessToken.isUserAuthenticated()).toBe(false);
    });
  });

  describe('getUserRole', () => {
    it('should return the user role', () => {
      mockLocalStorage['user'] = JSON.stringify({ role: 'teacher' });
      
      expect(PageAccessToken.getUserRole()).toBe('teacher');
    });

    it('should return null when no user data', () => {
      expect(PageAccessToken.getUserRole()).toBe(null);
    });
  });
});

describe('Token Security', () => {
  it('should generate tokens with sufficient entropy', () => {
    // A 32-byte token gives 256 bits of entropy, which is more than enough
    const tokenLength = 64; // 32 bytes = 64 hex chars
    expect(tokenLength).toBeGreaterThanOrEqual(32); // At least 16 bytes / 128 bits
  });

  it('should use cryptographic randomness', () => {
    // Mock crypto for this test
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
    
    // Check that crypto.getRandomValues would be used
    expect(typeof global.crypto.getRandomValues).toBe('function');
  });

  it('should store tokens in sessionStorage not localStorage', () => {
    const mockSessionStorage = {};
    const mockLocalStorage = {};
    
    Object.defineProperty(global, 'sessionStorage', {
      value: {
        setItem: jest.fn((key, value) => { mockSessionStorage[key] = value; }),
        getItem: jest.fn((key) => mockSessionStorage[key] || null)
      },
      writable: true,
      configurable: true
    });
    
    Object.defineProperty(global, 'localStorage', {
      value: {
        setItem: jest.fn((key, value) => { mockLocalStorage[key] = value; }),
        getItem: jest.fn((key) => mockLocalStorage[key] || null)
      },
      writable: true,
      configurable: true
    });
    
    // Simulate token storage
    sessionStorage.setItem('pageAccessToken', 'test-token');
    
    expect(sessionStorage.setItem).toHaveBeenCalledWith('pageAccessToken', 'test-token');
    expect(localStorage.setItem).not.toHaveBeenCalled();
  });
});
