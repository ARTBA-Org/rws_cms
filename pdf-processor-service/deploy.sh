#!/bin/bash

# PDF Processor Service Deployment Script
set -e

# Configuration
PROJECT_ID=${1:-"your-gcp-project-id"}
REGION=${2:-"us-central1"}
SERVICE_NAME="pdf-processor-service"
OPENAI_API_KEY=${OPENAI_API_KEY:-""}

if [ -z "$OPENAI_API_KEY" ]; then
    echo "Error: OPENAI_API_KEY environment variable is required"
    echo "Usage: OPENAI_API_KEY=your-key ./deploy.sh [PROJECT_ID] [REGION]"
    exit 1
fi

echo "🚀 Deploying PDF Processor Service to Cloud Run..."
echo "Project: $PROJECT_ID"
echo "Region: $REGION"
echo "Service: $SERVICE_NAME"

# Build and deploy using Cloud Build
gcloud builds submit \
    --config cloudbuild.yaml \
    --substitutions _OPENAI_API_KEY="$OPENAI_API_KEY" \
    --project "$PROJECT_ID"

# Get the service URL
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME \
    --region=$REGION \
    --project=$PROJECT_ID \
    --format="value(status.url)")

echo "✅ Deployment complete!"
echo "Service URL: $SERVICE_URL"
echo ""
echo "Test endpoints:"
echo "Health check: $SERVICE_URL/health"
echo "Convert PDF: $SERVICE_URL/convert-pdf"
echo "AI Processing: $SERVICE_URL/process-pdf-with-ai"
echo ""
echo "Add this to your .env file:"
echo "PDF_PROCESSOR_CLOUD_RUN_URL=$SERVICE_URL"