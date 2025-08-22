# Supabase Edge Function PDF Processing

This document describes the enhanced PDF processing system using Supabase Edge Functions as an alternative to the current local processing system.

## Overview

The Supabase Edge Function implementation provides several advantages over the current local processing:

- **Better Scalability**: Edge Functions can handle concurrent requests more efficiently
- **Improved Performance**: Deno runtime with modern JavaScript features
- **Background Tasks**: Support for long-running PDF operations without timeout issues
- **Ephemeral Storage**: Secure temporary file handling with automatic cleanup
- **Geographic Distribution**: Edge Functions run closer to users for reduced latency

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Next.js App  │    │ Supabase Edge   │    │  Payload CMS    │
│                 │    │   Function      │    │                 │
│ ┌─────────────┐ │    │ ┌─────────────┐ │    │ ┌─────────────┐ │
│ │ PDF Upload  │─┼────┼▶│ PDF Parser  │ │    │ │   Slides    │ │
│ └─────────────┘ │    │ └─────────────┘ │    │ └─────────────┘ │
│                 │    │ ┌─────────────┐ │    │ ┌─────────────┐ │
│ ┌─────────────┐ │    │ │ AI Analysis │ │    │ │   Media     │ │
│ │ UI Controls │ │    │ └─────────────┘ │    │ └─────────────┘ │
│ └─────────────┘ │    │ ┌─────────────┐ │    │ ┌─────────────┐ │
│                 │    │ │Image Generator│ │    │ │  Modules    │ │
│                 │    │ └─────────────┘ │    │ └─────────────┘ │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Files Structure

```
supabase/
├── config.toml                           # Supabase local development config
└── functions/
    └── process-pdf/
        └── index.ts                       # Main Edge Function code

src/
├── utils/
│   └── supabaseEdgePdfProcessor.ts        # Client-side Edge Function wrapper
├── components/
│   └── PdfProcessorEdgeField.tsx          # Enhanced UI component
└── app/
    └── api/
        └── process-pdf-edge/
            └── route.ts                   # API route with fallback logic
```

## Setup Instructions

### 1. Install Supabase CLI

```bash
# Install Supabase CLI
npm install -g supabase

# Or using Homebrew (macOS)
brew install supabase/tap/supabase
```

### 2. Initialize Supabase (if not already done)

```bash
# In your project root
supabase init
```

### 3. Configure Environment Variables

Copy `.env.supabase.example` to `.env.local` and fill in your Supabase credentials:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Enable Edge Functions
PDF_USE_EDGE_FUNCTIONS=true
```

### 4. Local Development

Start Supabase locally:

```bash
supabase start
```

Deploy the Edge Function locally:

```bash
supabase functions deploy process-pdf --local
```

### 5. Production Deployment

Deploy to your Supabase project:

```bash
# Link to your project
supabase link --project-ref your-project-ref

# Deploy the function
supabase functions deploy process-pdf

# Set environment variables
supabase secrets set OPENAI_API_KEY=your-openai-key
supabase secrets set PAYLOAD_API_URL=https://your-app.com
```

## API Usage

### Via API Route

```typescript
const response = await fetch('/api/process-pdf-edge', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    moduleId: '16',
    useEdgeFunction: true, // Set to false for local processing fallback
    processorConfig: {
      maxPages: 25,
      enableImages: true,
      enableAI: true,
    }
  })
})
```

### Direct Edge Function Call

```typescript
import { supabaseEdgePDFProcessor } from '@/utils/supabaseEdgePdfProcessor'

const result = await supabaseEdgePDFProcessor.processPDFFromURL(
  'https://example.com/document.pdf',
  'moduleId',
  'document.pdf',
  {
    startPage: 1,
    maxPages: 25,
    enableImages: true,
    enableAI: true,
  }
)
```

## Features

### Edge Function Features

1. **Ephemeral Storage**: Uses `/tmp` directory for secure temporary file handling
2. **Background Tasks**: Long-running operations don't timeout
3. **Concurrent Processing**: Multiple pages processed in parallel
4. **AI Analysis**: OpenAI integration for slide content analysis
5. **Image Generation**: PDF page to PNG conversion
6. **Error Handling**: Robust retry logic and fallback mechanisms

### UI Enhancements

1. **Method Selection**: Choose between Edge Function and Local Processing
2. **Health Monitoring**: Real-time Edge Function availability checking
3. **Progress Tracking**: Enhanced status updates and error reporting
4. **Comparison Info**: Built-in method comparison and recommendations

## Performance Comparison

| Feature | Local Processing | Edge Function |
|---------|------------------|---------------|
| Concurrent Pages | 1-2 | 5-10 |
| Timeout Limit | 45 seconds | 2 minutes |
| Memory Usage | High | Optimized |
| Scalability | Limited | High |
| Geographic Distribution | Single server | Global edge |
| Cold Start | N/A | ~100ms |

## Troubleshooting

### Common Issues

1. **Edge Function Unavailable**
   - Check Supabase project status
   - Verify environment variables
   - Check function deployment status

2. **PDF Processing Fails**
   - Verify PDF file is accessible
   - Check file size limits (50MB default)
   - Review function logs in Supabase dashboard

3. **Local Fallback Not Working**
   - Ensure local processing dependencies are installed
   - Check Payload CMS connectivity
   - Verify module exists and has PDF uploaded

### Debugging

Enable detailed logging:

```typescript
// In your Edge Function
console.log('Debug info:', { moduleId, pdfSize, options })
```

View logs in Supabase dashboard or locally:

```bash
supabase functions logs process-pdf --local
```

## Migration Guide

### From Local Processing

1. **Gradual Migration**: Use the `useEdgeFunction` flag to test Edge Functions alongside local processing
2. **Fallback Strategy**: The system automatically falls back to local processing if Edge Functions are unavailable
3. **Data Compatibility**: Both systems create identical slide structures in Payload CMS

### Testing Strategy

1. **Health Checks**: Use the built-in health check endpoint
2. **A/B Testing**: Process the same PDF with both methods and compare results
3. **Load Testing**: Test concurrent processing capabilities

## Future Enhancements

- [ ] **Persistent Storage**: Mount S3 buckets for large file handling
- [ ] **WebSocket Updates**: Real-time processing progress updates
- [ ] **Batch Processing**: Process multiple PDFs simultaneously
- [ ] **Custom AI Models**: Support for different AI analysis models
- [ ] **Caching**: Cache processed results for faster re-processing

## Support

For issues related to:
- **Edge Functions**: Check Supabase documentation and community
- **PDF Processing**: Review the processing logs and error messages
- **Integration**: Ensure proper environment configuration and API connectivity

## Security Considerations

1. **API Keys**: Never expose service role keys in client-side code
2. **File Upload**: Validate PDF files before processing
3. **Rate Limiting**: Implement rate limiting for production use
4. **Access Control**: Ensure proper authentication for API endpoints
