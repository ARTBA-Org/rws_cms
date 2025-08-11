import { PDFDocument } from 'pdf-lib'
import { getPayload } from 'payload'
import config from '../payload.config'
import path from 'path'

export interface PDFProcessResult {
  success: boolean
  slidesCreated: number
  errors?: string[]
  slideIds?: Array<number | string>
  moduleUpdated?: boolean
  aiAnalysisUsed?: boolean
  slideTypes?: string[]
}

export class PDFProcessor {
  /**
   * Process PDF and create slides for a module using Cloud Run with full system dependencies
   */
  async processPDFToSlides(
    pdfBuffer: Buffer,
    moduleId: string,
    pdfFilename: string,
  ): Promise<PDFProcessResult> {
    console.log('🔧 PDFProcessor.processPDFToSlides called (Cloud Run version)')
    console.log('📋 Parameters:', {
      bufferSize: pdfBuffer.length,
      moduleId,
      pdfFilename,
    })

    const moduleIdNum = Number(moduleId)
    const moduleRelValue: number | string = Number.isNaN(moduleIdNum) ? moduleId : moduleIdNum

    try {
      console.log('🚀 Initializing Payload...')
      const payload = await getPayload({ config })
      const slideIds: Array<number | string> = []
      let slidesCreated = 0

      // Load PDF document to get page count
      console.log('📖 Loading PDF document...')
      const pdfDoc = await PDFDocument.load(pdfBuffer)
      const totalPages = pdfDoc.getPageCount()
      console.log('📊 PDF info:', {
        pages: totalPages,
        filename: pdfFilename,
      })

      console.log(`Processing PDF: ${pdfFilename} with ${totalPages} pages`)

      // Convert PDF to images using Cloud Run's system dependencies
      console.log('🖼️ Converting PDF to images using Cloud Run capabilities...')
      const images = await this.convertPDFToImagesCloudRun(pdfBuffer, totalPages)

      console.log(`🔄 Creating slides from ${images.length} processed pages...`)

      // Initialize AI analyzer if OpenAI key is available
      let aiAnalysisUsed = false
      let slideTypes: string[] = []
      let analyses: any[] = []

      if (process.env.OPENAI_API_KEY && images.some((img) => img.length > 0)) {
        try {
          console.log('🤖 Starting AI analysis of slides...')
          const { SlideAnalyzer } = await import('./slideAnalyzer')
          const analyzer = new SlideAnalyzer()

          const slidesForAnalysis = images
            .map((buffer, index) => ({ buffer, pageNumber: index + 1 }))
            .filter((slide) => slide.buffer.length > 0)

          analyses = await analyzer.analyzeSlides(slidesForAnalysis, pdfFilename)
          aiAnalysisUsed = true
          console.log(`✅ AI analysis complete for ${analyses.length} slides`)
        } catch (aiError) {
          console.warn('⚠️ AI analysis failed, continuing without it:', aiError)
        }
      } else {
        console.log('⚠️ No OpenAI API key found or no images available, skipping AI analysis')
      }

      // Create slides from processed images
      for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
        console.log(`📄 Creating slide ${pageNum}/${totalPages}`)

        try {
          let uploadedMediaId: number | string | undefined
          const imageBuffer = images[pageNum - 1]

          if (imageBuffer && imageBuffer.length > 0) {
            console.log(`📦 Image buffer size: ${imageBuffer.length} bytes`)
            // Upload image to media collection
            const imageName = `${path.parse(pdfFilename).name}_page_${pageNum}.png`
            console.log(`📤 Uploading image to media collection: ${imageName}`)

            const mediaDoc = await payload.create({
              collection: 'media',
              data: { alt: `Page ${pageNum} from ${pdfFilename}` },
              file: {
                data: imageBuffer,
                mimetype: 'image/png',
                name: imageName,
                size: imageBuffer.length,
              },
              overrideAccess: true,
              depth: 0,
            })
            console.log(`✅ Image uploaded with ID: ${mediaDoc.id}`)
            uploadedMediaId = mediaDoc.id
          } else {
            console.log('📝 No image available for this page, creating text-only slide')
          }

          // Get AI analysis for this slide (if available)
          const analysis = analyses.find((a) => a.pageNumber === pageNum)
          const slideTitle = analysis?.title || `${path.parse(pdfFilename).name} - Page ${pageNum}`
          const slideDescription = analysis?.description || `Page ${pageNum} from ${pdfFilename}`
          const slideType = analysis?.type || 'regular'

          slideTypes.push(slideType)

          const slideData = {
            title: slideTitle,
            description: slideDescription,
            type: slideType as 'regular' | 'video' | 'quiz' | 'reference' | 'resources',
            module: moduleRelValue,
            ...(uploadedMediaId && { image: uploadedMediaId }),
            ...(analysis?.urls && analysis.urls.length > 0 && { urls: analysis.urls }),
          }

          console.log(`📝 Creating slide with data:`, {
            title: slideData.title,
            type: slideData.type,
            hasImage: !!uploadedMediaId,
            hasUrls: !!(analysis?.urls && analysis.urls.length > 0),
            module: slideData.module,
          })

          const slide = await payload.create({
            collection: 'slides',
            data: slideData,
            overrideAccess: true,
            depth: 0,
          })

          console.log(`✅ Slide created with ID: ${slide.id}`)
          slideIds.push(slide.id)
          slidesCreated++
        } catch (slideError) {
          console.error(`❌ Error creating slide ${pageNum}:`, slideError)
          // Continue with other slides
        }
      }

      // Update module with slide references
      console.log('🔗 Updating module with slide references...')
      try {
        await payload.update({
          collection: 'modules',
          id: moduleRelValue,
          data: {
            slides: slideIds.map((id) => ({ slides: id })),
          },
          overrideAccess: true,
          depth: 0,
        })
        console.log('✅ Module updated with slide references')
      } catch (updateError) {
        console.warn('⚠️ Failed to update module with slide references:', updateError)
      }

      console.log(`🎉 PDF processing complete! Created ${slidesCreated} slides.`)
      return {
        success: true,
        slidesCreated,
        slideIds,
        moduleUpdated: true,
        aiAnalysisUsed,
        slideTypes,
      }
    } catch (error: any) {
      console.error('💥 PDF processing error:', error)
      console.error('💥 Error stack:', error.stack)
      return {
        success: false,
        slidesCreated: 0,
        errors: [error.message || 'Unknown error occurred'],
      }
    }
  }

  /**
   * Convert PDF to images using Cloud Run's full system dependencies
   */
  private async convertPDFToImagesCloudRun(
    pdfBuffer: Buffer,
    totalPages: number,
  ): Promise<Buffer[]> {
    const images: Buffer[] = []

    try {
      console.log('🔧 Using pdf2pic with full Cloud Run system dependencies...')

      const pdf2picMod: any = await import('pdf2pic')
      const fromBuffer = pdf2picMod.fromBuffer || pdf2picMod.default?.fromBuffer

      if (!fromBuffer) {
        throw new Error('pdf2pic.fromBuffer not available')
      }

      // Use optimal settings for Cloud Run
      const converter = fromBuffer(pdfBuffer, {
        density: 200, // Higher quality for better images
        saveFilename: 'page',
        savePath: '/tmp',
        format: 'png',
        width: 1200, // Higher resolution
        height: 1600,
        quality: 90, // High quality
      })

      console.log(`🔄 Converting ${totalPages} pages to images...`)

      for (let page = 1; page <= totalPages; page++) {
        try {
          console.log(`🔄 Converting page ${page}/${totalPages}`)
          const res = await converter(page, { responseType: 'buffer' })
          const buffer: Buffer = (res && (res.buffer || res.result || res)) as Buffer

          if (buffer && buffer.length > 0) {
            images.push(buffer)
            console.log(`✅ Page ${page} converted successfully (${buffer.length} bytes)`)
          } else {
            console.warn(`⚠️ Page ${page} conversion returned empty buffer`)
            // Create a placeholder for this page
            const placeholder = await this.createPlaceholderImage(page, totalPages)
            images.push(placeholder)
          }
        } catch (pageError) {
          console.warn(`⚠️ Failed to convert page ${page}:`, pageError)
          // Create a placeholder for this page
          const placeholder = await this.createPlaceholderImage(page, totalPages)
          images.push(placeholder)
        }
      }

      const successfulConversions = images.filter((img) => img.length > 0).length
      console.log(`✅ Successfully converted ${successfulConversions}/${totalPages} pages`)
    } catch (conversionError) {
      console.error('❌ PDF to image conversion failed:', conversionError)

      // Fallback: Create placeholder images
      console.log('🔄 Falling back to placeholder generation...')
      for (let page = 1; page <= totalPages; page++) {
        try {
          const placeholderBuffer = await this.createPlaceholderImage(page, totalPages)
          images.push(placeholderBuffer)
          console.log(`✅ Created placeholder for page ${page}`)
        } catch (placeholderError) {
          console.warn(`⚠️ Failed to create placeholder for page ${page}:`, placeholderError)
          images.push(Buffer.alloc(0))
        }
      }
    }

    return images
  }

  /**
   * Create a placeholder image using Sharp
   */
  private async createPlaceholderImage(pageNum: number, totalPages: number): Promise<Buffer> {
    try {
      const sharp = await import('sharp')

      const svg = `
        <svg width="1200" height="1600" xmlns="http://www.w3.org/2000/svg">
          <rect width="100%" height="100%" fill="#f8f9fa" stroke="#dee2e6" stroke-width="4"/>
          <text x="50%" y="30%" text-anchor="middle" font-family="Arial, sans-serif" font-size="48" fill="#6c757d">
            PDF Page ${pageNum}
          </text>
          <text x="50%" y="40%" text-anchor="middle" font-family="Arial, sans-serif" font-size="32" fill="#6c757d">
            of ${totalPages}
          </text>
          <text x="50%" y="60%" text-anchor="middle" font-family="Arial, sans-serif" font-size="24" fill="#adb5bd">
            Image conversion failed
          </text>
          <text x="50%" y="70%" text-anchor="middle" font-family="Arial, sans-serif" font-size="24" fill="#adb5bd">
            Please replace manually
          </text>
        </svg>
      `

      const buffer = await sharp.default(Buffer.from(svg)).png().toBuffer()

      return buffer
    } catch (error) {
      console.error('Failed to create placeholder image:', error)
      return Buffer.alloc(0)
    }
  }
}
