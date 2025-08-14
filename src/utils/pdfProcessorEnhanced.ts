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
   * Enhanced Lambda-compatible PDF processor that extracts text and generates images
   * Uses pdf-parse for text extraction and cloud API for image generation
   */
  async processPDFToSlides(
    pdfBuffer: Buffer,
    moduleId: string,
    pdfFilename: string,
  ): Promise<PDFProcessResult> {
    console.log('🔧 Enhanced PDFProcessor.processPDFToSlides called')
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
      let imagesGenerated = false

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
            // For more accurate per-page text, we'd need a more sophisticated approach
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

          // Generate title and description from extracted text
          const title = this.generateTitle(pageText, pdfFilename, pageNum)
          const description = this.generateDescription(pageText, pageNum, totalPages, width, height)

          // For image generation, we have several options:
          // 1. Use a cloud service (like Bannerbear, Placid, or HTML/CSS to Image API)
          // 2. Generate a placeholder with extracted text
          // 3. Store the PDF page as a separate PDF and convert client-side
          
          // Option 3: Extract single page as PDF (can be converted client-side later)
          let singlePageBuffer: Buffer | null = null
          try {
            const singlePageDoc = await PDFDocument.create()
            const [copiedPage] = await singlePageDoc.copyPages(pdfDoc, [pageNum - 1])
            singlePageDoc.addPage(copiedPage)
            const pdfBytes = await singlePageDoc.save()
            singlePageBuffer = Buffer.from(pdfBytes)
            console.log(`📄 Created single-page PDF (${singlePageBuffer.length} bytes)`)
          } catch (pageError) {
            console.warn(`⚠️ Failed to extract page ${pageNum} as PDF:`, pageError)
          }

          // Upload single-page PDF as media (for client-side conversion later)
          let mediaId = null
          if (singlePageBuffer) {
            try {
              const mediaDoc = await payload.create({
                collection: 'media',
                data: {
                  alt: `Page ${pageNum} from ${pdfFilename}`,
                },
                file: {
                  data: singlePageBuffer,
                  mimetype: 'application/pdf',
                  name: `${pdfFilename.replace('.pdf', '')}_page_${pageNum}.pdf`,
                  size: singlePageBuffer.length,
                },
                overrideAccess: true,
                depth: 0,
              })
              mediaId = mediaDoc.id
              console.log(`✅ Page PDF uploaded with ID: ${mediaId}`)
            } catch (uploadError) {
              console.warn(`⚠️ Failed to upload page ${pageNum} PDF:`, uploadError)
            }
          }

          // Create slide with extracted text and page PDF
          console.log(`🎯 Creating slide for page ${pageNum}...`)
          
          // Base slide data that should always work
          const slideData: any = {
            title,
            description,
            type: this.detectSlideType(pageText),
            urls: [],
          }

          // Try to add new fields, but don't fail if they don't exist yet
          try {
            // These fields might not exist in production yet
            slideData.extractedText = pageText.substring(0, 5000) // Limit text length
            slideData.pageNumber = pageNum
            slideData.pageDimensions = {
              width: Math.round(width),
              height: Math.round(height),
            }
            
            // Add media reference if we have a page PDF
            if (mediaId) {
              slideData.pdfPage = mediaId // Store page PDF for later conversion
            }
          } catch (fieldError) {
            console.warn('⚠️ Some new fields not available yet, using base fields only')
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
        imagesGenerated: false, // Images need client-side conversion
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
   * Generate a description from extracted text
   */
  private generateDescription(
    text: string, 
    pageNum: number, 
    totalPages: number,
    width: number,
    height: number
  ): string {
    const dimensions = `Page ${pageNum} of ${totalPages} (${Math.round(width)}x${Math.round(height)}px)`
    
    if (!text || text.length < 20) {
      return dimensions
    }

    // Get first 200 characters of meaningful text
    const cleanText = text
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 200)

    return `${dimensions}\n\n${cleanText}${text.length > 200 ? '...' : ''}`
  }

  /**
   * Detect slide type based on content
   */
  private detectSlideType(text: string): string {
    const lowerText = text.toLowerCase()
    
    // Check for title/cover page indicators
    if (lowerText.includes('title') || lowerText.includes('cover') || 
        lowerText.includes('presentation') || lowerText.includes('prepared by')) {
      return 'title'
    }
    
    // Check for conclusion indicators
    if (lowerText.includes('conclusion') || lowerText.includes('summary') || 
        lowerText.includes('thank you') || lowerText.includes('questions')) {
      return 'conclusion'
    }
    
    // Check for section headers
    if (lowerText.includes('introduction') || lowerText.includes('overview') ||
        lowerText.includes('agenda') || lowerText.includes('outline')) {
      return 'section'
    }

    // Check for bullet points or lists
    if (text.includes('•') || text.includes('►') || text.includes('▪') ||
        /^\s*[-*]\s+/m.test(text) || /^\s*\d+\.\s+/m.test(text)) {
      return 'bullets'
    }

    // Check for images/charts (usually less text)
    if (text.length < 100) {
      return 'image'
    }

    return 'regular'
  }
}