# PDF Processing Webhook Integration

## Overview

The PDF processing system now includes comprehensive webhook notifications that notify external systems about processing events in real-time. This enables building responsive UIs, triggering downstream processes, and monitoring job progress.

## Webhook Events

### 1. `pdf.processing.started`
Fired when a PDF processing job begins.

**Payload:**
```json
{
  "event": "pdf.processing.started",
  "jobId": "pdf-module123-1640995200000",
  "moduleId": "module123",
  "timestamp": 1640995200000,
  "data": {
    "metadata": {
      "pdfUrl": "https://example.com/document.pdf",
      "pdfFilename": "document.pdf",
      "streaming": false,
      "options": {
        "enableImages": true,
        "maxPages": 50
      }
    }
  },
  "signature": "sha256=abc123..." // If secret configured
}
```

### 2. `pdf.processing.progress`
Fired periodically during processing (every 5 pages for streaming, every 10% for traditional processing).

**Payload:**
```json
{
  "event": "pdf.processing.progress",
  "jobId": "pdf-module123-1640995200000",
  "moduleId": "module123",
  "timestamp": 1640995260000,
  "data": {
    "progress": {
      "processedPages": 15,
      "totalPages": 30,
      "createdSlides": 12,
      "currentPage": 15,
      "status": "processing"
    }
  }
}
```

### 3. `pdf.processing.completed`
Fired when processing completes successfully.

**Payload:**
```json
{
  "event": "pdf.processing.completed",
  "jobId": "pdf-module123-1640995200000",
  "moduleId": "module123",
  "timestamp": 1640995500000,
  "data": {
    "result": {
      "success": true,
      "slidesCreated": 25,
      "slideIds": [1, 2, 3, "..."],
      "moduleUpdated": true,
      "textExtracted": true,
      "imagesGenerated": true,
      "totalPages": 30,
      "pagesProcessed": 30,
      "timeElapsed": 45000
    },
    "metadata": {
      "timeElapsed": 300000,
      "jobId": "pdf-module123-1640995200000",
      "streaming": false
    }
  }
}
```

### 4. `pdf.processing.failed`
Fired when processing fails.

**Payload:**
```json
{
  "event": "pdf.processing.failed",
  "jobId": "pdf-module123-1640995200000",
  "moduleId": "module123",
  "timestamp": 1640995300000,
  "data": {
    "error": "Failed to fetch PDF: 404 Not Found",
    "metadata": {
      "timeElapsed": 5000,
      "jobId": "pdf-module123-1640995200000",
      "pdfUrl": "https://example.com/document.pdf",
      "pdfFilename": "document.pdf"
    }
  }
}
```

## Setup & Configuration

### 1. Environment Variables
Configure webhooks via environment variables:

```bash
# Global webhook URL (optional)
PDF_WEBHOOK_URL=https://your-api.com/webhooks/pdf
PDF_WEBHOOK_SECRET=your-secret-key
PDF_WEBHOOK_TIMEOUT=10000
PDF_WEBHOOK_RETRIES=3
```

### 2. API Registration
Register webhooks programmatically via API:

```bash
# Register a global webhook
curl -X POST /api/webhooks/pdf \
  -H "Content-Type: application/json" \
  -d '{
    "key": "global",
    "url": "https://your-api.com/webhooks/pdf",
    "secret": "your-secret-key",
    "timeout": 10000,
    "retries": 3,
    "headers": {
      "Authorization": "Bearer your-token"
    }
  }'

# Register a module-specific webhook
curl -X POST /api/webhooks/pdf \
  -H "Content-Type: application/json" \
  -d '{
    "key": "module:module123",
    "url": "https://your-api.com/webhooks/pdf/module123",
    "secret": "module-secret"
  }'
```

### 3. List Registered Webhooks
```bash
curl /api/webhooks/pdf
```

### 4. Remove a Webhook
```bash
curl -X DELETE /api/webhooks/pdf \
  -H "Content-Type: application/json" \
  -d '{"key": "global"}'
```

## Security

### HMAC Signature Verification
When a webhook secret is configured, each payload includes an HMAC-SHA256 signature:

```javascript
// Verify webhook signature
const crypto = require('crypto')

function verifyWebhookSignature(payload, signature, secret) {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex')
  
  return signature === `sha256=${expectedSignature}`
}

// Express.js example
app.post('/webhooks/pdf', express.raw({type: 'application/json'}), (req, res) => {
  const signature = req.headers['x-hub-signature-256'] || req.body.signature
  const payload = req.body.toString()
  
  if (!verifyWebhookSignature(payload, signature, process.env.WEBHOOK_SECRET)) {
    return res.status(401).send('Invalid signature')
  }
  
  const event = JSON.parse(payload)
  console.log(`Received ${event.event} for job ${event.jobId}`)
  
  res.status(200).send('OK')
})
```

## Testing

