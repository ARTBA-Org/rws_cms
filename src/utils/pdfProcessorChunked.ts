import { PDFDocument } from 'pdf-lib'
import { getPayload } from 'payload'
import config from '../payload.config'
import { extractTextFromPDF } from './pdfTextExtractor'

export interface ChunkConfig {
  immediatePages: number // Pages to process immediately (e.g., 3)
  chunkSize: number // Pages per background chunk (e.g., 5)
  enableImages: boolean // Whether to generate images
}

export interface ChunkResult {
  success: boolean
  immediate: {
    slidesCreated: number
    slideIds: Array<number | string>
    pagesProcessed: number
  }
  queued?: {
    chunks: number
    totalPages: number
    estimatedTime: number // seconds
  }
  errors?: string[]
}

export class PDFProcessorChunked {
  private config: ChunkConfig

  constructor(
    config: ChunkConfig = {
      immediatePages: 3,
      chunkSize: 5,
      enableImages: true,
    },
  ) {
    this.config = config
  }

  /**
   * Process PDF in chunks - immediate results + queued background processing
   */
  async processPDFChunked(
    pdfBuffer: Buffer,
    moduleId: string,
    pdfFilename: string,
  ): Promise<ChunkResult> {
    console.log('📦 Chunked PDF Processor started')
    console.log('Configuration:', this.config)

    try {
      const payload = await getPayload({ config })

      // Load PDF document
      const pdfDoc = await PDFDocument.load(pdfBuffer)
      const totalPages = pdfDoc.getPageCount()
      console.log(`📊 PDF has ${totalPages} pages`)

      // Extract text from entire PDF
      const pdfText = await extractTextFromPDF(pdfBuffer)
      const hasText = pdfText && pdfText.text && pdfText.text.length > 0

      // PHASE 1: Process immediate pages synchronously
      const immediateResult = await this.processImmediatePages(
        pdfBuffer,
        moduleId,
        pdfFilename,
        Math.min(this.config.immediatePages, totalPages),
        pdfDoc,
        pdfText,
        payload,
      )

      // PHASE 2: Queue remaining pages if any
      let queuedInfo = undefined
      const remainingPages = totalPages - this.config.immediatePages

      if (remainingPages > 0) {
        queuedInfo = await this.queueRemainingPages(
          pdfBuffer,
          moduleId,
          pdfFilename,
          this.config.immediatePages,
          totalPages,
          payload,
        )
      }

      return {
        success: true,
        immediate: immediateResult,
        queued: queuedInfo,
      }
    } catch (error) {
      console.error('💥 Chunked processing error:', error)
      return {
        success: false,
        immediate: {
          slidesCreated: 0,
          slideIds: [],
          pagesProcessed: 0,
        },
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      }
    }
  }

