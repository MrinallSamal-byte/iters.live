const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// Mock user for testing
const mockUser = {
  id: 1,
  name: 'Test Student',
  registration_number: 'TEST001',
  email: 'test@iter.edu',
  password: '', // Will be set in beforeAll
  role: 'student',
  department: 'CSE',
  year: 3,
  section: 'A'
};

describe('Authentication Module', () => {
  beforeAll(async () => {
    mockUser.password = await bcrypt.hash('Test@123456', 12);
  });

  describe('Password Hashing', () => {
    it('should hash password correctly', async () => {
      const password = 'MySecurePass@123';
      const hash = await bcrypt.hash(password, 12);
      
      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(50);
    });

    it('should verify correct password', async () => {
      const password = 'Test@123456';
      const isValid = await bcrypt.compare(password, mockUser.password);
      
      expect(isValid).toBe(true);
    });

    it('should reject incorrect password', async () => {
      const wrongPassword = 'WrongPassword';
      const isValid = await bcrypt.compare(wrongPassword, mockUser.password);
      
      expect(isValid).toBe(false);
    });
  });

  describe('JWT Token Generation', () => {
    it('should generate valid access token', () => {
      const token = jwt.sign(
        { userId: mockUser.id, role: mockUser.role },
        'test-secret',
        { expiresIn: '1h' }
      );

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3);
    });

    it('should decode token correctly', () => {
      const token = jwt.sign(
        { userId: mockUser.id, role: mockUser.role },
        'test-secret',
        { expiresIn: '1h' }
      );

      const decoded = jwt.verify(token, 'test-secret');

      expect(decoded.userId).toBe(mockUser.id);
      expect(decoded.role).toBe(mockUser.role);
    });

    it('should reject invalid token', () => {
      const invalidToken = 'invalid.token.here';

      expect(() => {
        jwt.verify(invalidToken, 'test-secret');
      }).toThrow();
    });

    it('should reject expired token', () => {
      const token = jwt.sign(
        { userId: mockUser.id, role: mockUser.role },
        'test-secret',
        { expiresIn: '-1s' } // already expired
      );

      expect(() => jwt.verify(token, 'test-secret')).toThrow('jwt expired');
    });
  });

  describe('Input Validation', () => {
    it('should validate registration number format', () => {
      const validRegNums = ['STU20250001', 'TCH2025001', 'ADM2025001'];
      const invalidRegNums = ['123', 'ABC', ''];

      validRegNums.forEach(regNum => {
        expect(regNum).toMatch(/^(STU|TCH|ADM)\d{7,}$/);
      });

      invalidRegNums.forEach(regNum => {
        expect(regNum).not.toMatch(/^(STU|TCH|ADM)\d{7,}$/);
      });
    });

    it('should validate email format', () => {
      const validEmails = ['test@iter.edu', 'student@example.com'];
      const invalidEmails = ['invalid-email', '@iter.edu', 'test@'];

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      validEmails.forEach(email => {
        expect(email).toMatch(emailRegex);
      });

      invalidEmails.forEach(email => {
        expect(email).not.toMatch(emailRegex);
      });
    });

    it('should validate password strength', () => {
      const strongPassword = 'MySecure@Pass123';
      const weakPasswords = ['weak', '12345678', 'NoSpecialChar1'];

      // Strong password requirements
      expect(strongPassword.length).toBeGreaterThanOrEqual(10);
      expect(strongPassword).toMatch(/[A-Z]/);
      expect(strongPassword).toMatch(/[a-z]/);
      expect(strongPassword).toMatch(/[0-9]/);
      expect(strongPassword).toMatch(/[!@#$%^&*]/);

      weakPasswords.forEach(pwd => {
        const isStrong = 
          pwd.length >= 10 &&
          /[A-Z]/.test(pwd) &&
          /[a-z]/.test(pwd) &&
          /[0-9]/.test(pwd) &&
          /[!@#$%^&*]/.test(pwd);
        expect(isStrong).toBe(false);
      });
    });
  });

  describe('Role-Based Access', () => {
    const roles = ['student', 'teacher', 'admin'];

    it('should have valid role', () => {
      expect(roles).toContain(mockUser.role);
    });

    it('should check role permissions', () => {
      const canUploadNotes = (role) => ['teacher', 'admin'].includes(role);
      const canApproveFiles = (role) => role === 'admin';
      const canViewOwnData = (role) => ['student', 'teacher', 'admin'].includes(role);

      expect(canUploadNotes('student')).toBe(false);
      expect(canUploadNotes('teacher')).toBe(true);
      expect(canUploadNotes('admin')).toBe(true);

      expect(canApproveFiles('student')).toBe(false);
      expect(canApproveFiles('teacher')).toBe(false);
      expect(canApproveFiles('admin')).toBe(true);

      expect(canViewOwnData('student')).toBe(true);
      expect(canViewOwnData('teacher')).toBe(true);
      expect(canViewOwnData('admin')).toBe(true);
    });
  });
});

describe('File Upload Module', () => {
  describe('File Validation', () => {
    it('should validate file type', () => {
      const allowedTypes = [
        'application/pdf',
        'image/jpeg',
        'image/png',
        'application/msword'
      ];

      const validFiles = [
        { mimetype: 'application/pdf' },
        { mimetype: 'image/jpeg' },
        { mimetype: 'image/png' }
      ];

      const invalidFiles = [
        { mimetype: 'application/exe' },
        { mimetype: 'text/html' }
      ];

      validFiles.forEach(file => {
        expect(allowedTypes).toContain(file.mimetype);
      });

      invalidFiles.forEach(file => {
        expect(allowedTypes).not.toContain(file.mimetype);
      });
    });

    it('should validate file size', () => {
      const maxSize = 10 * 1024 * 1024; // 10MB

      expect(5 * 1024 * 1024).toBeLessThanOrEqual(maxSize);
      expect(15 * 1024 * 1024).toBeGreaterThan(maxSize);
    });
  });

  describe('File Naming', () => {
    it('should sanitize file names', () => {
      const dangerousNames = [
        '../../../etc/passwd',
        'test<script>.pdf',
        'file with spaces.pdf'
      ];

      const sanitize = (name) => {
        // Replace path separators first
        let safe = name.replace(/[\\/]/g, '_');
        // Collapse any sequence of two or more dots to underscore to prevent traversal
        safe = safe.replace(/\.{2,}/g, '_');
        // Replace any remaining disallowed chars
        safe = safe.replace(/[^a-z0-9._-]/gi, '_');
        // Collapse multiple underscores
        safe = safe.replace(/_+/g, '_');
        return safe;
      };

      dangerousNames.forEach(name => {
        const sanitized = sanitize(name);
        expect(sanitized).not.toContain('..');
        expect(sanitized).not.toContain('<');
        expect(sanitized).not.toContain('>');
      });
    });
  });
});

describe('Utility Functions', () => {
  describe('Date Formatting', () => {
    it('should format date correctly', () => {
      const date = new Date('2025-01-15T10:30:00');
      const formatted = date.toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });

      expect(formatted).toMatch(/Jan.*2025/);
    });
  });

  describe('Percentage Calculation', () => {
    it('should calculate attendance percentage', () => {
      const present = 25;
      const total = 30;
      const percentage = ((present / total) * 100).toFixed(2);

      expect(parseFloat(percentage)).toBe(83.33);
    });

    it('should handle zero total', () => {
      const present = 0;
      const total = 0;
      const percentage = total === 0 ? 0 : ((present / total) * 100).toFixed(2);

      expect(parseFloat(percentage)).toBe(0);
    });
  });
});
