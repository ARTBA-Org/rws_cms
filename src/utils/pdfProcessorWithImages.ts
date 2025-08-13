import { PDFDocument } from 'pdf-lib'
import { getPayload } from 'payload'
import config from '../payload.config'
import { extractTextFromPDF } from './pdfTextExtractor'
import { convertPDFPageToImage } from './pdfToImageLambda'

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
   * Complete Lambda-compatible PDF processor with text extraction and image generation
   * Uses Puppeteer for image generation in Lambda environment
   */
  async processPDFToSlides(
    pdfBuffer: Buffer,
    moduleId: string,
    pdfFilename: string,
  ): Promise<PDFProcessResult> {
    console.log('🔧 Complete PDFProcessor with Images called')
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
      }

      // Process each page individually
      for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
        console.log(`📄 Processing page ${pageNum}/${totalPages}`)

        try {
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
            console.log(`📝 Extracted ${pageText.length} characters for page ${pageNum}`)
          }

          // Generate image for this page
          let imageMediaId = null
          console.log(`🖼️ Generating image for page ${pageNum}...`)
          
          try {
            // Extract single page as PDF first
            const singlePageDoc = await PDFDocument.create()
            const [copiedPage] = await singlePageDoc.copyPages(pdfDoc, [pageNum - 1])
            singlePageDoc.addPage(copiedPage)
            const singlePageBuffer = Buffer.from(await singlePageDoc.save())
            
            // Convert to image using Puppeteer
            const imageBuffer = await convertPDFPageToImage(singlePageBuffer, 1)
            
            if (imageBuffer && imageBuffer.length > 0) {
              // Upload image to media collection
              const imageName = `${pdfFilename.replace('.pdf', '')}_page_${pageNum}.png`
              console.log(`📤 Uploading image: ${imageName}`)
              
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
              imagesGenerated = true
              console.log(`✅ Image uploaded with ID: ${imageMediaId}`)
            } else {
              console.warn(`⚠️ Failed to generate image for page ${pageNum}`)
            }
          } catch (imageError) {
            console.error(`❌ Image generation error for page ${pageNum}:`, imageError)
            // Continue without image
          }

          // Generate title and description
          const title = this.generateTitle(pageText, pdfFilename, pageNum)
          const description = this.generateDescription(pageText, pageNum, totalPages, width, height)

          // Create slide with image and text
          console.log(`🎯 Creating slide for page ${pageNum}...`)
          
          const slideData: any = {
            title,
            description,
            type: this.detectSlideType(pageText),
            urls: [],
          }

          // Add image if available
          if (imageMediaId) {
            slideData.image = imageMediaId
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
        imagesGenerated,
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
    
    if (lowerText.includes('title') || lowerText.includes('cover')) {
      return 'title'
    }
    
    if (lowerText.includes('conclusion') || lowerText.includes('summary')) {
      return 'conclusion'
    }
    
    if (text.includes('•') || text.includes('►') || /^\s*[-*]\s+/m.test(text)) {
      return 'bullets'
    }

    if (text.length < 100) {
      return 'image'
    }

    return 'regular'
  }
}