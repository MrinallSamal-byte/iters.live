const { Pool } = require('pg');
const winston = require('winston');
require('dotenv').config();

// Configure query logger (console only for Vercel serverless)
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

// PostgreSQL connection pool configuration (supports Render/Neon connection string)
const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL || '';
const isConnString = !!connectionString;

const poolConfig = isConnString
  ? {
      connectionString,
      ssl: { rejectUnauthorized: false },
      max: process.env.VERCEL ? 2 : 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 30000,
      query_timeout: 30000,
      statement_timeout: 30000
    }
  : {
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT) || 5432,
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME || 'postgres',
      ssl: { rejectUnauthorized: false },
      max: process.env.VERCEL ? 2 : 20,
      min: process.env.VERCEL ? 0 : 2,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 30000,
      query_timeout: 30000,
      statement_timeout: 30000
    };

// Create connection pool
const pool = new Pool(poolConfig);

// Test the database connection
const testConnection = async (retries = 3, delay = 1000) => {
  // In Vercel, skip connection test and use a shorter retry with no delay
  if (process.env.VERCEL) {
    retries = 1;
    delay = 1000;
  }
  
  for (let i = 0; i < retries; i++) {
    try {
      const client = await pool.connect();
      const connInfo = isConnString 
        ? `Connection string (${connectionString.split('@')[1]?.split('/')[0] || 'host hidden'})`
        : `${poolConfig.host}:${poolConfig.port}`;
      console.log('✓ Database connected successfully (PostgreSQL)');
      console.log(`Connected to: ${connInfo}`);
      client.release();
      return true;
    } catch (err) {
      const connInfo = isConnString 
        ? `Connection string (${connectionString.split('@')[1]?.split('/')[0] || 'parsing failed'})`
        : `${poolConfig.host}:${poolConfig.port}`;
      console.error(`✗ Database connection attempt ${i + 1}/${retries} failed:`, err.message);
      console.error(`  Connection: ${connInfo}`);
      console.error(`  Error code: ${err.code || 'N/A'}`);
      console.error(`  Full error:`, err);
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

// Helper function to execute queries with logging (PostgreSQL compatible)
const query = async (sql, params = []) => {
  const startTime = Date.now();
  
  try {
    const result = await pool.query(sql, params);
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
    
    return result.rows;
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
    enhancedError.statusCode = 500;
    
    throw enhancedError;
  }
};

// Helper function for transactions (PostgreSQL compatible)
const transaction = async (callback) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

// Get pool statistics
const getPoolStats = () => {
  return {
    totalCount: pool.totalCount,
    idleCount: pool.idleCount,
    waitingCount: pool.waitingCount,
    maxConnections: poolConfig.max
  };
};

// Health check
const healthCheck = async () => {
  try {
    await query('SELECT 1');
    return {
      status: 'healthy',
      database: 'Supabase PostgreSQL',
      stats: getPoolStats()
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      database: 'Supabase PostgreSQL',
      error: error.message
    };
  }
};

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing database pool...');
  await pool.end();
  console.log('Database pool closed');
});

module.exports = {
  pool,
  query,
  transaction,
  getPoolStats,
  healthCheck,
  queryLogger
};
