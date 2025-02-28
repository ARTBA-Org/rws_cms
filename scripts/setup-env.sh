#!/bin/bash

# Script to set up environment variables for RS CMS
# This script helps users set up their .env file with the correct SSL configuration

set -e

echo "RS CMS Environment Setup"
echo "========================"
echo "This script will help you set up your environment variables for RS CMS."
echo "It will create a .env file with the correct SSL configuration."
echo ""

# Check if .env file already exists
if [ -f .env ]; then
  read -p ".env file already exists. Do you want to overwrite it? (y/n): " overwrite
  if [ "$overwrite" != "y" ]; then
    echo "Aborting setup."
    exit 0
  fi
fi

# PostgreSQL Connection Details
read -p "PostgreSQL Host: " pghost
read -p "PostgreSQL Port (default: 5432): " pgport
pgport=${pgport:-5432}
read -p "PostgreSQL Database: " pgdatabase
read -p "PostgreSQL User: " pguser
read -sp "PostgreSQL Password: " pgpassword
echo ""

# Generate DATABASE_URI with sslmode=no-verify
database_uri="postgresql://$pguser:$pgpassword@$pghost:$pgport/$pgdatabase?sslmode=no-verify"

# Payload Secret
read -p "Payload Secret (leave blank to generate one): " payload_secret
if [ -z "$payload_secret" ]; then
  payload_secret=$(openssl rand -base64 32)
  echo "Generated Payload Secret: $payload_secret"
fi

# Algolia Configuration
read -p "Algolia App ID (optional): " algolia_app_id
read -p "Algolia Admin API Key (optional): " algolia_admin_api_key
read -p "Algolia Index (default: rs_cms): " algolia_index
algolia_index=${algolia_index:-rs_cms}

# AWS S3 Configuration
read -p "AWS Access Key (optional): " aws_access_key
read -p "AWS Secret Key (optional): " aws_secret_key
read -p "AWS Region (default: us-west-1): " aws_region
aws_region=${aws_region:-us-west-1}
read -p "AWS Endpoint (optional): " aws_endpoint

# Create .env file
cat > .env << EOF
# Added by Payload
DATABASE_URI=$database_uri
PGHOST=$pghost
PGPORT=$pgport
PGDATABASE=$pgdatabase
PGUSER=$pguser
PGPASSWORD=$pgpassword
PGSSLMODE=no-verify

PAYLOAD_SECRET=$payload_secret
EOF

# Add Algolia configuration if provided
if [ -n "$algolia_app_id" ]; then
  cat >> .env << EOF
ALGOLIA_APP_ID=$algolia_app_id
ALGOLIA_ADMIN_API_KEY=$algolia_admin_api_key
ALGOLIA_INDEX=$algolia_index
EOF
fi

# Add AWS S3 configuration if provided
if [ -n "$aws_access_key" ]; then
  cat >> .env << EOF

# AWS S3 Configuration
AWS_ACCESS_KEY=$aws_access_key
AWS_SECRET_KEY=$aws_secret_key
AWS_REGION=$aws_region
AWS_ENDPOINT=$aws_endpoint
EOF
fi

echo ""
echo "Environment variables have been set up successfully!"
echo "You can now run 'npm run dev' to start the development server."
echo ""
echo "To test your database connection, run:"
echo "node scripts/test-db-connection.js" 