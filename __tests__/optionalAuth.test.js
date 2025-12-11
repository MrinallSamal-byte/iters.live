/**
 * Tests for optionalAuth Middleware
 * Verifies that the middleware handles invalid/expired tokens gracefully
 * and always allows the request to proceed (never returns 401)
 */

// Mock Firebase admin
const mockAuth = {
  verifyIdToken: jest.fn()
};

const mockDb = {
  collection: jest.fn(() => ({
    doc: jest.fn(() => ({
      get: jest.fn()
    }))
  }))
};

// Mock the firebase module
jest.mock('../server/database/firebase', () => ({
  auth: mockAuth,
  db: mockDb
}));

describe('optionalAuth Middleware', () => {
  let optionalAuth;
  let req, res, next;

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    
    // Re-require the middleware to get fresh instance
    jest.resetModules();
    const authMiddleware = require('../server/middleware/auth');
    optionalAuth = authMiddleware.optionalAuth;

    // Mock request, response, and next
    req = {
      headers: {},
      user: undefined
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    next = jest.fn();
  });

  describe('Guest Users (No Token)', () => {
    it('should proceed without token', async () => {
      await optionalAuth(req, res, next);
      
      expect(next).toHaveBeenCalledTimes(1);
      expect(req.user).toBeUndefined();
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });

    it('should proceed with empty authorization header', async () => {
      req.headers.authorization = '';
      
      await optionalAuth(req, res, next);
      
      expect(next).toHaveBeenCalledTimes(1);
      expect(req.user).toBeUndefined();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should proceed with malformed authorization header', async () => {
      req.headers.authorization = 'InvalidFormat token123';
      
      await optionalAuth(req, res, next);
      
      expect(next).toHaveBeenCalledTimes(1);
      expect(req.user).toBeUndefined();
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('Expired/Invalid Tokens (Main Fix)', () => {
    it('should proceed when token is expired', async () => {
      req.headers.authorization = 'Bearer expired.token.here';
      
      // Mock Firebase to throw expired token error
      mockAuth.verifyIdToken.mockRejectedValue(
        new Error('Firebase ID token has expired')
      );
      
      await optionalAuth(req, res, next);
      
      // Should proceed as guest (main fix)
      expect(next).toHaveBeenCalledTimes(1);
      expect(req.user).toBeUndefined();
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });

    it('should proceed when token is invalid', async () => {
      req.headers.authorization = 'Bearer invalid.token.format';
      
      // Mock Firebase to throw invalid token error
      mockAuth.verifyIdToken.mockRejectedValue(
        new Error('Firebase ID token has invalid signature')
      );
      
      await optionalAuth(req, res, next);
      
      // Should proceed as guest
      expect(next).toHaveBeenCalledTimes(1);
      expect(req.user).toBeUndefined();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should proceed when token verification fails with any error', async () => {
      req.headers.authorization = 'Bearer any.random.token';
      
      // Mock any Firebase error
      mockAuth.verifyIdToken.mockRejectedValue(
        new Error('Token verification failed')
      );
      
      await optionalAuth(req, res, next);
      
      // Should proceed as guest
      expect(next).toHaveBeenCalledTimes(1);
      expect(req.user).toBeUndefined();
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('Valid Tokens', () => {
    it('should attach user when token is valid and user exists', async () => {
      req.headers.authorization = 'Bearer valid.token.here';
      
      const mockDecodedToken = { uid: 'user123' };
      const mockUserData = {
        name: 'Test User',
        email: 'test@example.com',
        role: 'student'
      };
      
      // Mock successful token verification
      mockAuth.verifyIdToken.mockResolvedValue(mockDecodedToken);
      
      // Mock user document exists
      const mockUserDoc = {
        exists: true,
        id: 'user123',
        data: () => mockUserData
      };
      
      mockDb.collection.mockReturnValue({
        doc: jest.fn(() => ({
          get: jest.fn().mockResolvedValue(mockUserDoc)
        }))
      });
      
      await optionalAuth(req, res, next);
      
      // Should attach user and proceed
      expect(next).toHaveBeenCalledTimes(1);
      expect(req.user).toBeDefined();
      expect(req.user.name).toBe('Test User');
      expect(req.user.id).toBe('user123');
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should proceed without user when token is valid but user not found', async () => {
      req.headers.authorization = 'Bearer valid.token.here';
      
      const mockDecodedToken = { uid: 'nonexistent123' };
      
      // Mock successful token verification
      mockAuth.verifyIdToken.mockResolvedValue(mockDecodedToken);
      
      // Mock user document does not exist
      const mockUserDoc = {
        exists: false
      };
      
      mockDb.collection.mockReturnValue({
        doc: jest.fn(() => ({
          get: jest.fn().mockResolvedValue(mockUserDoc)
        }))
      });
      
      await optionalAuth(req, res, next);
      
      // Should proceed without user
      expect(next).toHaveBeenCalledTimes(1);
      expect(req.user).toBeUndefined();
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle database errors gracefully', async () => {
      req.headers.authorization = 'Bearer valid.token.here';
      
      const mockDecodedToken = { uid: 'user123' };
      mockAuth.verifyIdToken.mockResolvedValue(mockDecodedToken);
      
      // Mock database error
      mockDb.collection.mockReturnValue({
        doc: jest.fn(() => ({
          get: jest.fn().mockRejectedValue(new Error('Database connection failed'))
        }))
      });
      
      await optionalAuth(req, res, next);
      
      // Should proceed even with database error
      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should never return 401 under any circumstance', async () => {
      const testCases = [
        { auth: undefined, mockError: null },
        { auth: '', mockError: null },
        { auth: 'Bearer expired', mockError: new Error('Expired') },
        { auth: 'Bearer invalid', mockError: new Error('Invalid') },
        { auth: 'Bearer error', mockError: new Error('Unknown error') }
      ];

      for (const testCase of testCases) {
        jest.clearAllMocks();
        req.headers.authorization = testCase.auth;
        
        if (testCase.mockError) {
          mockAuth.verifyIdToken.mockRejectedValue(testCase.mockError);
        }
        
        await optionalAuth(req, res, next);
        
        expect(next).toHaveBeenCalledTimes(1);
        expect(res.status).not.toHaveBeenCalledWith(401);
      }
    });
  });
});
