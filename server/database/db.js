const sqlDb = require('./db-hybrid');
const firebase = require('./firebase');

module.exports = {
  ...sqlDb,
  db: firebase.db,
  admin: firebase.admin,
  auth: firebase.auth,
  storage: firebase.storage,
  isFirebaseAdminReady: firebase.isFirebaseAdminReady
};