### Send Test Webhooks
```bash
# Test completion webhook
curl -X POST /api/webhooks/pdf/test \
  -H "Content-Type: application/json" \
  -d '{
    "event": "pdf.processing.completed",
    "jobId": "test-123",
    "moduleId": "test-module",
    "includeResult": true
  }'

# Test progress webhook
curl -X POST /api/webhooks/pdf/test \
  -H "Content-Type: application/json" \
  -d '{
    "event": "pdf.processing.progress"
  }'

# Test failure webhook
curl -X POST /api/webhooks/pdf/test \
  -H "Content-Type: application/json" \
  -d '{
    "event": "pdf.processing.failed"
  }'
```

## Implementation Examples

### React Component with Real-time Updates
```typescript
import { useEffect, useState } from 'react'

interface PDFProcessingStatus {
  status: 'started' | 'processing' | 'completed' | 'failed'
  progress?: number
  error?: string
  result?: any
}

export function PDFProcessingTracker({ jobId }: { jobId: string }) {
  const [status, setStatus] = useState<PDFProcessingStatus>({ status: 'started' })

  useEffect(() => {
    // Setup webhook listener or polling
    const eventSource = new EventSource(`/api/jobs/${jobId}/events`)
    
    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data)
      
      switch (data.event) {
        case 'pdf.processing.progress':
          setStatus({
            status: 'processing',
            progress: (data.data.progress.processedPages / data.data.progress.totalPages) * 100
          })
          break
          
        case 'pdf.processing.completed':
          setStatus({
            status: 'completed',
            progress: 100,
            result: data.data.result
          })
          break
          
        case 'pdf.processing.failed':
          setStatus({
            status: 'failed',
            error: data.data.error
          })
          break
      }
    }
    
    return () => eventSource.close()
  }, [jobId])

  return (
    <div className="pdf-processing-tracker">
      <h3>PDF Processing Status</h3>
      <div>Status: {status.status}</div>
      {status.progress && (
        <div>
          Progress: {status.progress.toFixed(0)}%
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ width: `${status.progress}%` }}
            />
          </div>
        </div>
      )}
      {status.error && <div className="error">Error: {status.error}</div>}
      {status.result && (
        <div className="result">
          ✅ Processing complete! Created {status.result.slidesCreated} slides
        </div>
      )}
    </div>
  )
}
```

### Node.js Webhook Handler
```typescript
import express from 'express'
import { webhookManager } from '../utils/webhookManager'

const app = express()

app.use('/webhooks/pdf', express.json())

app.post('/webhooks/pdf', async (req, res) => {
  const { event, jobId, moduleId, data, signature } = req.body
  
  // Verify signature if secret is configured
  if (process.env.WEBHOOK_SECRET && signature) {
    const payload = JSON.stringify(req.body)
    const isValid = webhookManager.verifySignature(payload, signature, process.env.WEBHOOK_SECRET)
    
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid signature' })
    }
  }
  
  try {
    switch (event) {
      case 'pdf.processing.started':
        await handleProcessingStarted(jobId, moduleId, data)
        break
        
      case 'pdf.processing.progress':
        await handleProcessingProgress(jobId, moduleId, data.progress)
        break
        
      case 'pdf.processing.completed':
        await handleProcessingCompleted(jobId, moduleId, data.result)
        break
        
      case 'pdf.processing.failed':
        await handleProcessingFailed(jobId, moduleId, data.error)
        break
    }
    
    res.json({ success: true })
    
  } catch (error) {
    console.error('Webhook processing error:', error)
    res.status(500).json({ error: 'Webhook processing failed' })
  }
})

async function handleProcessingStarted(jobId: string, moduleId: string, data: any) {
  console.log(`📋 Processing started for module ${moduleId}, job ${jobId}`)
  // Update UI, send notifications, etc.
}

async function handleProcessingProgress(jobId: string, moduleId: string, progress: any) {
  console.log(`📊 Progress: ${progress.processedPages}/${progress.totalPages} pages`)
  // Update progress bars, send real-time updates
}

async function handleProcessingCompleted(jobId: string, moduleId: string, result: any) {
  console.log(`✅ Processing completed: ${result.slidesCreated} slides created`)
  // Notify users, trigger next steps, update database
}

async function handleProcessingFailed(jobId: string, moduleId: string, error: string) {
  console.error(`❌ Processing failed for ${moduleId}: ${error}`)
  // Send error notifications, cleanup, retry logic
}
```

## Webhook Delivery

- **Retry Logic**: Failed webhooks are automatically retried with exponential backoff
- **Timeout**: Configurable timeout per webhook (default: 10 seconds)
- **Concurrency**: Webhooks are sent asynchronously and don't block job processing
- **Reliability**: Network errors and 5xx responses trigger automatic retries

## Monitoring

Check webhook delivery status:
```bash
# Get webhook statistics
curl /api/webhooks/pdf

# Response
{
  "success": true,
  "registeredWebhooks": 2,
  "webhooks": [
    {"key": "global", "url": "https://api.example.com/webhooks"},
    {"key": "module:123", "url": "https://api.example.com/module-webhook"}
  ],
  "timestamp": 1640995200000
}
```

Monitor job processing:
```bash
# Get job status
curl /api/jobs/{jobId}/status

# Get queue statistics  
curl /api/jobs/stats
```