import { PDFDocument } from 'pdf-lib'
import { getPayload } from 'payload'
import config from '../payload.config'
import { extractTextFromPDF } from './pdfTextExtractor'

// Detect if running locally or in Lambda
const isLambda = !!process.env.AWS_LAMBDA_FUNCTION_NAME || !!process.env.LAMBDA_TASK_ROOT

// Lazy-load the correct converter only when needed to avoid bundling
// heavy, environment-specific dependencies in the wrong environment
async function loadImageConverter(): Promise<(pdfBuffer: Buffer, pageNum: number) => Promise<Buffer | null>> {
  if (isLambda) {
    const { convertPDFPageToImage } = await import('./pdfToImageLambda')
    return convertPDFPageToImage
  }
  const { convertPDFPageToImageLocal } = await import('./pdfToImageLocal')
  return convertPDFPageToImageLocal
}

export interface PDFProcessConfig {
  maxPages?: number
  timeoutMs?: number
  enableImages?: boolean
  batchSize?: number
}

export interface PDFProcessResult {
  success: boolean
  slidesCreated: number
  errors?: string[]
  warnings?: string[]
  slideIds?: Array<number | string>
  moduleUpdated?: boolean
  textExtracted?: boolean
  imagesGenerated?: boolean
  totalPages?: number
  pagesProcessed?: number
  partialSuccess?: boolean
  timeElapsed?: number
}

export class PDFProcessorOptimized {
  private config: PDFProcessConfig
  private startTime: number = 0
  private imageConverter: ((pdfBuffer: Buffer, pageNum: number) => Promise<Buffer | null>) | null = null

  constructor(config: PDFProcessConfig = {}) {
    this.config = {
      maxPages: config.maxPages || 10,
      timeoutMs: config.timeoutMs || 25000, // Leave 3s buffer for Lambda 28s timeout
      enableImages: config.enableImages !== false,
      batchSize: config.batchSize || 1,
    }
  }

