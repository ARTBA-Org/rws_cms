#!/bin/bash

# Quick deployment script for RWS CMS to Cloud Run

set -e

echo "🚀 Quick Deploy RWS CMS to Google Cloud Run"
echo "============================================"

# Check if project is set
PROJECT_ID=$(gcloud config get-value project 2>/dev/null)
if [ -z "$PROJECT_ID" ]; then
    echo "❌ No project set. Please run:"
    echo "   gcloud config set project YOUR_PROJECT_ID"
    exit 1
fi

echo "📋 Using project: $PROJECT_ID"

# Enable APIs
echo "🔧 Enabling required APIs..."
gcloud services enable cloudbuild.googleapis.com run.googleapis.com containerregistry.googleapis.com --quiet

# Build and deploy
echo "🏗️  Building and deploying..."
gcloud run deploy rws-cms \
    --source . \
    --region us-central1 \
    --platform managed \
    --allow-unauthenticated \
    --memory 2Gi \
    --cpu 2 \
    --timeout 900 \
    --concurrency 10 \
    --max-instances 10 \
    --quiet

# Get the service URL
SERVICE_URL=$(gcloud run services describe rws-cms --region us-central1 --format="value(status.url)")

echo "✅ Deployment complete!"
echo "🌐 Service URL: $SERVICE_URL"
echo "📊 Admin Panel: $SERVICE_URL/admin"
echo ""
echo "📝 Next steps:"
echo "1. Update PAYLOAD_PUBLIC_SERVER_URL in .env to: $SERVICE_URL"
echo "2. Run this script again to apply the new environment variable"
echo "3. Test PDF processing in the admin panel"