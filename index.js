const db = require('./lib/database');

/**
 * Main Lambda handler
 */
exports.handler = async (event) => {
  const path = event.path;
  const method = event.httpMethod;
  const pathParams = event.pathParameters || {};

  try {
    // Route: /landmarks/health
    if (path === '/health' && method === 'GET') {
      await db.pool.query('SELECT 1'); // test DB
      return {
        statusCode: 200,
        body: JSON.stringify({
          status: 'ok',
          timestamp: new Date().toISOString(),
          database: 'connected'
        }),
      };
    }

    // Route: /landmarks/{assessmentId}
    if (pathParams.assessmentId && method === 'GET') {
      const assessmentId = pathParams.assessmentId;

      if (!assessmentId) {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: 'Missing assessment ID parameter' }),
        };
      }

      const result = await db.getLandmarksForAssessment(assessmentId);

      if (result.rows.length === 0) {
        return {
          statusCode: 404,
          body: JSON.stringify({ error: 'No landmark data found' }),
        };
      }

      return {
        statusCode: 200,
        body: JSON.stringify(result.rows),
      };
    }

    // Default fallback
    return {
      statusCode: 404,
      body: JSON.stringify({ error: 'Route not found' }),
    };
  } catch (err) {
    console.error('Lambda handler error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error', details: err.message }),
    };
  }
};
