const { db, admin } = require('./firebase');
const winston = require('winston');
require('dotenv').config();

// Configure query logger
const queryLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.simple()
  ),
  transports: [
    new winston.transports.Console()
  ]
});

// Mock Pool for backward compatibility during migration
const pool = {
  query: async () => { throw new Error('PostgreSQL pool is deprecated. Use Firestore.'); },
  connect: async () => { throw new Error('PostgreSQL pool is deprecated. Use Firestore.'); },
  end: async () => { }
};

// Helper function to execute queries (Deprecated)
const query = async (sql, params = []) => {
  console.error('⚠️ SQL Query attempted in Firebase mode:', sql);
  throw new Error('SQL queries are deprecated. Please use Firestore.');
};

// Helper function for transactions (Deprecated)
const transaction = async (callback) => {
  throw new Error('SQL transactions are deprecated. Use Firestore transactions.');
};

// Get pool statistics
const getPoolStats = () => {
  return {
    totalCount: 0,
    idleCount: 0,
    waitingCount: 0,
    maxConnections: 0
  };
};

// Health check
const healthCheck = async () => {
  try {
    // Simple check if Firestore is initialized
    if (admin.apps.length) {
      return {
        status: 'healthy',
        database: 'Firebase Firestore',
        stats: getPoolStats()
      };
    } else {
      throw new Error('Firebase app not initialized');
    }
  } catch (error) {
    return {
      status: 'unhealthy',
      database: 'Firebase Firestore',
      error: error.message
    };
  }
};

module.exports = {
  pool,
  query,
  transaction,
  getPoolStats,
  healthCheck,
  queryLogger,
  db // Export Firestore instance
};
