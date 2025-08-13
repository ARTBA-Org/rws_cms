# AWS Lambda Timeout Configuration for PDF Processing

## Current Issue
The PDF processor is timing out at 28 seconds when processing PDFs with multiple pages. Each page takes approximately 3-7 seconds to generate images using Puppeteer.

## Recommended Lambda Configuration

### 1. Increase Lambda Timeout
The default Lambda timeout in AWS Amplify is 30 seconds. For reliable PDF processing with image generation, increase it to 60 seconds or more.

#### Via AWS Console:
1. Go to AWS Lambda Console
2. Find your function (usually named like `amplify-{app-name}-{env}-{function-id}`)
3. Go to Configuration → General configuration
4. Click Edit
5. Set Timeout to `1 min 0 sec` (or higher if needed)
6. Save

#### Via Amplify CLI:
```bash
amplify function update
# Select your function
# Update the timeout in the advanced settings
amplify push
```

#### Via CloudFormation/SAM:
Add to your Lambda function configuration:
```yaml
Timeout: 60  # seconds
```

### 2. Increase Memory Allocation
Puppeteer performs better with more memory. Recommended: 1024 MB or higher.

```yaml
MemorySize: 1024  # MB
```

### 3. Environment Variables
Ensure these are set in your Lambda function:
```
PAYLOAD_PUBLIC_SERVER_URL=https://your-domain.com
```

## Optimized Processor Configuration

The optimized processor (`pdfProcessorOptimized.ts`) provides these configuration options:

```typescript
{
  maxPages: 5,        // Maximum pages to process
  timeoutMs: 25000,   // Timeout in milliseconds (leave buffer for Lambda)
  enableImages: true, // Enable/disable image generation
  batchSize: 1        // Pages to process in parallel
}
```

### Recommended Configurations by Lambda Timeout:

#### 30-second Lambda (current):
```typescript
{
  maxPages: 3,
  timeoutMs: 25000,
  enableImages: true,
  batchSize: 1
}
```

#### 60-second Lambda:
```typescript
{
  maxPages: 8,
  timeoutMs: 55000,
  enableImages: true,
  batchSize: 1
}
```

#### 120-second Lambda:
```typescript
{
  maxPages: 20,
  timeoutMs: 115000,
  enableImages: true,
  batchSize: 2
}
```

## Performance Metrics

Based on CloudWatch logs:
- Text extraction: ~500ms for entire PDF
- Page PDF extraction: ~100ms per page
- Image generation (Puppeteer): 3-7 seconds per page
- Slide creation: ~200ms per slide
- Total per page: ~4-8 seconds

## Monitoring

Check CloudWatch logs for performance metrics:
```
✅ Text extraction completed in 487ms: 8402 characters
✅ Image 2822 generated in 3234ms (175.2KB)
✅ Image 2823 generated in 7123ms (222.5KB)
```

## Alternative Solutions

If increasing Lambda timeout is not possible:

1. **Disable image generation** for faster processing:
```typescript
{
  enableImages: false,  // Process text only
  maxPages: 20
}
```

2. **Process in chunks** with multiple Lambda invocations:
- Process first 3 pages immediately
- Queue remaining pages for background processing

3. **Use Step Functions** for orchestrating multi-page PDFs:
- Split PDF processing into multiple Lambda executions
- Coordinate with AWS Step Functions

## Testing

Test the configuration locally:
```bash
curl -X POST http://localhost:3001/api/test-process-module-pdf \
  -H "Content-Type: application/json" \
  -d '{
    "moduleId": "YOUR_MODULE_ID",
    "useOptimized": true,
    "processorConfig": {
      "maxPages": 5,
      "timeoutMs": 25000,
      "enableImages": true
    }
  }'
```

## Deployment Checklist

- [ ] Increase Lambda timeout to 60+ seconds
- [ ] Increase Lambda memory to 1024+ MB
- [ ] Deploy optimized processor code
- [ ] Test with sample PDFs
- [ ] Monitor CloudWatch for performance
- [ ] Adjust configuration based on actual usage