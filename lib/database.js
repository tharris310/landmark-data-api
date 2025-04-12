const { Pool } = require('pg');
const { 
  SecretsManagerClient, 
  GetSecretValueCommand 
} = require('@aws-sdk/client-secrets-manager');

// Create a Secrets Manager client
const secretsManagerClient = new SecretsManagerClient({ 
  region: 'us-east-1'
});

let pool; // Shared DB connection across invocations
let dbCreds; // Cache for parsed secret

/**
 * Fetch and cache DB credentials from AWS Secrets Manager
 * @returns {Promise<Object>} Database credentials
 */
const getDBCreds = async () => {
  // Return cached credentials if available
  if (dbCreds) {
    return dbCreds;
  }
  
  const secretName = process.env.DB_SECRET_NAME || 'prod/maven/db-creds';
  
  try {
    const command = new GetSecretValueCommand({
      SecretId: secretName,
      VersionStage: 'AWSCURRENT'
    });
    
    const response = await secretsManagerClient.send(command);
    dbCreds = JSON.parse(response.SecretString);
    
    return dbCreds;
  } catch (error) {
    console.error('Error retrieving DB credentials:', error.message);
    throw error;
  }
};

/**
 * Initialize a pool once, reuse for all queries
 * @returns {Promise<Pool>} PostgreSQL connection pool
 */
const initPool = async () => {
  // Return existing pool if available
  if (pool) {
    return pool;
  }
  
  try {
    const creds = await getDBCreds();
    
    // Create the pool
    pool = new Pool({
      host: creds.host,
      user: creds.username,
      password: creds.password,
      database: creds.database,
      port: parseInt(creds.port),
      ssl: { rejectUnauthorized: false },
      max: 1,
      idleTimeoutMillis: 120000,
      connectionTimeoutMillis: 10000
    });
    
    // Test the connection
    const client = await pool.connect();
    client.release();
    
    return pool;
  } catch (error) {
    console.error('Error initializing database pool:', error.message);
    throw error;
  }
};

/**
 * Execute a SQL query
 * @param {string} text - SQL query text
 * @param {Array} params - Query parameters
 * @returns {Promise<Object>} Query result
 */
const query = async (text, params) => {
  try {
    const pgPool = await initPool();
    return await pgPool.query(text, params);
  } catch (error) {
    console.error('Database query error:', error.message);
    throw error;
  }
};

/**
 * Get landmark data by assessment ID
 * @param {string} assessmentId
 * @returns {Promise<Array>}
 */
const getLandmarksForAssessment = async (assessmentId) => {
  return query('SELECT * FROM landmark_data WHERE a_id = $1', [assessmentId]);
};

module.exports = {
  query,
  getLandmarksForAssessment
};