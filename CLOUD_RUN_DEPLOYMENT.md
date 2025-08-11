# Deploy RWS CMS to Google Cloud Run with Full PDF Processing

This guide will help you deploy your RWS CMS to Google Cloud Run with full PDF processing capabilities, including ImageMagick and GraphicsMagick for proper PDF to image conversion.

## Prerequisites

1. **Google Cloud CLI installed**: [Install gcloud](https://cloud.google.com/sdk/docs/install)
2. **Docker installed**: [Install Docker](https://docs.docker.com/get-docker/)
3. **Google Cloud Project with billing enabled**

## Step 1: Enable Required APIs

Run these commands to enable the necessary APIs:

```bash
# Set your project ID
export PROJECT_ID="your-project-id"
gcloud config set project $PROJECT_ID

# Enable required APIs
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable containerregistry.googleapis.com
```

## Step 2: Prepare Environment Variables

Update your `.env` file with the Cloud Run URL (you'll get this after deployment):

```bash
# Update this after deployment
PAYLOAD_PUBLIC_SERVER_URL=https://rws-cms-[hash]-uc.a.run.app
```

## Step 3: Deploy to Cloud Run

### Option A: Using the deployment script (Recommended)

```bash
# Make the script executable
chmod +x deploy-cloud-run.sh

# Run the deployment
./deploy-cloud-run.sh
```

### Option B: Manual deployment

```bash
# Set variables
PROJECT_ID="your-project-id"
SERVICE_NAME="rws-cms"
REGION="us-central1"

# Build and push the container
gcloud builds submit --tag gcr.io/$PROJECT_ID/$SERVICE_NAME

# Deploy to Cloud Run
gcloud run deploy $SERVICE_NAME \
  --image gcr.io/$PROJECT_ID/$SERVICE_NAME \
  --region $REGION \
  --platform managed \
  --allow-unauthenticated \
  --memory 2Gi \
  --cpu 2 \
  --timeout 900 \
  --concurrency 10 \
  --max-instances 10 \
  --set-env-vars "NODE_ENV=production"

# Set environment variables from .env file
gcloud run services update $SERVICE_NAME \
  --region $REGION \
  --set-env-vars "$(cat .env | grep -v '^#' | grep -v '^$' | tr '\n' ',' | sed 's/,$//')"
```

## Step 4: Update Server URL

After deployment, you'll get a Cloud Run URL. Update your `.env` file:

```bash
# Replace with your actual Cloud Run URL
PAYLOAD_PUBLIC_SERVER_URL=https://rws-cms-[hash]-uc.a.run.app
```

Then redeploy to apply the new environment variable:

```bash
gcloud run services update rws-cms \
  --region us-central1 \
  --set-env-vars "PAYLOAD_PUBLIC_SERVER_URL=https://your-actual-url"
```

## Step 5: Test PDF Processing

1. Go to your Cloud Run URL + `/admin`
2. Log in to the admin panel
3. Create or edit a module
4. Upload a PDF file
5. Click "🚀 Process PDF into Slides"
6. Watch the logs: `gcloud run services logs tail rws-cms --region us-central1`

## Features Enabled in Cloud Run

✅ **Full PDF Processing**: ImageMagick and GraphicsMagick installed
✅ **High-Quality Images**: 200 DPI, 1200x1600 resolution
✅ **AI Analysis**: OpenAI integration for slide analysis
✅ **Scalable**: Auto-scaling from 0 to 10 instances
✅ **Fast**: 2 vCPU, 2GB RAM per instance
✅ **Reliable**: 15-minute timeout for large PDFs

## Monitoring and Logs

```bash
# View logs
gcloud run services logs tail rws-cms --region us-central1

# View service details
gcloud run services describe rws-cms --region us-central1

# Update service
gcloud run services update rws-cms --region us-central1 [options]
```

## Troubleshooting

### PDF Processing Issues
- Check logs for ImageMagick errors
- Verify OpenAI API key is set
- Ensure sufficient memory (2GB recommended)

### Database Connection Issues
- Verify DATABASE_URI is correct
- Check Supabase connection limits
- Ensure SSL mode is properly configured

### File Upload Issues
- Verify AWS S3 credentials
- Check Supabase storage configuration
- Ensure proper CORS settings

## Cost Optimization

- **CPU**: 2 vCPU (can reduce to 1 for lighter workloads)
- **Memory**: 2GB (minimum for PDF processing)
- **Timeout**: 900s (15 minutes for large PDFs)
- **Concurrency**: 10 (adjust based on usage)
- **Max Instances**: 10 (adjust based on expected load)

## Security

- Service allows unauthenticated access (required for public CMS)
- Database credentials are in environment variables
- S3 credentials are in environment variables
- Consider using Google Secret Manager for production

Your CMS will be fully functional on Cloud Run with professional PDF processing capabilities!