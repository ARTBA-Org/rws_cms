#!/bin/bash

# This script helps set up AWS SSM parameters for your Amplify app
# Usage: ./setup-ssm-params.sh <app-id> <branch-name>

if [ "$#" -ne 2 ]; then
    echo "Usage: $0 <app-id> <branch-name>"
    echo "Example: $0 d335csi5l6xsl9 main"
    exit 1
fi

APP_ID=$1
BRANCH_NAME=$2
BASE_PATH="/amplify/$APP_ID/$BRANCH_NAME"

# Load environment variables from .env file
if [ -f .env ]; then
    echo "Loading environment variables from .env file..."
    source .env
else
    echo "Error: .env file not found. Please create it first."
    exit 1
fi

# Function to create or update SSM parameter
create_param() {
    local name=$1
    local value=$2
    local type=$3
    
    if [ -z "$value" ]; then
        echo "Warning: Value for $name is empty. Skipping..."
        return
    fi
    
    echo "Creating/updating parameter: $BASE_PATH/$name"
    aws ssm put-parameter \
        --name "$BASE_PATH/$name" \
        --value "$value" \
        --type "$type" \
        --overwrite
}

# Create parameters
create_param "DATABASE_URI" "$DATABASE_URI" "SecureString"
create_param "PAYLOAD_SECRET" "$PAYLOAD_SECRET" "SecureString"

# PostgreSQL Connection Details
create_param "PGHOST" "$PGHOST" "String"
create_param "PGPORT" "$PGPORT" "String"
create_param "PGDATABASE" "$PGDATABASE" "String"
create_param "PGUSER" "$PGUSER" "String"
create_param "PGPASSWORD" "$PGPASSWORD" "SecureString"
create_param "PGSSLMODE" "$PGSSLMODE" "String"

# PostgreSQL SSL Configuration
create_param "PG_SSL_ENABLED" "${PG_SSL_ENABLED:-true}" "String"
create_param "PG_SSL_REJECT_UNAUTHORIZED" "${PG_SSL_REJECT_UNAUTHORIZED:-false}" "String"
if [ -n "$PG_SSL_CA_FILE" ]; then
    create_param "PG_SSL_CA_FILE" "$PG_SSL_CA_FILE" "String"
fi

# Algolia Search Configuration
create_param "ALGOLIA_APP_ID" "$ALGOLIA_APP_ID" "String"
create_param "ALGOLIA_ADMIN_API_KEY" "$ALGOLIA_ADMIN_API_KEY" "SecureString"
create_param "ALGOLIA_INDEX" "$ALGOLIA_INDEX" "String"

# AWS S3 Configuration
create_param "AWS_ACCESS_KEY" "$AWS_ACCESS_KEY" "SecureString"
create_param "AWS_SECRET_KEY" "$AWS_SECRET_KEY" "SecureString"
create_param "AWS_REGION" "$AWS_REGION" "String"
create_param "AWS_ENDPOINT" "$AWS_ENDPOINT" "String"

echo "Done! Parameters created under $BASE_PATH/"
echo "Make sure your Amplify app has permissions to access these parameters." 