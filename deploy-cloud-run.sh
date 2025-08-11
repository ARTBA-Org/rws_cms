#!/bin/bash

# Cloud Run deployment script for RWS CMS with PDF processing

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Deploying RWS CMS to Google Cloud Run${NC}"

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}❌ gcloud CLI is not installed. Please install it first.${NC}"
    exit 1
fi

# Check if user is authenticated
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q .; then
    echo -e "${YELLOW}⚠️  Not authenticated with gcloud. Please run: gcloud auth login${NC}"
    exit 1
fi

# Get project ID
PROJECT_ID=$(gcloud config get-value project)
if [ -z "$PROJECT_ID" ]; then
    echo -e "${RED}❌ No project set. Please run: gcloud config set project YOUR_PROJECT_ID${NC}"
    exit 1
fi

echo -e "${GREEN}📋 Using project: $PROJECT_ID${NC}"

# Set region
REGION="us-central1"
SERVICE_NAME="rws-cms"

echo -e "${GREEN}🔧 Building and deploying to Cloud Run...${NC}"

# Build and deploy using Cloud Build
gcloud builds submit --config cloudbuild.yaml \
    --substitutions=_SERVICE_NAME=$SERVICE_NAME,_REGION=$REGION

echo -e "${GREEN}🔧 Setting environment variables...${NC}"

# Set environment variables from .env file
if [ -f .env ]; then
    # Read .env file and convert to Cloud Run format
    ENV_VARS=""
    while IFS='=' read -r key value; do
        # Skip comments and empty lines
        if [[ $key =~ ^[[:space:]]*# ]] || [[ -z $key ]]; then
            continue
        fi
        
        # Remove quotes from value if present
        value=$(echo "$value" | sed 's/^"\(.*\)"$/\1/' | sed "s/^'\(.*\)'$/\1/")
        
        if [ -n "$ENV_VARS" ]; then
            ENV_VARS="$ENV_VARS,$key=$value"
        else
            ENV_VARS="$key=$value"
        fi
    done < .env
    
    # Update the service with environment variables
    gcloud run services update $SERVICE_NAME \
        --region=$REGION \
        --set-env-vars="$ENV_VARS" \
        --memory=2Gi \
        --cpu=2 \
        --timeout=900 \
        --concurrency=10 \
        --max-instances=10
else
    echo -e "${YELLOW}⚠️  No .env file found. You'll need to set environment variables manually.${NC}"
fi

# Get the service URL
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --region=$REGION --format="value(status.url)")

echo -e "${GREEN}✅ Deployment complete!${NC}"
echo -e "${GREEN}🌐 Service URL: $SERVICE_URL${NC}"
echo -e "${GREEN}📊 Admin Panel: $SERVICE_URL/admin${NC}"

echo -e "${YELLOW}📝 Next steps:${NC}"
echo -e "1. Update your PAYLOAD_PUBLIC_SERVER_URL in .env to: $SERVICE_URL"
echo -e "2. Redeploy if you changed the server URL"
echo -e "3. Test the PDF processing feature in the admin panel"

echo -e "${GREEN}🎉 Your CMS is now running on Cloud Run with full PDF processing capabilities!${NC}"