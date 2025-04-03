const express = require('express');
const serverless = require('serverless-http');
const db = require('./lib/database');

const app = express();

// Middleware to parse JSON request bodies
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Landmark data endpoint
app.get('/landmarks/:assessmentId', async (req, res) => {
  try {
    const { assessmentId } = req.params;
    
    if (!assessmentId) {
      return res.status(400).json({ error: 'Missing assessment ID parameter' });
    }
    
    const result = await db.getLandmarksForAssessment(assessmentId);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No landmark data found for the specified assessment ID' });
    }
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching landmark data:', error);
    res.status(500).json({ error: 'Database query failed' });
  }
});

// Start the server if running locally
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

// Export the serverless handler
module.exports.handler = serverless(app); 