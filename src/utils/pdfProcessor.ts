import { PDFDocument } from 'pdf-lib'
import { getPayload } from 'payload'
import config from '../payload.config'
import path from 'path'
import { Worker } from 'worker_threads'
import { fileURLToPath } from 'url'

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

      // Create slides from processed images
      console.log(`🔄 Creating slides from ${images.length} processed pages...`)

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

          // Create slide with the image
          console.log(`🎯 Creating slide for page ${pageNum}...`)

          // Create slide with hardcoded values for required fields
          const slide = await payload.create({
            collection: 'slides',
            data: {
              title: `${path.parse(pdfFilename).name} - Page ${pageNum}`,
              description: `Page ${pageNum} from ${pdfFilename}`,
              type: 'regular',
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
          // progress tracking removed
        } catch (pageError) {
          console.error(`❌ Error processing page ${pageNum}:`, pageError)
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

      // Update module with all slides (existing + new)
      console.log('💾 Updating module with new slides...')
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
        // success status tracking removed
      } catch (updateErr) {
        console.warn('⚠️ Immediate module update failed, retrying shortly...', updateErr)
        // Retry after lock cleanup finishes
        setTimeout(() => {
          payload
            .update({
              collection: 'modules',
              id: String(moduleId),
              data: { slides: [...existingSlides, ...slideIds] as any },
              overrideAccess: true,
              depth: 0,
            })
            .then(async () => {
              console.log('✅ Module updated on retry')
            })
            .catch((err) => console.error('❌ Retry update failed:', err))
        }, 1500)
      }

      console.log(`🎉 PDF processing completed successfully! Created ${slidesCreated} slides.`)
      return {
        success: true,
        slidesCreated,
        slideIds,
        moduleUpdated: true,
      }
    } catch (error) {
      console.error('💥 PDF processing error:', error)
      console.error('💥 Error stack:', error instanceof Error ? error.stack : 'No stack trace')
      // failure status tracking removed
      return {
        success: false,
        slidesCreated: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        slideIds: [],
        moduleUpdated: false,
      }
    }
  }

  /**
   * Split PDF text content into logical slides
   */
  private splitIntoSlides(text: string): Array<{ title: string; description: string }> {
    const slides: Array<{ title: string; description: string }> = []

    // First try to split by double line breaks (common in PDFs)
    let sections = text.split(/\n\s*\n/).filter((section) => section.trim().length > 50)

    // If we don't get good sections, split by single line breaks and group
    if (sections.length < 2) {
      const lines = text.split('\n').filter((line) => line.trim().length > 0)
      sections = this.groupLines(lines)
    }

    // Create slides from sections
    sections.forEach((section, index) => {
      const lines = section.trim().split('\n')
      const firstLine = lines[0]?.trim() || ''

      // Use first line as title if it's short enough, otherwise generate title
      const title = firstLine.length < 80 && firstLine.length > 5 ? firstLine : `Slide ${index + 1}`

      slides.push({
        title: this.cleanTitle(title),
        description: section.trim(),
      })
    })

    return slides.length > 0
      ? slides
      : [
          {
            title: 'Content from PDF',
            description: text.trim(),
          },
        ]
  }

  /**
   * Group lines into logical sections
   */
  private groupLines(lines: string[]): string[] {
    const sections: string[] = []
    const linesPerSection = 15 // Approximate lines per slide

    for (let i = 0; i < lines.length; i += linesPerSection) {
      const sectionLines = lines.slice(i, i + linesPerSection)
      const section = sectionLines.join('\n').trim()

      if (section.length > 50) {
        sections.push(section)
      }
    }

    return sections
  }

  /**
   * Clean and format title text
   */
  private cleanTitle(title: string): string {
    return (
      title
        .substring(0, 100)
        .replace(/[^\w\s-.,!?]/g, '')
        .replace(/\s+/g, ' ')
        .trim() || 'Untitled Slide'
    )
  }
}
