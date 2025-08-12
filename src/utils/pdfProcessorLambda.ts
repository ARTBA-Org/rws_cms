import { PDFDocument } from 'pdf-lib'
import { getPayload } from 'payload'
import config from '../payload.config'

export interface PDFProcessResult {
  success: boolean
  slidesCreated: number
  errors?: string[]
  slideIds?: Array<number | string>
  moduleUpdated?: boolean
}

export class PDFProcessor {
  /**
   * Process PDF and create slides for a module
   * Lambda-compatible version that creates slides without image conversion
   */
  async processPDFToSlides(
    pdfBuffer: Buffer,
    moduleId: string,
    pdfFilename: string,
  ): Promise<PDFProcessResult> {
    console.log('🔧 PDFProcessor.processPDFToSlides called (Lambda version)')
    console.log('📋 Parameters:', {
      bufferSize: pdfBuffer.length,
      moduleId,
      pdfFilename,
    })

    // Normalize module relationship value
    const moduleIdNum = Number(moduleId)
    const moduleRelValue: number | string = Number.isNaN(moduleIdNum) ? moduleId : moduleIdNum

    try {
      console.log('🚀 Initializing Payload...')
      const payload = await getPayload({ config })
      const slideIds: Array<number | string> = []
      let slidesCreated = 0

      // Load PDF document to get page count and metadata
      console.log('📖 Loading PDF document...')
      const pdfDoc = await PDFDocument.load(pdfBuffer)
      const totalPages = pdfDoc.getPageCount()
      console.log(`📊 PDF has ${totalPages} pages`)

      // Process each page
      for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
        console.log(`📄 Processing page ${pageNum}/${totalPages}`)

        try {
          // Get page dimensions for metadata
          const page = pdfDoc.getPage(pageNum - 1)
          const { width, height } = page.getSize()

          // Create slide without image (temporary solution for Lambda)
          // In production, you'd want to use a Lambda layer with proper image processing
          console.log(`🎯 Creating slide for page ${pageNum}...`)
          
          const slide = await payload.create({
            collection: 'slides',
            data: {
              title: `${pdfFilename.replace('.pdf', '')} - Page ${pageNum}`,
              description: `Page ${pageNum} of ${totalPages} (${Math.round(width)}x${Math.round(height)}px)`,
              type: 'regular',
              // No image field since we can't convert in Lambda without proper binaries
              urls: [],
            },
            overrideAccess: true,
            depth: 0,
          })
          
          console.log(`✅ Slide created with ID: ${slide.id}`)
          slideIds.push(slide.id)
          slidesCreated++
          
        } catch (pageError) {
          console.error(`❌ Error processing page ${pageNum}:`, pageError)
          // Continue with next page even if one fails
        }
      }

      // Update module with new slides
      console.log('💾 Updating module with new slides...')
      const currentModule = await payload.findByID({
        collection: 'modules',
        id: String(moduleId),
      })

      const existingSlides = currentModule.slides || []
      console.log(`📊 Adding ${slideIds.length} new slides to ${existingSlides.length} existing slides`)

      await payload.update({
        collection: 'modules',
        id: String(moduleId),
        data: {
          slides: [...existingSlides, ...slideIds],
        },
        overrideAccess: true,
        depth: 0,
      })

      console.log(`✅ Module ${moduleId} updated successfully`)

      return {
        success: true,
        slidesCreated,
        slideIds,
        moduleUpdated: true,
      }
      
    } catch (error) {
      console.error('💥 PDF processing error:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      
      return {
        success: false,
        slidesCreated: 0,
        errors: [errorMessage],
        slideIds: [],
        moduleUpdated: false,
      }
    }
  }
}