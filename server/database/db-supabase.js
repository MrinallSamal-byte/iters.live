// Supabase PostgreSQL Database Connection
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

// PostgreSQL connection pool configuration
const poolConfig = {
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT) || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'postgres',
  
  // SSL configuration for Supabase
  ssl: {
    rejectUnauthorized: false
  },
  
  // Connection pool settings
  max: process.env.VERCEL ? 2 : 20, // Smaller pool for serverless
  min: 0,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  
  // Statement timeout (30 seconds)
  statement_timeout: 30000,
  
  // Query timeout
  query_timeout: 30000
};

// Create connection pool
const pool = new Pool(poolConfig);

// Handle pool errors
pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client', err);
});

// Test connection with retry logic
const testConnection = async (retries = 3, delay = 2000) => {
  // Skip connection test in Vercel serverless environment
  if (process.env.VERCEL) {
    console.log('Skipping connection test in Vercel serverless environment');
    return true;
  }

  for (let i = 0; i < retries; i++) {
    try {
      const client = await pool.connect();
      const result = await client.query('SELECT NOW()');
      console.log('✓ Database connected successfully');
      console.log(`Connected to: ${poolConfig.host}:${poolConfig.port}`);
      console.log(`Database: ${poolConfig.database}`);
      console.log(`Server time: ${result.rows[0].now}`);
      client.release();
      return true;
    } catch (err) {
      console.error(`✗ Database connection attempt ${i + 1}/${retries} failed:`, err.message);
      console.error(`  Host: ${poolConfig.host}:${poolConfig.port}`);
      console.error(`  Database: ${poolConfig.database}`);
      
      if (i < retries - 1) {
        console.log(`Retrying in ${delay / 1000} seconds...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        console.error('✗ Database connection failed after all retries');
        if (process.env.NODE_ENV !== 'production') {
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
const query = async (text, params = []) => {
  const startTime = Date.now();
  
  try {
    const result = await pool.query(text, params);
    const executionTime = Date.now() - startTime;
    
    // Log slow queries (>100ms)
    if (executionTime > 100) {
      queryLogger.warn('Slow query detected', {
        sql: text.substring(0, 200),
        params: JSON.stringify(params).substring(0, 100),
        executionTime: `${executionTime}ms`
      });
    }
    
    // Log all queries in development
    if (process.env.NODE_ENV === 'development') {
      queryLogger.info('Query executed', {
        sql: text.substring(0, 100),
        executionTime: `${executionTime}ms`
      });
    }
    
    return result.rows;
  } catch (error) {
    console.error('Database query error:', error);
    console.error('SQL:', text.substring(0, 200));
    console.error('Params:', params);
    
    // Re-throw with additional context
    error.sql = text;
    error.params = params;
    throw error;
  }
};

// Transaction helper
const transaction = async (callback) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Transaction error:', error);
    throw error;
  } finally {
    client.release();
  }
};

// Graceful shutdown
const closePool = async () => {
  try {
    await pool.end();
    console.log('✓ Database pool closed');
  } catch (error) {
    console.error('Error closing database pool:', error);
  }
};

// Handle process termination
process.on('SIGTERM', closePool);
process.on('SIGINT', closePool);

module.exports = {
  pool,
  query,
  transaction,
  testConnection,
  closePool
};
