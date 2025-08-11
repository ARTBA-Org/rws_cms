# PDF Processor Service

A FastAPI-based microservice for converting PDFs to images and processing them with OpenAI's Vision API. Designed for deployment on Google Cloud Run.

## Features

- **PDF to Image Conversion**: Uses PyMuPDF for high-quality PDF to PNG conversion
- **AI-Powered Analysis**: Integrates with OpenAI GPT-4 Vision API for slide analysis
- **Cloud-Ready**: Optimized for Google Cloud Run deployment
- **Health Checks**: Built-in health monitoring endpoints
- **CORS Support**: Configured for web application integration

## API Endpoints

### `GET /health`
Health check endpoint for monitoring

### `POST /convert-pdf`
Convert PDF to base64-encoded images
- **Input**: PDF file (multipart/form-data)
- **Output**: JSON with base64 images array

### `POST /process-pdf-with-ai`
Convert PDF and analyze with AI
- **Input**: PDF file (multipart/form-data)  
- **Output**: JSON with AI analysis for each page

## Local Development

1. **Install dependencies**:
   ```bash
   cd pdf-processor-service
   pip install -r requirements.txt
   ```

2. **Set environment variables**:
   ```bash
   export OPENAI_API_KEY="your-openai-api-key"
   ```

3. **Run the service**:
   ```bash
   python main.py
   ```

4. **Test the service**:
   ```bash
   curl http://localhost:8080/health
   ```

## Cloud Run Deployment

### Prerequisites
- Google Cloud SDK installed and configured
- Docker installed (for local testing)
- OpenAI API key

### Quick Deploy
```bash
# Set your OpenAI API key
export OPENAI_API_KEY="your-openai-api-key-here"

# Deploy to Cloud Run
./deploy.sh your-gcp-project-id us-central1
```

### Manual Deployment
```bash
# Build and push image
docker build -t gcr.io/YOUR_PROJECT_ID/pdf-processor-service .
docker push gcr.io/YOUR_PROJECT_ID/pdf-processor-service

# Deploy to Cloud Run
gcloud run deploy pdf-processor-service \
  --image gcr.io/YOUR_PROJECT_ID/pdf-processor-service \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --set-env-vars OPENAI_API_KEY="your-key" \
  --memory 2Gi \
  --cpu 2 \
  --timeout 300
```

## Configuration

### Environment Variables
- `OPENAI_API_KEY`: Required for AI processing
- `PORT`: Server port (default: 8080)

### Resource Requirements
- **Memory**: 2GB (recommended for PDF processing)
- **CPU**: 2 vCPU (for concurrent processing)
- **Timeout**: 300 seconds (for large PDFs)

## Integration with Next.js App

Update your Next.js application to use this service:

```typescript
// src/utils/cloudRunPdfService.ts
export async function convertPdfToImages(pdfBuffer: Buffer): Promise<Buffer[]> {
  const cloudRunUrl = process.env.PDF_PROCESSOR_CLOUD_RUN_URL;
  
  const formData = new FormData();
  formData.append('file', new Blob([pdfBuffer]), 'document.pdf');

  const response = await fetch(`${cloudRunUrl}/process-pdf-with-ai`, {
    method: 'POST',
    body: formData,
  });

  const result = await response.json();
  return result.results;
}
```

## Monitoring

The service includes:
- Health check endpoint at `/health`
- Structured logging with request/response details
- Error handling with appropriate HTTP status codes

## Security

- Runs as non-root user in container
- CORS configured (update for production)
- No persistent storage of uploaded files
- Environment-based configuration