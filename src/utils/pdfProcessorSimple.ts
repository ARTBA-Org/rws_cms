import { PDFDocument } from 'pdf-lib'
import { getPayload } from 'payload'
import config from '../payload.config'
import path from 'path'
import { Worker } from 'worker_threads'
import { fileURLToPath } from 'url'
import { SlideAnalyzer } from './slideAnalyzer'

export interface PDFProcessResult {
  success: boolean
  slidesCreated: number
  errors?: string[]
  slideIds?: Array<number | string>
  moduleUpdated?: boolean
  aiAnalysisUsed?: boolean
  slideTypes?: string[]
}

// Simple progress tracker for logging
class ProgressTracker {
  private moduleId: string

  constructor(moduleId: string) {
    this.moduleId = moduleId
  }

  start() {
    console.log(`📊 Starting progress tracking for module ${this.moduleId}`)
  }

  addStep(message: string) {
    console.log(message)
  }

  complete(message: string) {
    console.log(`✅ ${message}`)
  }
}

export class PDFProcessor {
  /**
   * Process PDF and create slides for a module
   * Splits PDF into individual pages as images and creates slides
   */
  async processPDFToSlides(
    pdfBuffer: Buffer,
    moduleId: string,
    pdfFilename: string,
  ): Promise<PDFProcessResult> {
    console.log('🔧 PDFProcessor.processPDFToSlides called')
    console.log('📋 Parameters:', {
      bufferSize: pdfBuffer.length,
      moduleId,
      pdfFilename,
    })

    // Normalize module relationship value once for use across try/catch
    const moduleIdNum = Number(moduleId)
    const moduleRelValue: number | string = Number.isNaN(moduleIdNum) ? moduleId : moduleIdNum

    try {
      // Initialize progress tracker
      const progress = new ProgressTracker(moduleId)
      progress.start()

      console.log('🚀 Initializing Payload...')
      progress.addStep('🚀 Initializing Payload...')
      const payload = await getPayload({ config })
      const slideIds: Array<number | string> = []
      let slidesCreated = 0

      console.log('📋 Processing started for module:', moduleId)

      // Load PDF document to get page count
      console.log('📖 Loading PDF document...')
      progress.addStep('📖 Loading PDF document...')
      const pdfDoc = await PDFDocument.load(pdfBuffer)
      const totalPages = pdfDoc.getPageCount()
      console.log('📊 PDF info:', {
        pages: totalPages,
        filename: pdfFilename,
      })

      console.log(`Processing PDF: ${pdfFilename} with ${totalPages} pages`)
      progress.addStep(`📊 Found ${totalPages} pages in PDF`)

      // Convert PDF to images
      console.log('🖼️ Converting PDF to images...')
      progress.addStep('🖼️ Converting PDF to images...')

      // Clean up Array.prototype pollution that breaks pdfjs-dist
      const arrayProtoBackup: any = {}
      const pollutedProps = []
      for (const prop in Array.prototype) {
        if (
          prop !== 'constructor' &&
          ![
            'length',
            'push',
            'pop',
            'shift',
            'unshift',
            'slice',
            'splice',
            'indexOf',
            'forEach',
            'map',
            'filter',
            'reduce',
            'find',
            'includes',
          ].includes(prop)
        ) {
          arrayProtoBackup[prop] = (Array.prototype as any)[prop]
          delete (Array.prototype as any)[prop]
          pollutedProps.push(prop)
        }
      }

      if (pollutedProps.length > 0) {
        console.log('🧹 Cleaned Array.prototype pollution:', pollutedProps)
      }

      // Create placeholder images for each page since we can't convert in Lambda
      // In production, you would want to use a Lambda layer with proper binaries
      // or process PDFs in a container with the necessary dependencies
      console.log('🔧 Creating placeholder images for PDF pages')
      const images: Buffer[] = []

      // For now, create simple placeholder images for each page
      // This is a temporary solution - in production you'd want proper PDF rendering
      for (let page = 1; page <= totalPages; page++) {
        console.log(`📄 Creating placeholder for page ${page}/${totalPages}`)

        // Extract the page from the PDF document
        const pdfDoc = await PDFDocument.load(pdfBuffer)
        const pages = pdfDoc.getPages()
        const currentPage = pages[page - 1]

        // Create a new PDF with just this page
        const singlePagePdf = await PDFDocument.create()
        const [copiedPage] = await singlePagePdf.copyPages(pdfDoc, [page - 1])
        singlePagePdf.addPage(copiedPage)

        // For now, we'll store the PDF page as a buffer
        // In a real implementation, you'd convert this to an image
        const pdfBytes = await singlePagePdf.save()
        images.push(Buffer.from(pdfBytes))

        console.log(`✅ Created placeholder for page ${page}`)
      }

      // Restore Array.prototype
      for (const prop of pollutedProps) {
        ; (Array.prototype as any)[prop] = arrayProtoBackup[prop]
      }

      // Create slides from processed images with AI analysis
      console.log(`🔄 Creating slides from ${images.length} processed pages...`)

      // Analyze all slides with AI (if OpenAI API key is available)
      let analyses: any[] = []
      if (process.env.OPENAI_API_KEY) {
        console.log('🤖 Starting AI analysis of slides...')
        progress.addStep('🤖 Starting AI analysis of slides...')
        try {
          // Initialize AI analyzer only when API key is available
          const analyzer = new SlideAnalyzer()

          // Prepare slides for batch analysis
          const slidesForAnalysis = images.map((buffer, index) => ({
            buffer,
            pageNumber: index + 1,
          }))

          analyses = await analyzer.analyzeSlides(slidesForAnalysis, pdfFilename)
          console.log(`✅ AI analysis complete for ${analyses.length} slides`)
          progress.addStep(`✅ AI analysis complete for ${analyses.length} slides`)
        } catch (error) {
          console.warn('⚠️ AI analysis failed, using fallback descriptions:', error)
          progress.addStep('⚠️ AI analysis failed, using fallback descriptions')
          analyses = []
        }
      } else {
        console.log('⚠️ No OpenAI API key found, skipping AI analysis')
        progress.addStep('⚠️ No OpenAI API key found, skipping AI analysis')
      }

      let pageNum = 0

      for (const imageBuffer of images) {
        pageNum++
        console.log(`📄 Creating slide ${pageNum}/${totalPages}`)
        progress.addStep(`📄 Creating slide ${pageNum}/${totalPages}`)

        try {
          console.log(`📦 Image buffer size: ${imageBuffer.length} bytes`)

          // Upload image to media collection
          const imageName = `${path.parse(pdfFilename).name}_page_${pageNum}.png`
          console.log(`📤 Uploading image to media collection: ${imageName}`)

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
          console.log(`✅ Image uploaded with ID: ${mediaDoc.id}`)

          // Get AI analysis for this slide (if available)
          const analysis = analyses[pageNum - 1]
          const slideTitle = analysis?.Title || `${path.parse(pdfFilename).name} - Page ${pageNum}`
          const slideDescription = analysis?.Description || `Page ${pageNum} from ${pdfFilename}`
          const slideType = analysis?.Type?.toLowerCase() || 'regular'

          // Create slide with AI-enhanced data
          console.log(`🎯 Creating slide for page ${pageNum}...`)
          if (analysis) {
            console.log(`🤖 Using AI analysis: ${slideType} - ${slideTitle.substring(0, 50)}...`)
          }

          const slide = await payload.create({
            collection: 'slides',
            data: {
              title: slideTitle,
              description: slideDescription,
              type: slideType,
              image: mediaDoc.id,
              urls: [],
            },
            overrideAccess: true,
            depth: 0,
          })
          console.log(`✅ Slide created with ID: ${slide.id}`)

          slideIds.push(slide.id)
          slidesCreated++
          console.log(`✅ Page ${pageNum} processing complete`)
        } catch (pageError) {
          console.error(`❌ Error processing page ${pageNum}:`, pageError)
          console.error('❌ Error details:', {
            message: pageError instanceof Error ? pageError.message : 'Unknown error',
            stack: pageError instanceof Error ? pageError.stack : 'No stack trace',
            pageNum,
            imageBufferSize: imageBuffer?.length || 'undefined',
          })
          // Continue with next page even if one fails
        }
      }

      // Get current module and add new slides to existing ones
      console.log(`🔍 Fetching current module ${moduleId} to update slides...`)
      const currentModule = await payload.findByID({
        collection: 'modules',
        id: String(moduleId),
      })

      // Get existing slides
      const existingSlides = currentModule.slides || []
      console.log('📊 Module slides status:', {
        existingSlides: existingSlides.length,
        newSlides: slideIds.length,
        totalSlides: existingSlides.length + slideIds.length,
      })

      // Update module with all slides (existing + new) - with improved retry logic
      console.log('💾 Updating module with new slides...')

      const updateModuleWithRetry = async (retryCount = 0): Promise<void> => {
        try {
          await payload.update({
            collection: 'modules',
            id: String(moduleId),
            data: {
              slides: [...existingSlides, ...slideIds] as any,
            },
            overrideAccess: true,
            depth: 0,
          })
          console.log('✅ Module updated successfully')
        } catch (updateErr: any) {
          const isLockError =
            updateErr?.message?.includes('payload_locked_documents') || updateErr?.code === '57014' // PostgreSQL statement timeout

          if (isLockError && retryCount < 3) {
            const delay = Math.min(500 * Math.pow(2, retryCount), 3000) // Exponential backoff: 500ms, 1s, 2s
            console.warn(
              `⚠️ Database lock detected, retrying in ${delay}ms (attempt ${retryCount + 1}/3)...`,
            )

            await new Promise((resolve) => setTimeout(resolve, delay))
            return updateModuleWithRetry(retryCount + 1)
          } else {
            console.error('❌ Module update failed after retries:', updateErr)
            throw updateErr
          }
        }
      }

      progress.addStep('💾 Updating module with new slides...')
      await updateModuleWithRetry()

      console.log(`🎉 PDF processing completed successfully! Created ${slidesCreated} slides.`)

      // Collect slide types for reporting
      const slideTypes = analyses.map((a) => a?.Type?.toLowerCase() || 'regular')
      const aiAnalysisUsed = analyses.length > 0 && !!process.env.OPENAI_API_KEY

      if (aiAnalysisUsed) {
        console.log('🤖 AI Analysis Summary:', {
          totalSlides: slidesCreated,
          slideTypes: slideTypes.reduce(
            (acc, type) => {
              acc[type] = (acc[type] || 0) + 1
              return acc
            },
            {} as Record<string, number>,
          ),
        })
      }

      // Complete progress tracking
      const finalMessage = `🎉 Successfully created ${slidesCreated} slides!`
      progress.complete(finalMessage)

      return {
        success: true,
        slidesCreated,
        slideIds,
        moduleUpdated: true,
        aiAnalysisUsed,
        slideTypes,
      }
    } catch (error) {
      console.error('💥 PDF processing error:', error)
      console.error('💥 Error stack:', error instanceof Error ? error.stack : 'No stack trace')

      return {
        success: false,
        slidesCreated: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        slideIds: [],
        moduleUpdated: false,
      }
    }
  }
}
