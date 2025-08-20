import { PDFDocument } from 'pdf-lib'
import { getPayload } from 'payload'
import config from '../payload.config'
import { extractTextFromPDF } from './pdfTextExtractor'
import { SlideAnalyzer, type SlideAnalysis } from './slideAnalyzer'
// Use Puppeteer-based image conversion for all environments
import { convertPDFPageToImage } from './pdfToImagePuppeteer'
import { PDF_CONFIG } from './pdfConfig'
import { cacheManager } from './cache'
import { s3ImageUploader } from './s3ImageUploader'
import { CDN_CONFIG } from './cdnConfig'
import type {
  PDFProcessConfig,
  PDFProcessResult,
  SlideCreateData,
  SlideType,
  PopulatedModule,
  PDFProcessingError
} from '../types/pdfTypes'

// Types are now imported from ../types/pdfTypes

export class PDFProcessorOptimized {
  private config: Required<PDFProcessConfig>
  private payload: any = null

  constructor(config: PDFProcessConfig = {}) {
    this.config = {
      maxPages: config.maxPages || PDF_CONFIG.maxPages,
      timeoutMs: config.timeoutMs || PDF_CONFIG.timeoutMs,
      enableImages: config.enableImages ?? PDF_CONFIG.enableImages,
      batchSize: config.batchSize || PDF_CONFIG.batchSize,
      startPage: config.startPage ?? 1,
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
    let highestPageAttempted = 0

    try {
      console.log('🚀 Initializing Payload...')
      const payload = await getPayload({ config })

      // Load PDF document for metadata
      console.log('📖 Loading PDF document...')
      const pdfDoc = await PDFDocument.load(pdfBuffer)
      totalPages = pdfDoc.getPageCount()
      // Determine the first page to process and clamp within [1, totalPages]
      const configuredStart = Number(this.config.startPage || 1)
      const startPage = Math.min(totalPages, Math.max(1, configuredStart))
      const remaining = Math.max(0, totalPages - startPage + 1)
      const pagesToProcess = Math.min(remaining, this.config.maxPages!)
      const endPage = Math.max(startPage - 1 + Math.max(0, pagesToProcess), startPage - 1)
      console.log(
        `📊 PDF has ${totalPages} pages, processing ${pagesToProcess} page(s) from ${startPage} to ${endPage}`,
      )

      // Extract text from entire PDF first (fast operation)
      console.log('📝 Extracting text from PDF...')
      const textStartTime = Date.now()
      const pdfText = await extractTextFromPDF(pdfBuffer)

      if (pdfText && pdfText.text) {
        textExtracted = true
        const textTime = Date.now() - textStartTime
        console.log(
          `✅ Text extraction completed in ${textTime}ms: ${pdfText.text.length} characters`,
        )
      }

      // Pre-extract all single page PDFs if images are enabled
      const singlePageBuffers: Map<number, Buffer> = new Map()
      if (this.config.enableImages) {
        console.log('📄 Pre-extracting single page PDFs...')
        for (let pageNum = startPage; pageNum <= endPage; pageNum++) {
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
      const batches = this.createBatchesRange(startPage, endPage, this.config.batchSize!)
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
              payload,
              moduleId,
            )
          } catch (error) {
            console.error(`❌ Error processing page ${pageNum}:`, error)
            return null
          }
        })

        const batchResults = await Promise.all(batchPromises)

        for (let i = 0; i < batch.length; i++) {
          const pageNum = batch[i]
          const result = batchResults[i]

          // Track highest page we attempted (including duplicates)
          highestPageAttempted = Math.max(highestPageAttempted, pageNum)

          if (result) {
            slideIds.push(result.slideId)
            if (!result.wasExisting) {
              slidesCreated++
            }
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
          console.log(
            `📊 Adding ${slideIds.length} new slides to ${existingSlides.length} existing slides`,
          )

          // Simple update with just the slide IDs
          await payload.update({
            collection: 'modules',
            id: String(moduleId),
            data: {
              slides: Array.from(new Set([...existingSlides, ...slideIds])),
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
      const partialSuccess = endPage < totalPages

      // Use highestPageAttempted to determine next page
      // This handles duplicates correctly - we move past them
      const nextStartPage = highestPageAttempted < totalPages ? highestPageAttempted + 1 : null

      console.log(
        `📊 Progress: startPage=${startPage}, endPage=${endPage}, highestPageAttempted=${highestPageAttempted}, nextStartPage=${nextStartPage}, totalPages=${totalPages}`,
      )

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
        startPage,
        nextStartPage,
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
          success: true, // Mark as success since slides were created
          slidesCreated,
          slideIds,
          moduleUpdated: false, // Module update failed due to timeout
          textExtracted,
          imagesGenerated,
          totalPages,
          pagesProcessed: slidesCreated,
          partialSuccess: false,
          timeElapsed,
          warnings: ['Module update timed out, but slides were created. Please refresh the page.'],
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

  async processSinglePage(
    pageNum: number,
    totalPages: number,
    pdfDoc: PDFDocument,
    pdfText: any,
    singlePageBuffer: Buffer | undefined,
    pdfFilename: string,
    payload: any,
    moduleId: string,
  ): Promise<{ slideId: string | number; imageGenerated: boolean; wasExisting?: boolean } | null> {
    console.log(`📄 Processing page ${pageNum}/${totalPages}`)

    // Check cache first if enabled
    const cacheKey = { moduleId, pdfFilename, pageNum }
    const cachedSlide = await cacheManager.getCachedSlide(cacheKey)

    if (cachedSlide) {
      console.log(`💾 Found cached slide for page ${pageNum}`)
      return {
        slideId: cachedSlide.slideId,
        imageGenerated: cachedSlide.imageGenerated,
        wasExisting: true,
      }
    }

    // Verify module exists before creating slide
    try {
      const moduleCheck = await payload.findByID({
        collection: 'modules',
        id: String(moduleId),
        overrideAccess: true,
        depth: 0,
      })
      console.log(`🔍 Module verification:`, {
        moduleId,
        moduleExists: !!moduleCheck,
        moduleTitle: moduleCheck?.title,
      })
    } catch (moduleError) {
      console.error(`❌ Module ${moduleId} not found:`, moduleError)
      throw new Error(`Module ${moduleId} not found`)
    }

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
    let imageBuffer: Buffer | null = null

    if (this.config.enableImages && singlePageBuffer && !this.isTimingOut()) {
      console.log(`🖼️ Generating image for page ${pageNum}...`)
      const imageStartTime = Date.now()

      try {
        // Use Puppeteer-based image conversion with configured format
        // Note: singlePageBuffer contains only one page, so we always use page 1
        imageBuffer = await convertPDFPageToImage(singlePageBuffer, 1, {
          format: PDF_CONFIG.imageFormat,
          quality: PDF_CONFIG.imageQuality,
        })

        if (imageBuffer && imageBuffer.length > 0) {
          const fileExtension = PDF_CONFIG.imageFormat === 'webp' ? 'webp' : 'png'
          const imageName = `${pdfFilename.replace('.pdf', '')}_page_${pageNum}.${fileExtension}`

          // Check if CDN is configured - use S3 if available, otherwise use Payload media
          const useCDN = CDN_CONFIG.s3.bucketName && process.env.NODE_ENV === 'production'

          if (useCDN) {
            try {
              // Upload to S3 with CDN
              const uploadResult = await s3ImageUploader.uploadImage(imageBuffer, {
                moduleId: String(moduleId),
                filename: imageName,
                generateResponsive: true,
                generateThumbnails: true,
                customPath: `pdfs/${pdfFilename.replace('.pdf', '')}`,
                metadata: {
                  source: 'pdf-processor',
                  pdfFilename,
                  pageNumber: pageNum.toString(),
                  totalPages: totalPages.toString(),
                },
              })

              if (uploadResult.success) {
                // Create a minimal media record that references the CDN URL
                const mediaDoc = await payload.create({
                  collection: 'media',
                  data: {
                    alt: `Page ${pageNum} from ${pdfFilename}`,
                    filename: imageName,
                    url: uploadResult.urls.original,
                    width: uploadResult.metadata.dimensions.width,
                    height: uploadResult.metadata.dimensions.height,
                    filesize: uploadResult.metadata.size,
                    mimeType: PDF_CONFIG.imageFormat === 'webp' ? 'image/webp' : 'image/png',
                    s3Key: uploadResult.metadata.key,
                    cdnUrls: uploadResult.urls,
                  },
                  overrideAccess: true,
                  depth: 0,
                })

                imageMediaId = mediaDoc.id
                imageGenerated = true
                const imageTime = Date.now() - imageStartTime
                console.log(
                  `✅ CDN Image ${imageMediaId} uploaded in ${imageTime}ms (${(imageBuffer.length / 1024).toFixed(1)}KB) - ${uploadResult.urls.original}`,
                )
              } else {
                throw new Error(`S3 upload failed: ${uploadResult.errors?.join(', ')}`)
              }
            } catch (cdnError) {
              console.warn(`⚠️ CDN upload failed, falling back to Payload media:`, cdnError)
              // Fall through to Payload media creation
            }
          }

          // Fallback to Payload media system if CDN upload failed or is disabled
          if (!imageMediaId) {
            const mediaDoc = await payload.create({
              collection: 'media',
              data: {
                alt: `Page ${pageNum} from ${pdfFilename}`,
              },
              file: {
                data: imageBuffer,
                mimetype: PDF_CONFIG.imageFormat === 'webp' ? 'image/webp' : 'image/png',
                name: imageName,
                size: imageBuffer.length,
              },
              overrideAccess: true,
              depth: 0,
            })

            imageMediaId = mediaDoc.id
            imageGenerated = true
            const imageTime = Date.now() - imageStartTime
            console.log(
              `✅ Payload Image ${imageMediaId} generated in ${imageTime}ms (${(imageBuffer.length / 1024).toFixed(1)}KB)`,
            )
          }
        }
      } catch (imageError) {
        console.error(`❌ Image generation failed for page ${pageNum}:`, imageError)
      }
    }

    // AI Analysis for enhanced slide data (reuse the same image buffer)
    let aiAnalysis: SlideAnalysis | null = null
    if (PDF_CONFIG.enableAI && imageBuffer) {
      try {
        console.log(`🤖 Starting AI analysis for page ${pageNum}...`)
        const analyzer = new SlideAnalyzer()

        aiAnalysis = await analyzer.analyzeSlide(imageBuffer, pageNum, pdfFilename)
        console.log(`✅ AI analysis completed for page ${pageNum}`)
      } catch (aiError) {
        console.warn(`⚠️ AI analysis failed for page ${pageNum}:`, aiError)
      }
    } else if (!PDF_CONFIG.enableAI) {
      console.log(`⚠️ AI analysis disabled, skipping for page ${pageNum}`)
    }

    // Generate title and description (use AI data if available, fallback to text extraction)
    const title = aiAnalysis?.Title || this.generateTitle(pageText, pdfFilename, pageNum)
    const description = aiAnalysis?.Description || this.generateDescription(pageText, pageNum, totalPages, width, height)
    const slideType = (aiAnalysis?.Type?.toLowerCase() || this.detectSlideType(pageText)) as SlideType

    // Create properly typed slide data
    const slideData: SlideCreateData = {
      title,
      description: description || undefined,
      type: slideType,
      urls: [],
      source: {
        pdfFilename,
        pdfPage: pageNum,
        module: Number(moduleId),
      },
    }

    if (imageMediaId) {
      slideData.image = imageMediaId
    }

    // Idempotency: avoid duplicate slide for same module+pdf+page
    try {
      const existing = await payload.find({
        collection: 'slides',
        where: {
          and: [
            { 'source.module': { equals: Number(moduleId) } },
            { 'source.pdfFilename': { equals: pdfFilename } },
            { 'source.pdfPage': { equals: pageNum } },
          ],
        },
        limit: 1,
        overrideAccess: true,
        depth: 0,
      })
      if (existing.docs && existing.docs.length > 0) {
        const existingSlide = existing.docs[0] as any

        // Check if existing slide needs parent field update or image attachment
        const needsParentUpdate = !existingSlide.parent && !existingSlide.parent_id
        const needsImageUpdate =
          imageMediaId &&
          (!existingSlide.image ||
            (typeof existingSlide.image === 'object' && !existingSlide.image?.id))

        if (needsParentUpdate || needsImageUpdate) {
          try {
            const updateData: any = {}

            if (needsParentUpdate) {
              updateData.parent = Number(moduleId)
              updateData.parent_id = Number(moduleId)
              console.log(`🔗 Setting parent field on existing slide ${existingSlide.id}`)
            }

            if (needsImageUpdate) {
              updateData.image = imageMediaId
              console.log(
                `🔗 Attaching image ${imageMediaId} to existing slide ${existingSlide.id}`,
              )
            }

            await payload.update({
              collection: 'slides',
              id: String(existingSlide.id),
              data: updateData,
              overrideAccess: true,
              depth: 0,
            })

            console.log(
              `✅ Updated existing slide ${existingSlide.id} with:`,
              Object.keys(updateData),
            )
            return {
              slideId: existingSlide.id,
              imageGenerated: needsImageUpdate,
              wasExisting: true,
            }
          } catch (updateErr) {
            console.warn(`⚠️ Failed to update existing slide ${existingSlide.id}:`, updateErr)
            return { slideId: existingSlide.id, imageGenerated: false, wasExisting: true }
          }
        }

        console.log(
          `↩️ Skipping duplicate slide for page ${pageNum} (already exists: ${existingSlide.id})`,
        )
        return { slideId: existingSlide.id, imageGenerated: false, wasExisting: true }
      }
    } catch (findErr) {
      console.warn('⚠️ Duplicate-check failed, proceeding to create slide:', findErr)
    }

    // Folder functionality temporarily disabled due to compatibility issue

    // Generate a safe, unique slug to avoid validation/unique conflicts in Payload
    const rawSlugBase = (slideData.title || `${pdfFilename.replace('.pdf', '')}-page-${pageNum}`)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-') // Replace non-alphanumeric with hyphens
      .replace(/^-+|-+$/g, '')
    // Append module and page suffix to ensure uniqueness for repeated titles and across modules
    const slugSuffix = `-m${moduleId}-p${pageNum}`
    // Reserve room for suffix and trim to 50 chars total (Payload hook also limits to 50)
    const slugLimit = 50
    const baseLimit = Math.max(0, slugLimit - slugSuffix.length)
    const finalSlug = `${rawSlugBase.substring(0, baseLimit)}${slugSuffix}`.substring(0, slugLimit)

    // Debug the data being sent
    const slideCreateData = {
      ...slideData,
      slug: finalSlug,
      parent: Number(moduleId), // Set the parent relationship for nested docs (API field name)
      parent_id: Number(moduleId), // Set the parent_id for database (actual DB field name)
      source: {
        pdfFilename,
        pdfPage: pageNum,
        module: Number(moduleId),
      },
    }

    console.log(`🔍 Creating slide with data:`, {
      title: slideCreateData.title,
      parent: slideCreateData.parent,
      parent_id: slideCreateData.parent_id,
      parentType: typeof slideCreateData.parent,
      moduleId,
      moduleIdType: typeof moduleId,
      sourceModule: slideCreateData.source.module,
    })

    const slide = await payload.create({
      collection: 'slides',
      data: slideCreateData,
      overrideAccess: true,
      depth: 1, // Increase depth to see populated relationships
    })

    console.log(`✅ Slide ${slide.id} created:`, {
      id: slide.id,
      title: (slide as any).title,
      parent: (slide as any).parent,
      parentType: typeof (slide as any).parent,
      source: (slide as any).source,
    })

    // Also fetch the slide back to verify it was saved correctly
    try {
      const verifySlide = await payload.findByID({
        collection: 'slides',
        id: String(slide.id),
        depth: 1,
        overrideAccess: true,
      })
      console.log(`🔍 Verification - Slide ${slide.id} parent field:`, {
        parent: (verifySlide as any).parent,
        parentId: (verifySlide as any).parent?.id,
        parentTitle: (verifySlide as any).parent?.title,
      })
    } catch (verifyError) {
      console.error(`❌ Could not verify slide ${slide.id}:`, verifyError)
    }

    console.log(`✅ Slide ${slide.id} created for page ${pageNum}`)

    // Cache the successfully created slide
    try {
      await cacheManager.setCachedSlide(cacheKey, {
        slideId: slide.id,
        title: slideData.title,
        description: slideData.description || '',
        type: slideData.type,
        imageGenerated,
      })
      console.log(`💾 Cached slide ${slide.id} for future requests`)
    } catch (cacheError) {
      console.warn('⚠️ Failed to cache slide:', cacheError)
    }

    return {
      slideId: slide.id,
      imageGenerated,
      wasExisting: false,
    }
  }

  private createBatchesRange(startPage: number, endPage: number, batchSize: number): number[][] {
    if (endPage < startPage) return []
    const batches: number[][] = []
    for (let i = startPage; i <= endPage; i += batchSize) {
      const batch: number[] = []
      for (let j = i; j <= Math.min(i + batchSize - 1, endPage); j++) {
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

    if (
      lowerText.includes('quiz') ||
      lowerText.includes('question') ||
      lowerText.includes('answer')
    ) {
      return 'quiz'
    }

    if (
      lowerText.includes('reference') ||
      lowerText.includes('bibliography') ||
      lowerText.includes('citation') ||
      lowerText.includes('source')
    ) {
      return 'reference'
    }

    if (
      lowerText.includes('resource') ||
      lowerText.includes('link') ||
      lowerText.includes('download') ||
      lowerText.includes('material')
    ) {
      return 'resources'
    }

    if (
      lowerText.includes('video') ||
      lowerText.includes('watch') ||
      lowerText.includes('youtube') ||
      lowerText.includes('vimeo')
    ) {
      return 'video'
    }

    return 'regular'
  }
}
