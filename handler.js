// handler.js
const db = require('./lib/database');

exports.health = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Credentials': true,
  };

  try {
    // Test database connection with timeout
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Database connection timeout')), 5000)
    );
    
    const dbPromise = db.query('SELECT 1');
    await Promise.race([dbPromise, timeoutPromise]);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        status: 'ok',
        timestamp: new Date().toISOString(),
        database: 'connected'
      }),
    };
  } catch (err) {
    console.error('Health check failed:', err.message);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Internal server error', 
        details: err.message,
        type: err.name
      }),
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
    console.error('Landmark handler error:', err.message);
    
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error', details: err.message }),
    };
  }
};