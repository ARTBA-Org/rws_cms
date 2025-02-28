#!/bin/bash

# This script helps set up AWS Amplify environment variables for your app
# Usage: ./setup-amplify-env.sh <app-id> <branch-name>

if [ "$#" -ne 2 ]; then
    echo "Usage: $0 <app-id> <branch-name>"
    echo "Example: $0 d335csi5l6xsl9 main"
    exit 1
fi

APP_ID=$1
BRANCH_NAME=$2

# Load environment variables from .env file
if [ -f .env ]; then
    echo "Loading environment variables from .env file..."
    source .env
else
    echo "Error: .env file not found. Please create it first."
    exit 1
fi

# Function to create or update Amplify environment variable
create_env_var() {
    local name=$1
    local value=$2
    
    if [ -z "$value" ]; then
        echo "Warning: Value for $name is empty. Skipping..."
        return
    fi
    
    echo "Creating/updating environment variable: $name"
    aws amplify update-app \
        --app-id "$APP_ID" \
        --environment-variables "$name=$value"
}

# Create all environment variables in one call
ENV_VARS=""

# Add each environment variable to the list
add_env_var() {
    local name=$1
    local value=$2
    
    if [ -z "$value" ]; then
        return
    fi
    
    if [ -z "$ENV_VARS" ]; then
        ENV_VARS="$name=$value"
    else
        ENV_VARS="$ENV_VARS,$name=$value"
    fi
}

# Add all environment variables
add_env_var "DATABASE_URI" "$DATABASE_URI"
add_env_var "PAYLOAD_SECRET" "$PAYLOAD_SECRET"

# PostgreSQL Connection Details
add_env_var "PGHOST" "$PGHOST"
add_env_var "PGPORT" "$PGPORT"
add_env_var "PGDATABASE" "$PGDATABASE"
add_env_var "PGUSER" "$PGUSER"
add_env_var "PGPASSWORD" "$PGPASSWORD"
add_env_var "PGSSLMODE" "${PGSSLMODE:-no-verify}"

# Algolia Search Configuration
add_env_var "ALGOLIA_APP_ID" "$ALGOLIA_APP_ID"
add_env_var "ALGOLIA_ADMIN_API_KEY" "$ALGOLIA_ADMIN_API_KEY"
add_env_var "ALGOLIA_INDEX" "${ALGOLIA_INDEX:-rs_cms}"

# AWS S3 Configuration
add_env_var "AWS_ACCESS_KEY" "$AWS_ACCESS_KEY"
add_env_var "AWS_SECRET_KEY" "$AWS_SECRET_KEY"
add_env_var "AWS_REGION" "$AWS_REGION"
add_env_var "AWS_ENDPOINT" "$AWS_ENDPOINT"

# Update the app with all environment variables
if [ -n "$ENV_VARS" ]; then
    echo "Updating Amplify app with environment variables..."
    aws amplify update-app \
        --app-id "$APP_ID" \
        --environment-variables "$ENV_VARS"
    
    echo "Done! Environment variables updated for app $APP_ID."
else
    echo "No environment variables to update."
fi 