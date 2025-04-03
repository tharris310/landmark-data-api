const { Pool } = require('pg');
require('dotenv').config();

// Create a pool that will be reused across function invocations
const pool = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
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