// Database connection - supports both Supabase (local) and Vercel Postgres (production)
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

// Determine which database to use
const useVercelPostgres = process.env.VERCEL || process.env.POSTGRES_URL;

// Parse DATABASE_URL into individual env vars when present (Render, Heroku, etc.)
// This must run before pool creation so DB_HOST etc. are populated.
if (!process.env.DB_HOST && !useVercelPostgres && process.env.DATABASE_URL) {
  try {
    const dbUrl = new URL(process.env.DATABASE_URL);
    process.env.DB_HOST = dbUrl.hostname;
    process.env.DB_PORT = dbUrl.port || '5432';
    process.env.DB_USER = decodeURIComponent(dbUrl.username);
    process.env.DB_PASSWORD = decodeURIComponent(dbUrl.password);
    process.env.DB_NAME = (dbUrl.pathname || '/postgres').replace(/^\//, '') || 'postgres';
    // Always require SSL for remote PostgreSQL (standard for Render/Supabase)
    if (!process.env.DB_SSL) {
      process.env.DB_SSL = 'true';
    }
    console.log(`📡 Parsed DATABASE_URL → ${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`);
  } catch (parseError) {
    console.error('⚠️  Failed to parse DATABASE_URL:', parseError.message);
  }
}

let pool, query, transaction;

if (useVercelPostgres) {
  // === VERCEL POSTGRES (Production) ===
  console.log('📡 Using Vercel Postgres (serverless-optimized)');
  
  const { sql } = require('@vercel/postgres');
  
  // Query function for Vercel Postgres
  query = async (sqlString, params = []) => {
    const startTime = Date.now();
    
    try {
      // Convert to parameterized query
      let result;
      if (params.length === 0) {
        result = await sql.query(sqlString);
      } else {
        result = await sql.query(sqlString, params);
      }
      
      const executionTime = Date.now() - startTime;
      
      // Log slow queries (>100ms)
      if (executionTime > 100) {
        queryLogger.warn('Slow query detected', {
          sql: sqlString.substring(0, 200),
          params: JSON.stringify(params).substring(0, 100),
          executionTime: `${executionTime}ms`
        });
      }
      
      return result.rows;
    } catch (error) {
      queryLogger.error('Query error', {
        sql: sqlString.substring(0, 200),
        params: JSON.stringify(params).substring(0, 100),
        error: error.message,
        code: error.code
      });
      
      const enhancedError = new Error(error.message);
      enhancedError.code = error.code;
      enhancedError.statusCode = 500;
      throw enhancedError;
    }
  };
  
  // Transaction function for Vercel Postgres
  transaction = async (callback) => {
    const client = await sql.connect();
    
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
  
  // Health check for Vercel Postgres
  const healthCheck = async () => {
    try {
      await sql`SELECT 1`;
      return {
        status: 'healthy',
        database: 'Vercel Postgres',
        provider: 'Neon'
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        database: 'Vercel Postgres',
        error: error.message
      };
    }
  };
  
  module.exports = {
    pool: { query: sql }, // Compatibility
    query,
    transaction,
    healthCheck,
    queryLogger,
    getPoolStats: () => ({ provider: 'Vercel Postgres', type: 'serverless' })
  };

} else {
  // === SUPABASE / REGULAR POSTGRES (Local Development) ===
  console.log('📡 Using Supabase PostgreSQL (local development)');
  
  const { Pool } = require('pg');
  const dbHost = process.env.DB_HOST;
  const normalizedHost = (dbHost || '').toLowerCase();
  const isLocalHost = normalizedHost === 'localhost' || normalizedHost === '127.0.0.1';
  const useSsl = process.env.DB_SSL === 'true' || (!isLocalHost && process.env.DB_SSL !== 'false');
  
  const poolConfig = {
    host: dbHost,
    port: parseInt(process.env.DB_PORT) || 5432,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'postgres',
    ssl: useSsl ? { rejectUnauthorized: false } : false,
    // Serverless-optimized settings
    max: process.env.VERCEL ? 2 : 20,
    min: process.env.VERCEL ? 0 : 2,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 30000,
    query_timeout: 30000,
    statement_timeout: 30000
  };
  
  pool = new Pool(poolConfig);
  
  // Test connection
  const testConnection = async (retries = 3, delay = 1000) => {
    for (let i = 0; i < retries; i++) {
      try {
        const client = await pool.connect();
        console.log('✓ Database connected successfully (Supabase PostgreSQL)');
        console.log(`Connected to: ${poolConfig.host}:${poolConfig.port}`);
        client.release();
        return true;
      } catch (err) {
        console.error(`✗ Database connection attempt ${i + 1}/${retries} failed:`, err.message);
        if (i < retries - 1) {
          console.log(`Retrying in ${delay / 1000} seconds...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    return false;
  };
  
  // Test connection on startup (non-serverless only)
  const isTestRuntime = process.env.NODE_ENV === 'test' || Boolean(process.env.JEST_WORKER_ID);
  if (!process.env.VERCEL && !isTestRuntime) {
    testConnection();
  }
  
  // Query function for regular Postgres
  query = async (sqlString, params = []) => {
    const startTime = Date.now();
    
    try {
      const result = await pool.query(sqlString, params);
      const executionTime = Date.now() - startTime;
      
      // Log slow queries (>100ms)
      if (executionTime > 100) {
        queryLogger.warn('Slow query detected', {
          sql: sqlString.substring(0, 200),
          params: JSON.stringify(params).substring(0, 100),
          executionTime: `${executionTime}ms`
        });
      }
      
      return result.rows;
    } catch (error) {
      queryLogger.error('Query error', {
        sql: sqlString.substring(0, 200),
        params: JSON.stringify(params).substring(0, 100),
        error: error.message,
        code: error.code
      });
      
      const enhancedError = new Error(error.message);
      enhancedError.code = error.code;
      enhancedError.statusCode = 500;
      throw enhancedError;
    }
  };
  
  // Transaction function for regular Postgres
  transaction = async (callback) => {
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
  
  // Health check for regular Postgres
  const healthCheck = async () => {
    try {
      await query('SELECT 1');
      return {
        status: 'healthy',
        database: 'Supabase PostgreSQL',
        stats: {
          totalCount: pool.totalCount,
          idleCount: pool.idleCount,
          waitingCount: pool.waitingCount
        }
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
    healthCheck,
    queryLogger,
    getPoolStats: () => ({
      totalCount: pool.totalCount,
      idleCount: pool.idleCount,
      waitingCount: pool.waitingCount,
      maxConnections: poolConfig.max
    })
  };
}
