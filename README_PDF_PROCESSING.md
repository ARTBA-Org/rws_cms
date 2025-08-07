# PDF Processing Feature for Modules

## Overview
This feature automatically processes PDF uploads to Modules and creates individual Slides from each page of the PDF.

## How it Works

1. **PDF Upload**: When you upload a PDF to a Module using the "PDF Upload" field
2. **Automatic Processing**: The system automatically:
   - Splits the PDF into individual pages
   - Converts each page to a PNG image
   - Uploads each image to the Media collection (stored in S3)
   - Creates a Slide for each page
   - Links all created Slides to the Module
   - Creates PdfPages records for tracking

## Features

- **Automatic Slide Generation**: No need to manually create slides from PDFs
- **S3 Storage**: All generated images are stored in Supabase Storage (S3-compatible)
- **Page Tracking**: PdfPages collection tracks each page with its source PDF and module
- **High Quality Images**: Pages are converted at 1920x1080 resolution with 2x scaling for clarity

## Collections Involved

1. **Modules**: Has the new `pdfUpload` field for uploading PDFs
2. **Pdfs**: Stores the uploaded PDF files
3. **Media**: Stores the generated page images
4. **Slides**: Created automatically for each PDF page
5. **PdfPages**: Tracks the relationship between pages, modules, and media

## Usage

1. Navigate to the Modules collection in the admin panel
2. Create or edit a Module
3. Upload a PDF file using the "PDF Upload" field
4. Save the Module
5. The system will automatically process the PDF and create slides
6. Check the Module's slides field to see all generated slides

## Technical Details

### Dependencies
- `pdf-lib`: For PDF document manipulation
- `pdf-to-img`: For converting PDF pages to images
- `sharp`: For image processing

### S3 Configuration
The system uses Supabase Storage with S3-compatible API:
- Endpoint: `https://nwquaemdrfuhafnugbgl.supabase.co/storage/v1/s3`
- Bucket: `Media`
- Region: `us-west-1`

### Processing Flow
1. AfterChange hook triggers on Module create/update
2. PDFProcessor class handles the conversion
3. Each page is converted to PNG format
4. Images are uploaded to S3 via Payload's Media collection
5. Slides are created and linked to the Module
6. PdfPages records are created for tracking

## Environment Variables Required

```env
# S3 Storage Configuration
AWS_ACCESS_KEY=your_access_key
AWS_SECRET_KEY=your_secret_key
AWS_ENDPOINT=https://your-project.supabase.co/storage/v1/s3
AWS_REGION=us-west-1
AWS_BUCKET=Media
```

## File Structure
```
src/
├── collections/
│   ├── Modules.ts          # Enhanced with PDF upload field and afterChange hook
│   ├── Pdfs.ts            # New collection for PDF uploads
│   ├── PdfPages.ts        # Tracks PDF pages and their relationships
│   └── Media.ts           # Stores generated page images
├── utils/
│   └── pdfProcessor.ts    # PDF processing logic
└── payload.config.ts      # Updated with new collections and S3 config
```

## Troubleshooting

- **PDF not processing**: Check console logs for errors
- **Images not uploading**: Verify S3 credentials and permissions
- **Slides not linking**: Ensure Module has proper permissions
- **Import errors**: Make sure all dependencies are installed: `npm install pdf-lib pdf-to-img`

## Future Enhancements

- Text extraction from PDFs for searchability
- Custom slide titles based on PDF content
- Batch processing for multiple PDFs
- Progress indicators during processing
- Support for different image formats and resolutions