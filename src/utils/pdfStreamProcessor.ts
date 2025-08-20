import { PDFDocument } from 'pdf-lib'
import { Readable } from 'stream'
import { PDF_CONFIG } from './pdfConfig'
import type { PDFProcessResult, ProcessingProgress, ProcessingStatus } from '../types/pdfTypes'

interface StreamProcessorOptions {
  chunkSize?: number; // Number of pages to process in each chunk
  onProgress?: (progress: ProcessingProgress) => void;
  signal?: AbortSignal; // For cancellation support
}

export class PDFStreamProcessor {
  private aborted = false
  private startTime = 0

  async *processPages(
    pdfBuffer: Buffer, 
    options: StreamProcessorOptions = {}
  ): AsyncGenerator<{ 
    pageBuffer: Buffer; 
    pageNum: number; 
    totalPages: number;
    progress: ProcessingProgress 
  }> {
    const { chunkSize = 1, onProgress, signal } = options
    this.startTime = Date.now()

    // Handle abort signal
    if (signal) {
      signal.addEventListener('abort', () => {
        this.aborted = true
      })
    }

    console.log('📖 Loading PDF document for streaming...')
    const pdfDoc = await PDFDocument.load(pdfBuffer)
    const totalPages = pdfDoc.getPageCount()

    console.log(`📊 Starting streaming processing of ${totalPages} pages in chunks of ${chunkSize}`)

    let processedPages = 0
    
    // Process pages in chunks
    for (let startPage = 1; startPage <= totalPages; startPage += chunkSize) {
      if (this.aborted) {
        console.log('🛑 PDF streaming processing aborted')
        break
      }

      const endPage = Math.min(startPage + chunkSize - 1, totalPages)
      console.log(`📦 Processing chunk: pages ${startPage}-${endPage}`)

      // Create page buffers for this chunk
      for (let pageNum = startPage; pageNum <= endPage; pageNum++) {
        if (this.aborted) break

        try {
          // Extract single page as separate PDF
          const singlePageDoc = await PDFDocument.create()
          const [copiedPage] = await singlePageDoc.copyPages(pdfDoc, [pageNum - 1])
          singlePageDoc.addPage(copiedPage)
          
          // Convert to buffer
          const pageBuffer = Buffer.from(await singlePageDoc.save())
          processedPages++

          // Calculate progress
          const progress: ProcessingProgress = {
            status: processedPages === totalPages ? 'completed' : 'processing',
            totalPages,
            processedPages,
            createdSlides: 0, // This will be updated by the consumer
            currentPage: pageNum,
            startTime: this.startTime,
            estimatedTimeRemaining: this.calculateETA(processedPages, totalPages),
          }

          // Notify progress callback
          if (onProgress) {
            onProgress(progress)
          }

          // Yield the processed page
          yield {
            pageBuffer,
            pageNum,
            totalPages,
            progress,
          }

          // Give other operations a chance to run
          await this.yield()

        } catch (error) {
          console.error(`❌ Error processing page ${pageNum}:`, error)
          
          const progress: ProcessingProgress = {
            status: 'failed',
            totalPages,
            processedPages,
            createdSlides: 0,
            currentPage: pageNum,
            startTime: this.startTime,
            errors: [(error as Error).message],
          }

          if (onProgress) {
            onProgress(progress)
          }

          // Continue with next page instead of failing completely
          continue
        }
      }

      // Optional: Add delay between chunks to prevent overwhelming the system
      if (endPage < totalPages && !this.aborted) {
        await new Promise(resolve => setTimeout(resolve, 10))
      }
    }

    console.log(`✅ Finished streaming ${processedPages}/${totalPages} pages`)
  }

  // Convert buffer stream to readable stream for HTTP responses
  static bufferToStream(buffer: Buffer): Readable {
    const readable = new Readable()
    readable.push(buffer)
    readable.push(null) // End of stream
    return readable
  }

  // Create a progress tracking stream
  static createProgressStream(
    onProgress: (progress: ProcessingProgress) => void
  ): Readable {
    return new Readable({
      objectMode: true,
      read() {
        // This will be written to by the progress callback
      }
    })
  }

  private async yield(): Promise<void> {
    return new Promise(resolve => setImmediate(resolve))
  }

  private calculateETA(processed: number, total: number): number | undefined {
    if (processed === 0) return undefined
    
    const elapsed = Date.now() - this.startTime
    const avgTimePerPage = elapsed / processed
    const remaining = total - processed
    
    return Math.round(avgTimePerPage * remaining)
  }

  abort(): void {
    this.aborted = true
  }
}

// Helper function to process PDF in streaming mode
export async function streamProcessPDF(
  pdfBuffer: Buffer,
  processor: (pageBuffer: Buffer, pageNum: number, totalPages: number) => Promise<any>,
  options: StreamProcessorOptions = {}
): Promise<PDFProcessResult> {
  const streamProcessor = new PDFStreamProcessor()
  const results: any[] = []
  const errors: string[] = []
  const warnings: string[] = []
  let slidesCreated = 0

  try {
    console.log('🌊 Starting streaming PDF processing...')
    
    for await (const { pageBuffer, pageNum, totalPages, progress } of streamProcessor.processPages(pdfBuffer, options)) {
      try {
        console.log(`🌊 Processing page ${pageNum}/${totalPages} via stream...`)
        
        const result = await processor(pageBuffer, pageNum, totalPages)
        
        if (result) {
          results.push(result)
          if (!result.wasExisting) {
            slidesCreated++
          }
        }
        
        // Update progress with actual slide creation count
        if (options.onProgress) {
          options.onProgress({
            ...progress,
            createdSlides: slidesCreated,
          })
        }
        
      } catch (processingError) {
        const errorMsg = `Page ${pageNum}: ${(processingError as Error).message}`
        errors.push(errorMsg)
        console.error(`❌ Stream processing error for page ${pageNum}:`, processingError)
        
        // Continue processing other pages
        continue
      }
    }

    console.log(`✅ Streaming processing completed: ${slidesCreated} slides created`)

    return {
      success: true,
      slidesCreated,
      slideIds: results.map(r => r.slideId).filter(Boolean),
      moduleUpdated: results.length > 0,
      textExtracted: true, // Assume text was extracted
      imagesGenerated: results.some(r => r.imageGenerated),
      totalPages: results.length > 0 ? results[0].totalPages || 0 : 0,
      pagesProcessed: results.length,
      partialSuccess: errors.length > 0,
      timeElapsed: Date.now() - streamProcessor.startTime,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
    }

  } catch (error) {
    console.error('💥 Streaming PDF processing failed:', error)
    
    return {
      success: false,
      slidesCreated,
      errors: [error instanceof Error ? error.message : 'Unknown streaming error'],
      timeElapsed: Date.now() - streamProcessor.startTime,
      totalPages: 0,
      pagesProcessed: results.length,
    }
  }
}