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
 * @param {string} type - Optional: 'hitting' or 'pitching'. If not provided, searches both tables.
 * @returns {Promise<Array>}
 */
const getLandmarksForAssessment = async (assessmentId, type = null) => {
  if (type === 'hitting') {
    // Get hitting landmarks only
    return query(
      'SELECT id, assessment_id, file_name, raw_json, created_at FROM hitting_landmarks_json WHERE assessment_id = $1',
      [assessmentId]
    );
  } else if (type === 'pitching') {
    // Get pitching landmarks only
    return query(
      'SELECT id, assessment_id, file_name, raw_json, created_at FROM pitching_landmarks_json WHERE assessment_id = $1',
      [assessmentId]
    );
  } else {
    // Get both types of landmarks
    const [hittingResults, pitchingResults] = await Promise.all([
      query(
        'SELECT id, assessment_id, file_name, raw_json, created_at, \'hitting\' as type FROM hitting_landmarks_json WHERE assessment_id = $1',
        [assessmentId]
      ),
      query(
        'SELECT id, assessment_id, file_name, raw_json, created_at, \'pitching\' as type FROM pitching_landmarks_json WHERE assessment_id = $1',
        [assessmentId]
      )
    ]);
    
    // Combine results
    return {
      rows: [...hittingResults.rows, ...pitchingResults.rows],
      rowCount: hittingResults.rowCount + pitchingResults.rowCount
    };
  }
};

/**
 * Generate a random number for use as assessment_id
 * @returns {number} Random number between 10000-99999999
 */
const generateRandomId = () => {
  // Generate a random number between 10000 and 99999999
  return Math.floor(10000 + Math.random() * 99990000);
};

/**
 * Insert landmark data into the database
 * @param {Object} landmark - Landmark data object
 * @returns {Promise<Object>} Query result
 */
const insertLandmark = async (landmark) => {
  // Validate required fields
  if (!landmark.type) {
    throw new Error('Missing required field: type (hitting or pitching)');
  }
  
  // Determine which table to use based on the type
  const tableName = 
    landmark.type === 'hitting' ? 'hitting_landmarks_json' : 
    landmark.type === 'pitching' ? 'pitching_landmarks_json' : 
    null;
    
  if (!tableName) {
    throw new Error(`Invalid landmark type: ${landmark.type}. Must be 'hitting' or 'pitching'.`);
  }
  
  // Generate a random number for the assessment_id
  const randomId = generateRandomId();
  console.log(`Using random ID: ${randomId}`);
  
  // Extract the filename from the S3 key if provided
  const fileName = landmark.key ? landmark.key.split('/').pop() : `${landmark.type}_${randomId}.json`;
  
  // For these tables, we store the entire data as JSONB
  // Remove type and key as they're not needed in the raw_json
  const { type, key, ...landmarkData } = landmark;
  
  // Build the SQL query with the correct column names
  const sql = `
    INSERT INTO ${tableName} (assessment_id, file_name, raw_json, created_at)
    VALUES ($1, $2, $3, NOW())
    RETURNING *
  `;
  
  return query(sql, [randomId, fileName, JSON.stringify(landmarkData)]);
};

module.exports = {
  query,
  getLandmarksForAssessment,
  insertLandmark
};