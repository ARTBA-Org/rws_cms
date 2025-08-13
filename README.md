# RS CMS

A content management system built with Payload CMS and Next.js.

## Requirements

- Node.js version 18.18.2 or higher (20.9.0+ recommended)
- PostgreSQL database with SSL support
- AWS S3 compatible storage (optional)
- Algolia search (optional)

## AWS Amplify Deployment

### Environment Variables Setup

To properly deploy this application on AWS Amplify, you need to set up the following environment variables in the AWS Amplify Console:

1. Go to AWS Amplify Console > Your App > Environment variables
2. Add the following environment variables:

```
DATABASE_URI=postgresql://username:password@host:port/database?sslmode=no-verify
PAYLOAD_SECRET=your-secure-secret-key

# PostgreSQL Connection Details
PGHOST=your-postgres-host
PGPORT=5432
PGDATABASE=your-database-name
PGUSER=your-postgres-username
PGPASSWORD=your-postgres-password
PGSSLMODE=no-verify

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

When connecting to PostgreSQL with SSL (especially with self-signed certificates), use the following settings:

1. Set `sslmode=no-verify` in your DATABASE_URI connection string
2. Set `PGSSLMODE=no-verify` in your environment variables

This configuration tells PostgreSQL to use SSL but not to verify the certificate, which resolves issues with self-signed certificates.

### Automated Setup Scripts

This repository includes scripts to help you set up environment variables:

#### Local Environment Setup

```bash
# Interactive setup script for local development
npm run setup
```

#### Test Database Connection

```bash
# Test your PostgreSQL connection
npm run test:db
```

#### Update Package Lock File

```bash
# Update package-lock.json to ensure it's in sync with package.json
npm run update:lock
```

#### AWS Amplify Setup

```bash
# Set up AWS Amplify with the correct configuration
npm run setup:amplify
```

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

### Troubleshooting AWS Amplify Deployment

If you encounter issues with AWS Amplify deployment:

1. **Package Lock Synchronization Issues**: Run `npm run update:lock` locally, commit the changes, and push to your repository.
2. **Node.js Version Issues**: The project is configured to use Node.js 20.9.0 in AWS Amplify. If you need to use a different version, update the `amplify.yml` file.
3. **Build Failures**: Check the build logs for specific errors. Common issues include:
   - Missing environment variables
   - Package dependency conflicts
   - Node.js version compatibility issues

## Local Development

1. Clone the repository
2. Run `npm run setup` to set up your environment variables interactively
   - Or copy `.env.example` to `.env` and fill in the required values manually
3. Run `npm install` to install dependencies
4. Run `npm run test:db` to verify your database connection
5. Run `npm run dev` to start the development server

## Build

```
npm run build
```

## Start Production Server

```
npm start
```

## Troubleshooting

### Node.js Version Compatibility

This project is designed to work with Node.js versions 18.18.2 or higher. If you encounter any engine compatibility warnings during installation, you can:

1. Use the recommended Node.js version (20.9.0+)
2. Add `--ignore-engines` flag to your npm install command
3. Set `engine-strict=false` in your `.npmrc` file

### Database Connection Issues

If you're having trouble connecting to your PostgreSQL database:

1. Verify that your database credentials are correct
2. Ensure that the database server allows connections from your IP address
3. Check that SSL is properly configured with `sslmode=no-verify`
4. Run the database connection test with `npm run test:db`

## Attributes

- **Database**: mongodb
- **Storage Adapter**: localDisk
# Trigger rebuild Wed Aug 13 10:20:25 EDT 2025
