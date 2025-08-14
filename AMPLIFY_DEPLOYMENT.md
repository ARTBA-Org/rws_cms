# AWS Amplify Deployment Guide

## Overview

This application has been configured to work with AWS Amplify hosting. The main changes include:

### 🔧 Production Environment Handling

- **PDF Processing**: Disabled in production due to server-side dependencies (pdf2pic, canvas)
- **Error Boundaries**: Added to handle runtime errors gracefully
- **Environment Detection**: Components now detect production environment and show appropriate messages

### 📁 New Files Created

1. **`src/app/page.tsx`** - Root page that redirects to admin
2. **`src/app/layout.tsx`** - Root layout with error boundary
3. **`src/app/pdf-import/[moduleId]/page.tsx`** - PDF import interface
4. **`src/app/test/page.tsx`** - Deployment test page
5. **`src/app/api/health/route.ts`** - Health check endpoint
6. **`src/components/ErrorBoundary.tsx`** - Error handling component

### 🚀 Deployment Process

The `amplify.yml` file handles the build process:

1. **Pre-build**: Runs `scripts/fix-amplify-build.js` to fix common issues
2. **Build**: Sets environment variables and builds with database connection skipped
3. **Artifacts**: Outputs the `.next` directory

### 🌐 Available Routes

After deployment, these routes will be available:

- `/` - Redirects to `/admin`
- `/admin` - Payload CMS admin panel
- `/test` - Deployment verification page
- `/pdf-import/[moduleId]` - PDF import interface (shows production notice)
- `/api/health` - Health check API

### ⚠️ Production Limitations

**PDF Processing is disabled in production** because:

1. **Dependencies**: `pdf2pic` requires system-level dependencies (GraphicsMagick/ImageMagick)
2. **Canvas**: Node.js canvas library needs native compilation
3. **Worker Threads**: Limited support in serverless environments

### 🔧 Environment Variables

Set these in Amplify Console → App Settings → Environment Variables:

```bash
# Database (Required)
DATABASE_URI=your_database_connection_string
PAYLOAD_SECRET=your_payload_secret

# AWS S3 Storage (Required)
AWS_ACCESS_KEY=your_s3_access_key
AWS_SECRET_KEY=your_s3_secret_key
AWS_REGION=your_s3_region
AWS_ENDPOINT=your_s3_endpoint
AWS_BUCKET=your_s3_bucket

# Optional: Enable PDF processing in production (requires additional setup)
ENABLE_PDF_PROCESSING=false

# Algolia Search (Optional)
ALGOLIA_APP_ID=your_algolia_app_id
ALGOLIA_ADMIN_API_KEY=your_algolia_admin_key
ALGOLIA_INDEX=your_algolia_index

# OpenAI (Optional, for AI features)
OPENAI_API_KEY=your_openai_api_key
```

### 🧪 Testing the Deployment

1. Visit `/test` to verify the deployment
2. Check `/api/health` for system status
3. Access `/admin` for the CMS interface
4. Try `/pdf-import/test` to see the production notice

### 🔄 Local Development vs Production

| Feature | Local Development | Production |
|---------|------------------|------------|
| PDF Processing | ✅ Fully functional | ❌ Disabled |
| Admin Panel | ✅ Available | ✅ Available |
| File Upload | ✅ Available | ✅ Available |
| Database | ✅ Connected | ✅ Connected |
| Error Handling | ✅ Detailed errors | ✅ User-friendly errors |

### 🐛 Troubleshooting

**Build Failures:**
- Check that all environment variables are set in Amplify Console
- Verify the `scripts/fix-amplify-build.js` runs successfully
- Look for TypeScript or ESLint errors in build logs

**Runtime Errors:**
- Check `/api/health` endpoint for system status
- Verify database connection string is correct
- Ensure S3 credentials have proper permissions

**PDF Processing Issues:**
- This is expected in production - feature is intentionally disabled
- For local development, ensure all dependencies are installed
- Consider using external PDF processing services for production

### 🚀 Next Steps

To enable PDF processing in production, consider:

1. **External Service**: Use services like ConvertAPI or Cloudinary
2. **Lambda Functions**: Deploy PDF processing as separate Lambda functions
3. **Container Deployment**: Use AWS ECS/Fargate with proper dependencies
4. **Hybrid Approach**: Process PDFs locally, upload results to production

### 📞 Support

If you encounter issues:

1. Check the deployment test page at `/test`
2. Review the health check at `/api/health`
3. Check Amplify build logs in the console
4. Verify all environment variables are properly set