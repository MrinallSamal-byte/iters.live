const { createAppSessionToken } = require('../utils/app-session');

/**
 * A signed-in session for a seeded user. The session guard reads the live user
 * record, so tests seed the same user into the fake Firestore first.
 */
function tokenFor(user, extras = {}) {
  return createAppSessionToken(user, extras);
}

const USERS = {
  student: {
    id: 'STU1', registration_number: 'STU1', name: 'Asha Student', email: 'asha@iter.edu',
    role: 'student', department: 'CSE', year: 3, section: 'A', is_active: true
  },
  student2: {
    id: 'STU2', registration_number: 'STU2', name: 'Ravi Student', email: 'ravi@iter.edu',
    role: 'student', department: 'CSE', year: 3, section: 'A', is_active: true
  },
  teacher: {
    id: 'TCH1', registration_number: 'TCH1', name: 'Dr Teacher', email: 'teacher@iter.edu',
    role: 'teacher', department: 'CSE', is_active: true
  },
  teacher2: {
    id: 'TCH2', registration_number: 'TCH2', name: 'Prof Other', email: 'other@iter.edu',
    role: 'teacher', department: 'CSE', is_active: true
  },
  admin: {
    id: 'ADM1', registration_number: 'ADM1', name: 'Admin One', email: 'admin@iter.edu',
    role: 'admin', is_active: true
  }
};

module.exports = { tokenFor, USERS };
