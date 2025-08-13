import { PDFProcessorOptimized } from '../../../src/utils/pdfProcessorOptimized';

export const handler = async (event: any) => {
  console.log('PDF Processor Lambda invoked with event:', JSON.stringify(event));
  
  try {
    const { pdfBuffer, moduleId, pdfFilename } = event;
    
    // Use environment variables for configuration
    const config = {
      maxPages: parseInt(process.env.MAX_PAGES || '8'),
      timeoutMs: parseInt(process.env.PROCESSOR_TIMEOUT_MS || '55000'),
      enableImages: process.env.ENABLE_IMAGES === 'true',
      batchSize: parseInt(process.env.BATCH_SIZE || '1')
    };
    
    console.log('Using processor configuration:', config);
    
    const processor = new PDFProcessorOptimized(config);
    const result = await processor.processPDFToSlides(
      Buffer.from(pdfBuffer, 'base64'), // Decode from base64 if needed
      moduleId,
      pdfFilename
    );
    
    return {
      statusCode: 200,
      body: JSON.stringify(result)
    };
  } catch (error) {
    console.error('PDF processing error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
};