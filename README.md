# RS CMS

A content management system built with Payload CMS and Next.js.

## AWS Amplify Deployment

### Environment Variables Setup

To properly deploy this application on AWS Amplify, you need to set up the following environment variables in the AWS Amplify Console:

1. Go to AWS Amplify Console > Your App > Environment variables
2. Add the following environment variables:

```
DATABASE_URI=postgresql://username:password@host:port/database?sslmode=require
PAYLOAD_SECRET=your-secure-secret-key

# PostgreSQL Connection Details
PGHOST=your-postgres-host
PGPORT=5432
PGDATABASE=your-database-name
PGUSER=your-postgres-username
PGPASSWORD=your-postgres-password
PGSSLMODE=require

# PostgreSQL SSL Configuration
# Set to 'true' to enable SSL, 'false' to disable
PG_SSL_ENABLED=true
# Set to 'false' to accept self-signed certificates
PG_SSL_REJECT_UNAUTHORIZED=false
# Optional: Path to CA certificate file if needed
# PG_SSL_CA_FILE=/path/to/ca-certificate.crt

# AWS S3 Configuration
AWS_ACCESS_KEY=your-aws-access-key
AWS_SECRET_KEY=your-aws-secret-key
AWS_REGION=us-west-1
AWS_ENDPOINT=your-s3-endpoint

# Algolia Search Configuration
ALGOLIA_APP_ID=your-algolia-app-id
ALGOLIA_ADMIN_API_KEY=your-algolia-admin-api-key
ALGOLIA_INDEX=rs_cms
```

### SSL Configuration for PostgreSQL

If you're using a PostgreSQL database with SSL enabled (especially with self-signed certificates), you need to configure the SSL settings:

1. Set `PG_SSL_ENABLED=true` to enable SSL (default)
2. Set `PG_SSL_REJECT_UNAUTHORIZED=false` to accept self-signed certificates
3. Optionally, provide a CA certificate file path with `PG_SSL_CA_FILE` if needed

These settings help resolve SSL certificate validation issues when connecting to PostgreSQL.

### Automated Setup Scripts

This repository includes scripts to help you set up environment variables:

#### AWS Amplify Environment Variables

```bash
# Set up environment variables directly in Amplify Console
./scripts/setup-amplify-env.sh <app-id> <branch-name>
```

#### AWS Systems Manager Parameter Store

For enhanced security, you can store sensitive environment variables in AWS Systems Manager Parameter Store:

```bash
# Set up SSM parameters for your Amplify app
./scripts/setup-ssm-params.sh <app-id> <branch-name>
```

After setting up SSM parameters:

1. In AWS Amplify Console, enable "Access to AWS services" 
2. Grant permissions to access SSM parameters with the path `/amplify/{app-id}/{branch-name}/`

#### IAM Policy for SSM Parameters

Use the provided IAM policy template to grant your Amplify app access to SSM parameters:

1. Go to IAM > Policies > Create policy
2. Use the JSON editor and paste the content from `scripts/amplify-ssm-policy.json`
3. Replace `${AppId}` and `${BranchName}` with your actual values
4. Name the policy (e.g., `AmplifySSMAccess-<app-name>`) and create it
5. Attach this policy to the IAM role used by your Amplify app

## Local Development

1. Clone the repository
2. Copy `.env.example` to `.env` and fill in the required values
3. Run `npm install` to install dependencies
4. Run `npm run dev` to start the development server

## Build

```
npm run build
```

## Start Production Server

```
npm start
```

## Attributes

- **Database**: mongodb
- **Storage Adapter**: localDisk
