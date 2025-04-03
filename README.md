# Landmark Data API

This API serves landmark data from an AWS PostgreSQL database and is deployed as an AWS Lambda function with a custom domain.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Update VPC configuration in `serverless.yml`:
   - Replace the `securityGroupIds` and `subnetIds` with your actual VPC configuration that can access your RDS instance.

## Local Development

Start the API locally with:
```bash
npm run dev
```

This will start the API on port 3000 (or the port specified in the PORT environment variable).

## Deployment

Deploy to AWS Lambda:
```bash
npm run deploy
```

## API Endpoints

- `GET /health`: Health check endpoint
- `GET /api/landmarks/:assessmentId`: Fetch landmark data for a specific assessment ID

### Endpoint Details

#### GET /api/landmarks/:assessmentId

Returns landmark data for a specific assessment ID.

**Parameters:**
- `assessmentId` (path parameter): The ID of the assessment to retrieve landmark data for

**Success Response (200):**
```json
[
  {
    "id": 123,
    "assessment_id": "example-id",
    "landmark_data": { ... },
    ...
  }
]
```

**Error Responses:**
- 400: Missing assessment ID parameter
- 404: No landmark data found for the specified assessment ID
- 500: Database query failed

## Environment Variables

The following environment variables can be set in the `serverless.yml` file:
- `NODE_ENV`: Set to 'production' for Lambda deployment