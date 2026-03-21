/** @jest-environment node */

const {
  LOCAL_REGISTERED_USERS,
  getLocalDemoUser,
  getLocalDemoUserFromToken,
  registerLocalDemoStudent
} = require('../services/demo-auth.service');

describe('demo-auth.service', () => {
  beforeEach(() => {
    Object.keys(LOCAL_REGISTERED_USERS).forEach((key) => delete LOCAL_REGISTERED_USERS[key]);
  });

  test('registers a local demo student without leaking the password', () => {
    const user = registerLocalDemoStudent({
      name: 'Native Test Student',
      registration_number: 'STU20990001',
      email: 'native.student@iter.edu',
      password: 'Student@123',
      department: 'CSE',
      year: 4,
      section: 'B',
      semester: '7'
    });

    expect(user).toMatchObject({
      id: 'STU20990001',
      registration_number: 'STU20990001',
      name: 'Native Test Student',
      email: 'native.student@iter.edu',
      role: 'student',
      department: 'CSE',
      year: 4,
      section: 'B',
      semester: '7'
    });
    expect(user.password).toBeUndefined();
    expect(LOCAL_REGISTERED_USERS.STU20990001.password).toBe('Student@123');
  });

  test('resolves local demo users from credentials and demo-local tokens', () => {
    registerLocalDemoStudent({
      name: 'Portal Contract Student',
      registration_number: 'STU20990002',
      email: 'portal.contract@iter.edu',
      password: 'Student@123',
      department: 'IT',
      year: 3,
      section: 'A',
      semester: '5'
    });

    expect(getLocalDemoUser('STU20990002', 'Student@123')).toMatchObject({
      registration_number: 'STU20990002',
      role: 'student',
      department: 'IT'
    });
    expect(getLocalDemoUser('STU20990002', 'wrong-password')).toBeNull();

    const tokenUser = getLocalDemoUserFromToken(`demo-local-STU20990002-${Date.now()}`);
    expect(tokenUser).toMatchObject({
      registration_number: 'STU20990002',
      role: 'student'
    });
  });
});
