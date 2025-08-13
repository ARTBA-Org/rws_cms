import { PDFDocument } from 'pdf-lib'
import { getPayload } from 'payload'
import config from '../payload.config'
import { extractTextFromPDF } from './pdfTextExtractor'

export interface PDFProcessResult {
  success: boolean
  slidesCreated: number
  errors?: string[]
  slideIds?: Array<number | string>
  moduleUpdated?: boolean
  textExtracted?: boolean
  imagesGenerated?: boolean
}

export class PDFProcessor {
  /**
   * Safe Lambda-compatible PDF processor that works with existing database schema
   * Extracts text and creates meaningful slides without requiring new database fields
   */
  async processPDFToSlides(
    pdfBuffer: Buffer,
    moduleId: string,
    pdfFilename: string,
  ): Promise<PDFProcessResult> {
    console.log('🔧 Safe PDFProcessor.processPDFToSlides called')
    console.log('📋 Parameters:', {
      bufferSize: pdfBuffer.length,
      moduleId,
      pdfFilename,
    })

    try {
      console.log('🚀 Initializing Payload...')
      const payload = await getPayload({ config })
      const slideIds: Array<number | string> = []
      let slidesCreated = 0
      let textExtracted = false

      // Load PDF document for metadata
      console.log('📖 Loading PDF document...')
      const pdfDoc = await PDFDocument.load(pdfBuffer)
      const totalPages = pdfDoc.getPageCount()
      console.log(`📊 PDF has ${totalPages} pages`)

      // Extract text from entire PDF
      console.log('📝 Extracting text from PDF...')
      const pdfText = await extractTextFromPDF(pdfBuffer)
      
      if (pdfText && pdfText.text) {
        textExtracted = true
        console.log(`✅ Extracted ${pdfText.text.length} characters of text`)
        console.log(`📄 PDF Info:`, {
          pages: pdfText.numpages,
          info: pdfText.info,
          metadata: pdfText.metadata,
        })
      } else {
        console.warn('⚠️ Text extraction returned no text')
      }

      // Process each page individually
      for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
        console.log(`📄 Processing page ${pageNum}/${totalPages}`)

        try {
          // Get page from pdf-lib for dimensions
          const page = pdfDoc.getPage(pageNum - 1)
          const { width, height } = page.getSize()

          // Extract text for specific page (if available)
          let pageText = ''
          if (pdfText && pdfText.text) {
            // Simple page text extraction - splits by common page markers
            const allText = pdfText.text
            const textPages = allText.split(/\f|\n{3,}/) // Split by form feed or multiple newlines
            if (textPages[pageNum - 1]) {
              pageText = textPages[pageNum - 1].trim()
            } else {
              // Fallback: divide text equally among pages
              const charsPerPage = Math.ceil(allText.length / totalPages)
              const startIdx = (pageNum - 1) * charsPerPage
              pageText = allText.substring(startIdx, startIdx + charsPerPage).trim()
            }
            console.log(`📝 Extracted ${pageText.length} characters for page ${pageNum}`)
          }

          // Generate enhanced title and description from extracted text
          const title = this.generateTitle(pageText, pdfFilename, pageNum)
          const enhancedDescription = this.generateEnhancedDescription(
            pageText, 
            pageNum, 
            totalPages, 
            width, 
            height
          )

          // Create slide with only existing fields
          console.log(`🎯 Creating slide for page ${pageNum}...`)
          
          const slideData: any = {
            title,
            description: enhancedDescription, // Put extracted text in description
            type: this.detectSlideType(pageText),
            urls: [],
          }

          const slide = await payload.create({
            collection: 'slides',
            data: slideData,
            overrideAccess: true,
            depth: 0,
          })
          
          console.log(`✅ Slide created with ID: ${slide.id}`)
          slideIds.push(slide.id)
          slidesCreated++
          
        } catch (pageError) {
          console.error(`❌ Error processing page ${pageNum}:`, pageError)
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
        textExtracted,
        imagesGenerated: false,
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
        textExtracted: false,
        imagesGenerated: false,
      }
    }
  }

  /**
   * Generate a meaningful title from extracted text
   */
  private generateTitle(text: string, filename: string, pageNum: number): string {
    if (!text || text.length < 10) {
      return `${filename.replace('.pdf', '')} - Page ${pageNum}`
    }

    // Try to find a title-like line (short, at the beginning)
    const lines = text.split('\n').filter(line => line.trim().length > 0)
    const firstLine = lines[0]?.trim() || ''
    
    if (firstLine.length > 5 && firstLine.length < 100) {
      // Clean up the title
      return firstLine
        .replace(/[^\w\s-.,!?]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
    }

    // Look for heading-like text (all caps, or followed by empty line)
    for (const line of lines.slice(0, 5)) {
      const trimmed = line.trim()
      if (trimmed.length > 5 && trimmed.length < 100) {
        if (trimmed === trimmed.toUpperCase() || lines.indexOf(line) < lines.length - 1) {
          return trimmed
            .replace(/[^\w\s-.,!?]/g, '')
            .replace(/\s+/g, ' ')
            .trim()
        }
      }
    }

    return `${filename.replace('.pdf', '')} - Page ${pageNum}`
  }

  /**
   * Generate an enhanced description that includes extracted text
   */
  private generateEnhancedDescription(
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

    // Include more text in the description since we can't use extractedText field yet
    const maxTextLength = 1000 // Store more text in description
    const cleanText = text
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, maxTextLength)

    // Format: Page info, then extracted content
    return `${pageInfo}\n\n--- Extracted Content ---\n${cleanText}${text.length > maxTextLength ? '...' : ''}`
  }

  /**
   * Detect slide type based on content (using only existing types)
   */
  private detectSlideType(text: string): string {
    const lowerText = text.toLowerCase()
    
    // Check for quiz indicators
    if (lowerText.includes('quiz') || lowerText.includes('question') || 
        lowerText.includes('answer')) {
      return 'quiz'
    }
    
    // Check for reference indicators
    if (lowerText.includes('reference') || lowerText.includes('bibliography') || 
        lowerText.includes('citation') || lowerText.includes('source')) {
      return 'reference'
    }
    
    // Check for resources indicators
    if (lowerText.includes('resource') || lowerText.includes('link') ||
        lowerText.includes('download') || lowerText.includes('material')) {
      return 'resources'
    }

    // Check for video indicators
    if (lowerText.includes('video') || lowerText.includes('watch') ||
        lowerText.includes('youtube') || lowerText.includes('vimeo')) {
      return 'video'
    }

    // Default to regular for everything else
    return 'regular'
  }
}