// handler.js
const db = require('./lib/database');
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const dns = require('dns');

// Initialize S3 client with timeout and retry configuration
const s3Client = new S3Client({ 
  region: 'us-east-1',
  maxAttempts: 5, // Maximum number of retry attempts
  requestTimeout: 60000, // 60 seconds timeout
});

// DNS resolution sanity check
const checkS3DNS = () => {
  return new Promise((resolve, reject) => {
    console.log('Performing DNS resolution sanity check for S3...');
    dns.lookup('s3.amazonaws.com', (err, address) => {
      if (err) {
        console.error('❌ DNS resolution failed:', err.message);
        reject(err);
      } else {
        console.log('✅ Resolved s3.amazonaws.com to:', address);
        resolve(address);
      }
    });
  });
};

// Function to read file content from S3 with retries
const getS3FileContent = async (bucket, key) => {
  try {
    // Check DNS resolution first
    await checkS3DNS();
    
    console.log(`Creating GetObjectCommand for ${bucket}/${key}`);
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });
    
    console.log(`Sending GetObjectCommand to S3...`);
    const response = await s3Client.send(command);
    console.log(`Successfully retrieved file from S3: ${bucket}/${key}`);
    
    // Convert stream to string
    console.log(`Converting response body to string...`);
    const content = await streamToString(response.Body);
    console.log(`Successfully converted file content, size: ${content.length} bytes`);
    return content;
  } catch (error) {
    console.error(`Error fetching S3 file ${key}:`, {
      message: error.message,
      code: error.code,
      time: new Date().toISOString(),
      stack: error.stack
    });
    throw error;
  }
};

// Helper function to convert streams to strings
const streamToString = (stream) => {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on('data', (chunk) => chunks.push(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
  });
};

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
    const type = event.queryStringParameters?.type; // Optional: 'hitting' or 'pitching'

    if (!assessmentId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing assessment ID parameter' }),
      };
    }

    // If type is provided, validate it
    if (type && !['hitting', 'pitching'].includes(type)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid type parameter. Must be "hitting" or "pitching".' }),
      };
    }

    const result = await db.getLandmarksForAssessment(assessmentId, type);

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

exports.processPitchingLandmarks = async (event) => {
  try {
    console.log('Processing pitching landmark file event:', JSON.stringify(event));
    
    // Get the S3 bucket and key from the event
    const bucket = event.Records[0].s3.bucket.name;
    const key = decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, ' '));
    
    console.log(`Fetching file from S3: ${bucket}/${key}`);
    
    // Get the file content
    const fileContent = await getS3FileContent(bucket, key);
    
    // Parse the data
    const landmarkData = JSON.parse(fileContent);
    
    // Log the structure of data to help with troubleshooting
    console.log('Landmark data structure:', Object.keys(landmarkData));
    
    // Insert the landmark data with a random number as assessment_id
    console.log('Inserting pitching landmark data with random ID...');
    const result = await db.insertLandmark({
      type: 'pitching',
      key: key, // Pass the S3 key to store as file_name
      ...landmarkData
    });
    
    const assessmentId = result.rows[0].assessment_id;
    const fileName = result.rows[0].file_name;
    console.log(`Successfully processed pitching landmarks with random ID: ${assessmentId}, file: ${fileName}`);
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: `Successfully processed pitching landmarks with ID: ${assessmentId}`,
        file: fileName
      })
    };
  } catch (err) {
    console.error('Pitching landmark processing error:', err.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Internal server error', 
        details: err.message 
      })
    };
  }
};

exports.processHittingLandmarks = async (event) => {
  try {
    console.log('Processing hitting landmark file event:', JSON.stringify(event));
    
    // Get the S3 bucket and key from the event
    const bucket = event.Records[0].s3.bucket.name;
    const key = decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, ' '));
    
    console.log(`Fetching file from S3: ${bucket}/${key}`);
    
    // Get the file content
    const fileContent = await getS3FileContent(bucket, key);
    
    // Parse the data
    const landmarkData = JSON.parse(fileContent);
    
    // Log the structure of data to help with troubleshooting
    console.log('Landmark data structure:', Object.keys(landmarkData));
    
    // Insert the landmark data with a random number as assessment_id
    console.log('Inserting hitting landmark data with random ID...');
    const result = await db.insertLandmark({
      type: 'hitting',
      key: key, // Pass the S3 key to store as file_name
      ...landmarkData
    });
    
    const assessmentId = result.rows[0].assessment_id;
    const fileName = result.rows[0].file_name;
    console.log(`Successfully processed hitting landmarks with random ID: ${assessmentId}, file: ${fileName}`);
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: `Successfully processed hitting landmarks with ID: ${assessmentId}`,
        file: fileName
      })
    };
  } catch (err) {
    console.error('Hitting landmark processing error:', err.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Internal server error', 
        details: err.message 
      })
    };
  }
};