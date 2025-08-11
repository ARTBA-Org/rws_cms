import { convertPdfToImages as cloudinaryConvert } from './cloudinaryPdfProcessor'
import { convertPdfToImages as convertApiConvert } from './convertApiProcessor'
import { convertPdfToImages as cloudRunConvert } from './cloudRunPdfService'

export type PdfProcessorType = 'cloudinary' | 'convertapi' | 'cloudrun'

export async function convertPdfToImages(
  pdfBuffer: Buffer,
  preferredProcessor: PdfProcessorType = 'cloudinary',
): Promise<Buffer[]> {
  const processors = {
    cloudinary: cloudinaryConvert,
    convertapi: convertApiConvert,
    cloudrun: cloudRunConvert,
  }

  // Try preferred processor first
  try {
    console.log(`🔧 Using ${preferredProcessor} for PDF conversion`)
    return await processors[preferredProcessor](pdfBuffer)
  } catch (error) {
    console.warn(`${preferredProcessor} failed, trying fallbacks:`, error)
  }

  // Try other processors as fallbacks
  const fallbackProcessors = Object.entries(processors).filter(
    ([name]) => name !== preferredProcessor,
  )

  for (const [name, processor] of fallbackProcessors) {
    try {
      console.log(`🔧 Fallback: Using ${name} for PDF conversion`)
      return await processor(pdfBuffer)
    } catch (error) {
      console.warn(`${name} fallback failed:`, error)
    }
  }

  throw new Error('All PDF processors failed')
}

export async function processPdfWithAI(
  pdfBuffer: Buffer,
  openaiApiKey: string,
  processor: PdfProcessorType = 'cloudinary',
): Promise<any> {
  try {
    console.log('🖼️ Converting PDF to images using external service...')
    const images = await convertPdfToImages(pdfBuffer, processor)

    console.log(`✅ Successfully converted PDF to ${images.length} images`)

    // Continue with your existing AI processing logic
    // ... rest of your AI processing code

    return {
      success: true,
      imageCount: images.length,
      images: images,
    }
  } catch (error) {
    console.error('External PDF processing failed:', error)
    throw error
  }
}
