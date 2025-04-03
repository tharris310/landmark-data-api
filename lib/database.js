const { Pool } = require('pg');

// Create a pool that will be reused across function invocations
const pool = new Pool({
  host: 'maven-db-prod.cluster-c8tgs884sm3s.us-east-1.rds.amazonaws.com',
  user: 'mavenadmin',
  password: 'K24eSX.z-Mk<U>|QRSCi|85domCY',
  database: 'mavenbaseball',
  port: 5432,
  // For Lambda connections, we should set these parameters for better performance
  max: 1,
  idleTimeoutMillis: 120000,
  connectionTimeoutMillis: 10000,
});

/**
 * Execute a SQL query
 * @param {string} text - SQL query text
 * @param {Array} params - Query parameters
 * @returns {Promise<Object>} Query result
 */
const query = async (text, params) => {
  try {
    const start = Date.now();
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log('Executed query', { text, duration, rows: res.rowCount });
    return res;
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
};

/**
 * Get landmark data by assessment ID
 * @param {string} assessmentId - Assessment ID to filter by
 * @returns {Promise<Array>} Landmark data for the specified assessment
 */
const getLandmarksForAssessment = async (assessmentId) => {
  return query('SELECT * FROM parsed_landmarks WHERE assessment_id = $1', [assessmentId]);
};

module.exports = {
  query,
  pool,
  getLandmarksForAssessment
}; 