#!/bin/bash

# Script to set up AWS Systems Manager Parameter Store parameters for an Amplify app

set -e

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo "AWS CLI is not installed. Please install it first."
    exit 1
fi

# Check if jq is installed
if ! command -v jq &> /dev/null; then
    echo "jq is not installed. Please install it first."
    exit 1
fi

# Function to create a parameter
create_param() {
    local name=$1
    local value=$2
    local type=$3
    local path="/amplify/${APP_ID}/${BRANCH_NAME}/${name}"
    
    echo "Creating parameter: $path"
    aws ssm put-parameter \
        --name "$path" \
        --value "$value" \
        --type "$type" \
        --overwrite
}

# Get command line arguments
APP_ID=$1
BRANCH_NAME=$2

if [ -z "$APP_ID" ] || [ -z "$BRANCH_NAME" ]; then
    echo "Usage: $0 <app-id> <branch-name>"
    exit 1
fi

# Load environment variables from .env file if it exists
if [ -f .env ]; then
    echo "Loading environment variables from .env file"
    export $(grep -v '^#' .env | xargs)
fi

# Create parameters
create_param "DATABASE_URI" "${DATABASE_URI}" "SecureString"
create_param "PAYLOAD_SECRET" "${PAYLOAD_SECRET}" "SecureString"

# PostgreSQL Connection Details
create_param "PGHOST" "${PGHOST}" "String"
create_param "PGPORT" "${PGPORT:-5432}" "String"
create_param "PGDATABASE" "${PGDATABASE}" "String"
create_param "PGUSER" "${PGUSER}" "String"
create_param "PGPASSWORD" "${PGPASSWORD}" "SecureString"
create_param "PGSSLMODE" "${PGSSLMODE:-no-verify}" "String"

# AWS S3 Configuration
create_param "AWS_ACCESS_KEY" "${AWS_ACCESS_KEY}" "SecureString"
create_param "AWS_SECRET_KEY" "${AWS_SECRET_KEY}" "SecureString"
create_param "AWS_REGION" "${AWS_REGION}" "String"
create_param "AWS_ENDPOINT" "${AWS_ENDPOINT}" "String"

# Algolia Search Configuration
create_param "ALGOLIA_APP_ID" "${ALGOLIA_APP_ID}" "String"
create_param "ALGOLIA_ADMIN_API_KEY" "${ALGOLIA_ADMIN_API_KEY}" "SecureString"
create_param "ALGOLIA_INDEX" "${ALGOLIA_INDEX:-rs_cms}" "String"

echo "Parameters created successfully in path: /amplify/${APP_ID}/${BRANCH_NAME}/"
echo "Make sure to grant your Amplify app access to these parameters." 