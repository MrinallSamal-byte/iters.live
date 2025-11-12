const { Pool } = require('pg');
const winston = require('winston');
require('dotenv').config();

// Configure query logger
const queryLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ 
      filename: 'logs/slow-queries.log',
      level: 'warn'
    }),
    new winston.transports.File({ 
      filename: 'logs/queries.log'
    })
  ]
});

// PostgreSQL (Supabase) connection pool configuration
const poolConfig = {
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT) || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'postgres',
  ssl: {
    rejectUnauthorized: false
  },
  // Serverless-optimized settings
  max: process.env.VERCEL ? 2 : 20,
  min: process.env.VERCEL ? 0 : 2,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 30000,
  query_timeout: 30000,
  statement_timeout: 30000
};

// Create connection pool
const pool = new Pool(poolConfig);

// Test connection with retry logic
const testConnection = async (retries = 5, delay = 3000) => {
  // Skip retries in Vercel serverless environment
  if (process.env.VERCEL) {
    retries = 1;
    delay = 1000;
  }
  
  for (let i = 0; i < retries; i++) {
    try {
      const connection = await pool.getConnection();
      console.log('✓ Database connected successfully');
      console.log(`Connected to: ${poolConfig.host}:${poolConfig.port}`);
      connection.release();
      return true;
    } catch (err) {
      console.error(`✗ Database connection attempt ${i + 1}/${retries} failed:`, err.message);
      console.error(`  Host: ${poolConfig.host}:${poolConfig.port}`);
      console.error(`  Error code: ${err.code || 'N/A'}`);
      if (i < retries - 1) {
        console.log(`Retrying in ${delay / 1000} seconds...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        console.error('✗ Database connection failed after all retries');
        // Don't exit in production, let the app handle errors gracefully
        if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
          process.exit(1);
        }
      }
    }
  }
  return false;
};

// Only test connection on startup in non-serverless environments
if (!process.env.VERCEL) {
  testConnection();
}

// Helper function to execute queries with logging
const query = async (sql, params = []) => {
  const startTime = Date.now();
  
  try {
    const [results] = await pool.execute(sql, params);
    const executionTime = Date.now() - startTime;
    
    // Log slow queries (>100ms)
    if (executionTime > 100) {
      queryLogger.warn('Slow query detected', {
        sql: sql.substring(0, 200),
        params: JSON.stringify(params).substring(0, 100),
        executionTime: `${executionTime}ms`
      });
    }
    
    // Log all queries in development
    if (process.env.NODE_ENV === 'development') {
      queryLogger.info('Query executed', {
        sql: sql.substring(0, 100),
        executionTime: `${executionTime}ms`
      });
    }
    
    return results;
  } catch (error) {
    queryLogger.error('Query error', {
      sql: sql.substring(0, 200),
      params: JSON.stringify(params).substring(0, 100),
      error: error.message,
      code: error.code
    });
    
    // Enhance error with more context
    const enhancedError = new Error(error.message);
    enhancedError.code = error.code;
    enhancedError.errno = error.errno;
    enhancedError.sqlState = error.sqlState;
    enhancedError.sqlMessage = error.sqlMessage;
    enhancedError.statusCode = 500;
    
    throw enhancedError;
  }
};

// Helper function for transactions
const transaction = async (callback) => {
  const connection = await pool.getConnection();
  await connection.beginTransaction();
  
  try {
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

// Get pool statistics
const getPoolStats = () => {
  return {
    totalConnections: pool.pool._allConnections.length,
    freeConnections: pool.pool._freeConnections.length,
    acquiringConnections: pool.pool._acquiringConnections.length,
    connectionLimit: poolConfig.connectionLimit
  };
};

// Health check
const healthCheck = async () => {
  try {
    await query('SELECT 1');
    return {
      status: 'healthy',
      stats: getPoolStats()
    };
  } catch (error) {
    return {
      status: 'unhealthy',
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
  queryLogger
};