  async processPDFToSlides(
    pdfBuffer: Buffer,
    moduleId: string,
    pdfFilename: string,
  ): Promise<PDFProcessResult> {
    this.startTime = Date.now()
    console.log('⚡ Optimized PDFProcessor started')
    console.log('⚙️ Configuration:', this.config)
    console.log('📋 Parameters:', {
      bufferSize: pdfBuffer.length,
      moduleId,
      pdfFilename,
    })

    const slideIds: Array<number | string> = []
    let slidesCreated = 0
    let textExtracted = false
    let imagesGenerated = false
    let pagesProcessed = 0
    let totalPages = 0
    
    try {
      console.log('🚀 Initializing Payload...')
      const payload = await getPayload({ config })

      // Load PDF document for metadata
      console.log('📖 Loading PDF document...')
      const pdfDoc = await PDFDocument.load(pdfBuffer)
      totalPages = pdfDoc.getPageCount()
      const pagesToProcess = Math.min(totalPages, this.config.maxPages!)
      console.log(`📊 PDF has ${totalPages} pages, will process ${pagesToProcess}`)

      // Extract text from entire PDF first (fast operation)
      console.log('📝 Extracting text from PDF...')
      const textStartTime = Date.now()
      const pdfText = await extractTextFromPDF(pdfBuffer)
      
      if (pdfText && pdfText.text) {
        textExtracted = true
        const textTime = Date.now() - textStartTime
        console.log(`✅ Text extraction completed in ${textTime}ms: ${pdfText.text.length} characters`)
      }

      // Pre-extract all single page PDFs if images are enabled
      const singlePageBuffers: Map<number, Buffer> = new Map()
      if (this.config.enableImages) {
        console.log('📄 Pre-extracting single page PDFs...')
        for (let pageNum = 1; pageNum <= pagesToProcess; pageNum++) {
          if (this.isTimingOut()) {
            console.warn(`⏱️ Approaching timeout, stopping page extraction at page ${pageNum}`)
            break
          }
          
          const singlePageDoc = await PDFDocument.create()
          const [copiedPage] = await singlePageDoc.copyPages(pdfDoc, [pageNum - 1])
          singlePageDoc.addPage(copiedPage)
          const buffer = Buffer.from(await singlePageDoc.save())
          singlePageBuffers.set(pageNum, buffer)
        }
        console.log(`✅ Pre-extracted ${singlePageBuffers.size} page PDFs`)
      }

      // Process pages in batches
      const batches = this.createBatches(pagesToProcess, this.config.batchSize!)
      console.log(`🔄 Processing ${batches.length} batches`)

      for (const batch of batches) {
        if (this.isTimingOut()) {
          console.warn('⏱️ Approaching timeout, stopping batch processing')
          break
        }

        console.log(`📦 Processing batch: pages ${batch.join(', ')}`)
        const batchPromises = batch.map(async (pageNum) => {
          try {
            return await this.processSinglePage(
              pageNum,
              totalPages,
              pdfDoc,
              pdfText,
              singlePageBuffers.get(pageNum),
              pdfFilename,
              payload
            )
          } catch (error) {
            console.error(`❌ Error processing page ${pageNum}:`, error)
            return null
          }
        })

        const batchResults = await Promise.all(batchPromises)
        
        for (const result of batchResults) {
          if (result) {
            slideIds.push(result.slideId)
            slidesCreated++
            pagesProcessed++
            if (result.imageGenerated) {
              imagesGenerated = true
            }
          }
        }
      }

      // Update module with new slides
      if (slideIds.length > 0) {
        console.log('💾 Updating module with new slides...')
        
        try {
          // Get current slides without loading full relationships
          const currentModule = await payload.findByID({
            collection: 'modules',
            id: String(moduleId),
            depth: 0, // Don't populate relationships when reading
            overrideAccess: true,
          })

          const existingSlidesRaw = (currentModule as any).slides || []
          const existingSlides = Array.isArray(existingSlidesRaw)
            ? existingSlidesRaw.map((s: any) => (typeof s === 'object' ? s.id : s)).filter(Boolean)
            : []
          console.log(`📊 Adding ${slideIds.length} new slides to ${existingSlides.length} existing slides`)

          // Simple update with just the slide IDs
          await payload.update({
            collection: 'modules',
            id: String(moduleId),
            data: {
              slides: [...existingSlides, ...slideIds],
            },
            overrideAccess: true,
            depth: 0, // Don't return populated relationships
          })

          console.log(`✅ Module ${moduleId} updated successfully`)
        } catch (updateError: any) {
          // If update fails, the slides are still created
          console.error('❌ Failed to link slides to module:', updateError.message)
          console.log('📝 Created slide IDs that need manual linking:', slideIds)
          // Don't throw - we'll handle this in the catch block
          throw updateError
        }
      }

      const timeElapsed = Date.now() - this.startTime
      const partialSuccess = pagesProcessed < totalPages

      return {
        success: true,
        slidesCreated,
        slideIds,
        moduleUpdated: slideIds.length > 0,
        textExtracted,
        imagesGenerated,
        totalPages,
        pagesProcessed,
        partialSuccess,
        timeElapsed,
      }
      
    } catch (error) {
      console.error('💥 PDF processing error:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      const timeElapsed = Date.now() - this.startTime
      
      // Check if slides were actually created despite the error
      // This handles database timeout errors after successful slide creation
      if (errorMessage.includes('timeout') && slidesCreated > 0) {
        console.warn('⚠️ Database timeout occurred but slides were created successfully')
        console.log('✅ Created slide IDs:', slideIds)
        
        return {
          success: true,  // Mark as success since slides were created
          slidesCreated,
          slideIds,
          moduleUpdated: false,  // Module update failed due to timeout
          textExtracted,
          imagesGenerated,
          totalPages,
          pagesProcessed: slidesCreated,
          partialSuccess: false,
          timeElapsed,
          warnings: ['Module update timed out, but slides were created. Please refresh the page.']
        }
      }
      
      return {
        success: false,
        slidesCreated: 0,
        errors: [errorMessage],
        slideIds: [],
        moduleUpdated: false,
        textExtracted: false,
        imagesGenerated: false,
        timeElapsed,
      }
    }
  }

  private async processSinglePage(
    pageNum: number,
    totalPages: number,
    pdfDoc: PDFDocument,
    pdfText: any,
    singlePageBuffer: Buffer | undefined,
    pdfFilename: string,
    payload: any
  ): Promise<{ slideId: string | number; imageGenerated: boolean } | null> {
    console.log(`📄 Processing page ${pageNum}/${totalPages}`)
    
    // Get page dimensions
    const page = pdfDoc.getPage(pageNum - 1)
    const { width, height } = page.getSize()

    // Extract text for this page
    let pageText = ''
    if (pdfText && pdfText.text) {
      const allText = pdfText.text
      const textPages = allText.split(/\f|\n{3,}/)
      if (textPages[pageNum - 1]) {
        pageText = textPages[pageNum - 1].trim()
      } else {
        const charsPerPage = Math.ceil(allText.length / totalPages)
        const startIdx = (pageNum - 1) * charsPerPage
        pageText = allText.substring(startIdx, startIdx + charsPerPage).trim()
      }
      console.log(`📝 Page ${pageNum}: ${pageText.length} characters`)
    }

    // Generate image if enabled and buffer available
    let imageMediaId = null
    let imageGenerated = false
    
    if (this.config.enableImages && singlePageBuffer && !this.isTimingOut()) {
      console.log(`🖼️ Generating image for page ${pageNum}...`)
      const imageStartTime = Date.now()
      
      try {
        if (!this.imageConverter) {
          this.imageConverter = await loadImageConverter()
        }
        const imageBuffer = await this.imageConverter(singlePageBuffer, 1)
        
        if (imageBuffer && imageBuffer.length > 0) {
          const imageName = `${pdfFilename.replace('.pdf', '')}_page_${pageNum}.png`
          
          const mediaDoc = await payload.create({
            collection: 'media',
            data: {
              alt: `Page ${pageNum} from ${pdfFilename}`,
            },
            file: {
              data: imageBuffer,
              mimetype: 'image/png',
              name: imageName,
              size: imageBuffer.length,
            },
            overrideAccess: true,
            depth: 0,
          })
          
          imageMediaId = mediaDoc.id
          imageGenerated = true
          const imageTime = Date.now() - imageStartTime
          console.log(`✅ Image ${imageMediaId} generated in ${imageTime}ms (${(imageBuffer.length / 1024).toFixed(1)}KB)`)
        }
      } catch (imageError) {
        console.error(`❌ Image generation failed for page ${pageNum}:`, imageError)
      }
    }

    // Generate title and description
    const title = this.generateTitle(pageText, pdfFilename, pageNum)
    const description = this.generateDescription(pageText, pageNum, totalPages, width, height)

    // Create slide
    const slideData: any = {
      title,
      description,
      type: this.detectSlideType(pageText),
      urls: [],
    }

    if (imageMediaId) {
      slideData.image = imageMediaId
    }

    const slide = await payload.create({
      collection: 'slides',
      data: slideData,
      overrideAccess: true,
      depth: 0,
    })
    
    console.log(`✅ Slide ${slide.id} created for page ${pageNum}`)
    
    return {
      slideId: slide.id,
      imageGenerated,
    }
  }

  private createBatches(totalItems: number, batchSize: number): number[][] {
    const batches: number[][] = []
    for (let i = 1; i <= totalItems; i += batchSize) {
      const batch: number[] = []
      for (let j = i; j < Math.min(i + batchSize, totalItems + 1); j++) {
        batch.push(j)
      }
      batches.push(batch)
    }
    return batches
  }

  private isTimingOut(): boolean {
    const elapsed = Date.now() - this.startTime
    const remaining = this.config.timeoutMs! - elapsed
    if (remaining < 3000) {
      console.warn(`⏱️ Only ${remaining}ms remaining before timeout`)
      return true
    }
    return false
  }

  private generateTitle(text: string, filename: string, pageNum: number): string {
    if (!text || text.length < 10) {
      return `${filename.replace('.pdf', '')} - Page ${pageNum}`
    }

    const lines = text.split('\n').filter(line => line.trim().length > 0)
    const firstLine = lines[0]?.trim() || ''
    
    if (firstLine.length > 5 && firstLine.length < 100) {
      return firstLine
        .replace(/[^\w\s-.,!?]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
    }

    return `${filename.replace('.pdf', '')} - Page ${pageNum}`
  }

  private generateDescription(
    text: string, 
    pageNum: number, 
    totalPages: number,
    width: number,
    height: number
  ): string {
    const pageInfo = `Page ${pageNum} of ${totalPages} (${Math.round(width)}x${Math.round(height)}px)`
    
    if (!text || text.length < 20) {
      return pageInfo
    }

    const cleanText = text
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 500)

    return `${pageInfo}\n\n${cleanText}${text.length > 500 ? '...' : ''}`
  }

  private detectSlideType(text: string): string {
    const lowerText = text.toLowerCase()
    
    if (lowerText.includes('quiz') || lowerText.includes('question') || 
        lowerText.includes('answer')) {
      return 'quiz'
    }
    
    if (lowerText.includes('reference') || lowerText.includes('bibliography') || 
        lowerText.includes('citation') || lowerText.includes('source')) {
      return 'reference'
    }
    
    if (lowerText.includes('resource') || lowerText.includes('link') ||
        lowerText.includes('download') || lowerText.includes('material')) {
      return 'resources'
    }

    if (lowerText.includes('video') || lowerText.includes('watch') ||
        lowerText.includes('youtube') || lowerText.includes('vimeo')) {
      return 'video'
    }

    return 'regular'
  }
}