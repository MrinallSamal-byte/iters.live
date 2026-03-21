const LOCAL_DEMO_USERS = {
  STU20250001: {
    id: 'STU20250001',
    registration_number: 'STU20250001',
    password: 'Student@123',
    name: 'Shreya Mishra',
    email: 'student1@iter.edu',
    role: 'student',
    department: 'CSE',
    year: 2,
    section: 'A',
    semester: '3',
    is_active: true
  },
  TCH2025001: {
    id: 'TCH2025001',
    registration_number: 'TCH2025001',
    password: 'Teacher@123',
    name: 'Dr. Priya Sharma',
    email: 'teacher1@iter.edu',
    role: 'teacher',
    department: 'CSE',
    is_active: true
  },
  ADM2025001: {
    id: 'ADM2025001',
    registration_number: 'ADM2025001',
    password: 'Admin@123456',
    name: 'Admin User',
    email: 'admin@iter.edu',
    role: 'admin',
    department: 'Administration',
    is_active: true
  }
};
const LOCAL_REGISTERED_USERS = {};

function stripPassword(user) {
  if (!user) return null;
  const { password, ...safeUser } = user;
  return safeUser;
}

function getAllLocalUsers() {
  return {
    ...LOCAL_DEMO_USERS,
    ...LOCAL_REGISTERED_USERS
  };
}

function getLocalDemoUser(registrationNumber, password) {
  const demoUser = getAllLocalUsers()[registrationNumber];
  if (!demoUser || demoUser.password !== password) {
    return null;
  }

  return stripPassword(demoUser);
}

function getLocalDemoUserByRole(role) {
  const match = Object.values(getAllLocalUsers()).find((user) => user.role === role);
  return stripPassword(match);
}

function getLocalDemoUserFromToken(token) {
  if (!token || !token.startsWith('demo-local-')) {
    return null;
  }

  const registrationMatch = token.match(/^demo-local-(.+)-\d+$/);
  if (registrationMatch) {
    const registrationNumber = registrationMatch[1];
    const user = getAllLocalUsers()[registrationNumber];
    if (user) {
      return stripPassword(user);
    }
  }

  const parts = token.split('-');
  const role = parts[2];
  return getLocalDemoUserByRole(role);
}

function registerLocalDemoStudent(payload) {
  const registrationNumber = payload.registration_number;
  if (!registrationNumber) {
    throw new Error('registration_number is required');
  }

  if (getAllLocalUsers()[registrationNumber]) {
    throw new Error('User already exists');
  }

  LOCAL_REGISTERED_USERS[registrationNumber] = {
    id: registrationNumber,
    registration_number: registrationNumber,
    password: payload.password,
    name: payload.name,
    email: payload.email,
    role: 'student',
    department: payload.department || 'CSE',
    year: Number(payload.year || 1),
    section: payload.section || 'A',
    semester: payload.semester || '1',
    is_active: true
  };

  return stripPassword(LOCAL_REGISTERED_USERS[registrationNumber]);
}

module.exports = {
  LOCAL_DEMO_USERS,
  LOCAL_REGISTERED_USERS,
  getLocalDemoUser,
  getLocalDemoUserByRole,
  getLocalDemoUserFromToken,
  registerLocalDemoStudent,
  stripPassword
};