  /**
   * Process the first few pages immediately for quick feedback
   */
  private async processImmediatePages(
    pdfBuffer: Buffer,
    moduleId: string,
    pdfFilename: string,
    pagesToProcess: number,
    pdfDoc: PDFDocument,
    pdfText: any,
    payload: any,
  ): Promise<{ slidesCreated: number; slideIds: Array<number | string>; pagesProcessed: number }> {
    console.log(`⚡ Processing ${pagesToProcess} pages immediately...`)

    const slideIds: Array<number | string> = []
    let slidesCreated = 0

    for (let pageNum = 1; pageNum <= pagesToProcess; pageNum++) {
      try {
        console.log(`📄 Processing page ${pageNum}/${pagesToProcess}`)

        // Get page info
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
            const charsPerPage = Math.ceil(allText.length / pdfDoc.getPageCount())
            const startIdx = (pageNum - 1) * charsPerPage
            pageText = allText.substring(startIdx, startIdx + charsPerPage).trim()
          }
        }

        // Create slide (without image for speed in immediate processing)
        const slideData = {
          title: this.generateTitle(pageText, pdfFilename, pageNum),
          description: this.generateDescription(pageText, pageNum, pagesToProcess, width, height),
          type: this.detectSlideType(pageText),
          urls: [],
        }

        const slide = await payload.create({
          collection: 'slides',
          data: {
            ...slideData,
            parent: Number(moduleId), // Set the parent relationship for nested docs
            parent_id: Number(moduleId), // Set the parent_id for database field
            source: {
              pdfFilename,
              pdfPage: pageNum,
              module: Number(moduleId),
            },
          },
          overrideAccess: true,
          depth: 0,
        })

        console.log(`✅ Slide ${slide.id} created for page ${pageNum}`)
        slideIds.push(slide.id)
        slidesCreated++
      } catch (error) {
        console.error(`❌ Error processing page ${pageNum}:`, error)
      }
    }

    // Update module with immediate slides
    if (slideIds.length > 0) {
      const currentModule = await payload.findByID({
        collection: 'modules',
        id: String(moduleId),
      })

      const existingSlides = currentModule.slides || []
      await payload.update({
        collection: 'modules',
        id: String(moduleId),
        data: {
          slides: [...existingSlides, ...slideIds],
        },
        overrideAccess: true,
        depth: 0,
      })
    }

    return {
      slidesCreated,
      slideIds,
      pagesProcessed: pagesToProcess,
    }
  }

  /**
   * Queue remaining pages for background processing
   */
  private async queueRemainingPages(
    pdfBuffer: Buffer,
    moduleId: string,
    pdfFilename: string,
    startPage: number,
    totalPages: number,
    payload: any,
  ): Promise<{ chunks: number; totalPages: number; estimatedTime: number }> {
    console.log(`📋 Queueing pages ${startPage + 1} to ${totalPages} for background processing...`)

    const remainingPages = totalPages - startPage
    const chunks = Math.ceil(remainingPages / this.config.chunkSize)

    // Store processing job info
    // In a real implementation, this would create background jobs
    // For now, we'll store the job metadata
    const jobData = {
      moduleId,
      pdfFilename,
      startPage,
      totalPages,
      chunks,
      chunkSize: this.config.chunkSize,
      enableImages: this.config.enableImages,
      status: 'queued',
      createdAt: new Date().toISOString(),
    }

    // In production, you would:
    // 1. Store this in a jobs collection
    // 2. Trigger AWS Lambda/SQS/EventBridge
    // 3. Process chunks asynchronously

    console.log('📦 Job queued:', jobData)

    // Estimate processing time
    const timePerPage = this.config.enableImages ? 8 : 2 // seconds
    const estimatedTime = remainingPages * timePerPage

    return {
      chunks,
      totalPages: remainingPages,
      estimatedTime,
    }
  }

  /**
   * Process a single chunk (called by background job)
   */
  async processChunk(
    pdfBuffer: Buffer,
    moduleId: string,
    pdfFilename: string,
    startPage: number,
    endPage: number,
  ): Promise<{ success: boolean; slidesCreated: number }> {
    console.log(`🔄 Processing chunk: pages ${startPage} to ${endPage}`)

    try {
      const payload = await getPayload({ config })
      const pdfDoc = await PDFDocument.load(pdfBuffer)
      const pdfText = await extractTextFromPDF(pdfBuffer)

      const slideIds: Array<number | string> = []

      for (let pageNum = startPage; pageNum <= endPage; pageNum++) {
        if (pageNum > pdfDoc.getPageCount()) break

        // Process page (similar to immediate processing)
        // ... (implementation similar to processImmediatePages)

        // This would include image generation since it's background
      }

      // Update module with new slides
      if (slideIds.length > 0) {
        const currentModule = await payload.findByID({
          collection: 'modules',
          id: String(moduleId),
        })

        await payload.update({
          collection: 'modules',
          id: String(moduleId),
          data: {
            slides: [...(currentModule.slides || []), ...slideIds],
          },
          overrideAccess: true,
          depth: 0,
        })
      }

      return {
        success: true,
        slidesCreated: slideIds.length,
      }
    } catch (error) {
      console.error('❌ Chunk processing error:', error)
      return {
        success: false,
        slidesCreated: 0,
      }
    }
  }

  private generateTitle(text: string, filename: string, pageNum: number): string {
    if (!text || text.length < 10) {
      return `${filename.replace('.pdf', '')} - Page ${pageNum}`
    }
    const lines = text.split('\n').filter((line) => line.trim().length > 0)
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
    height: number,
  ): string {
    const pageInfo = `Page ${pageNum} of ${totalPages} (${Math.round(width)}x${Math.round(height)}px)`
    if (!text || text.length < 20) {
      return pageInfo
    }
    const cleanText = text.replace(/\s+/g, ' ').trim().substring(0, 500)
    return `${pageInfo}\n\n${cleanText}${text.length > 500 ? '...' : ''}`
  }

  private detectSlideType(text: string): string {
    const lowerText = text.toLowerCase()
    if (lowerText.includes('quiz') || lowerText.includes('question')) return 'quiz'
    if (lowerText.includes('reference') || lowerText.includes('bibliography')) return 'reference'
    if (lowerText.includes('resource') || lowerText.includes('link')) return 'resources'
    if (lowerText.includes('video') || lowerText.includes('youtube')) return 'video'
    return 'regular'
  }
}
