// handler.js
const db = require('./lib/database');

exports.health = async (event) => {
  try {
    await db.pool.query('SELECT 1');
    return {
      statusCode: 200,
      body: JSON.stringify({
        status: 'ok',
        timestamp: new Date().toISOString(),
        database: 'connected',
      }),
    };
  } catch (err) {
    console.error('Health check error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error', details: err.message }),
    };
  }
};

exports.landmarks = async (event) => {
  try {
    const assessmentId = event.pathParameters?.assessmentId;

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
  } catch (err) {
    console.error('Landmark handler error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error', details: err.message }),
    };
  }
};