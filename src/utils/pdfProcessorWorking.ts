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
      console.log('🚀 Initializing Payload...')
      const payload = await getPayload({ config })
      const slideIds: Array<number | string> = []
      let slidesCreated = 0

      console.log('📋 Processing started for module:', moduleId)

      // Load PDF document to get page count
      console.log('📖 Loading PDF document...')
      const pdfDoc = await PDFDocument.load(pdfBuffer)
      const totalPages = pdfDoc.getPageCount()
      console.log('📊 PDF info:', {
        pages: totalPages,
        filename: pdfFilename,
      })

      console.log(`Processing PDF: ${pdfFilename} with ${totalPages} pages`)

      // Convert PDF to images
      console.log('🖼️ Converting PDF to images...')

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

      // Use worker thread for PDF processing to isolate canvas dependency
      let useWorker = process.env.NODE_ENV !== 'test' // Skip worker in tests
      let images: Buffer[] = []

      if (useWorker) {
        try {
          console.log('🔧 Using worker thread for PDF conversion')
          const __filename = fileURLToPath(import.meta.url)
          const __dirname = path.dirname(__filename)
          const workerPath = path.join(__dirname, 'pdfWorker.js')

          images = await new Promise<Buffer[]>((resolve, reject) => {
            const worker = new Worker(workerPath, {
              workerData: {
                pdfBuffer: Array.from(pdfBuffer),
                totalPages,
              },
            })

            const collectedImages: Buffer[] = []

            worker.on('message', (msg) => {
              if (msg.type === 'progress') {
                console.log(`📄 Processing page ${msg.page}/${msg.totalPages} in worker`)
              } else if (msg.type === 'complete') {
                msg.images.forEach((img: any) => collectedImages.push(Buffer.from(img)))
                resolve(collectedImages)
              } else if (msg.type === 'error') {
                reject(new Error(msg.error))
              }
            })

            worker.on('error', reject)
            worker.on('exit', (code) => {
              if (code !== 0 && collectedImages.length === 0) {
                reject(new Error(`Worker stopped with exit code ${code}`))
              }
            })
          })
        } catch (workerError) {
          console.warn('⚠️ Worker thread failed, falling back to direct processing:', workerError)
          // Fallback to direct processing
          useWorker = false
        }
      }

      // Fallback: direct processing without worker
      if (!useWorker) {
        console.log('🔧 Using direct pdf2pic conversion')
        const pdf2picMod: any = await import('pdf2pic')
        const fromBuffer = pdf2picMod.fromBuffer || pdf2picMod.default?.fromBuffer
        if (!fromBuffer) throw new Error('pdf2pic.fromBuffer not available')

        const converter = fromBuffer(pdfBuffer, {
          density: 150,
          format: 'png',
          width: 1920,
          height: 1080,
          preserveAspectRatio: true,
        })
        if (typeof (converter as any).setGMClass === 'function') (converter as any).setGMClass(true)

        for (let page = 1; page <= totalPages; page++) {
          const res = await converter(page, { responseType: 'buffer' })
          const buffer: Buffer = (res && (res.buffer || res.result || res)) as Buffer
          if (!buffer || buffer.length === 0) {
            throw new Error(`pdf2pic returned empty buffer for page ${page}`)
          }
          images.push(buffer)
          console.log(`📄 Processing page ${page}/${totalPages}`)
        }
      }

      // Restore Array.prototype
      for (const prop of pollutedProps) {
        ;(Array.prototype as any)[prop] = arrayProtoBackup[prop]
      }

      // Create slides from processed images with AI analysis
      console.log(`🔄 Creating slides from ${images.length} processed pages...`)

      // Initialize AI analyzer
      const analyzer = new SlideAnalyzer()

      // Prepare slides for batch analysis
      const slidesForAnalysis = images.map((buffer, index) => ({
        buffer,
        pageNumber: index + 1,
      }))

      // Analyze all slides with AI (if OpenAI API key is available)
      let analyses: any[] = []
      if (process.env.OPENAI_API_KEY) {
        console.log('🤖 Starting AI analysis of slides...')
        try {
          analyses = await analyzer.analyzeSlides(slidesForAnalysis, pdfFilename)
          console.log(`✅ AI analysis complete for ${analyses.length} slides`)
        } catch (error) {
          console.warn('⚠️ AI analysis failed, using fallback descriptions:', error)
          analyses = []
        }
      } else {
        console.log('⚠️ No OpenAI API key found, skipping AI analysis')
      }

      let pageNum = 0

      for (const imageBuffer of images) {
        pageNum++
        console.log(`📄 Creating slide ${pageNum}/${totalPages}`)

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
          const slideTitle = analysis?.title || `${path.parse(pdfFilename).name} - Page ${pageNum}`
          const slideDescription = analysis?.description || `Page ${pageNum} from ${pdfFilename}`
          const slideType = analysis?.type || 'regular'

          // Create slide with AI-enhanced data
          console.log(`🎯 Creating slide for page ${pageNum}...`)
          if (analysis && analysis.confidence > 0) {
            console.log(`🤖 Using AI analysis (${analysis.confidence}% confidence):`)
            console.log(`   Type: ${slideType}`)
            console.log(`   Title: ${slideTitle}`)
            console.log(`   Description: ${slideDescription.substring(0, 100)}...`)
          } else {
            console.log(`📝 Using fallback data for page ${pageNum}`)
          }

          // Validate and clean slide data
          const cleanSlideData = {
            title: slideTitle.trim() || `Page ${pageNum}`,
            description: slideDescription.trim() || `Page ${pageNum} from ${pdfFilename}`,
            type: slideType,
            image: mediaDoc.id,
            urls: [],
          }

          console.log(`📝 Final slide data:`, {
            title: cleanSlideData.title,
            type: cleanSlideData.type,
            descriptionLength: cleanSlideData.description.length,
          })

          const slide = await payload.create({
            collection: 'slides',
            data: cleanSlideData,
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

      await updateModuleWithRetry()

      console.log(`🎉 PDF processing completed successfully! Created ${slidesCreated} slides.`)

      // Collect slide types for reporting
      const slideTypes = analyses.map((a) => a?.type || 'regular')
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
