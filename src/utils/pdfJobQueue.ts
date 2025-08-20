import { Queue, Worker, Job } from 'bullmq'
import { getPayload } from 'payload'
import config from '../payload.config'
import { PDFProcessorOptimized } from './pdfProcessorOptimized'
import { streamProcessPDF } from './pdfStreamProcessor'
import { PDF_CONFIG } from './pdfConfig'
import { WebhookEvents } from './webhookManager'
import type { PDFProcessResult, PopulatedModule, ProcessingProgress } from '../types/pdfTypes'

// Job data types
interface PDFProcessingJobData {
  moduleId: string
  pdfUrl: string
  pdfFilename: string
  streaming?: boolean
  options?: {
    enableImages?: boolean
    startPage?: number
    maxPages?: number
  }
}

interface JobResult extends PDFProcessResult {
  jobId: string
  moduleId: string
  queuedAt: number
  startedAt: number
  completedAt: number
}

// Redis connection configuration
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB || '0', 10),
  maxRetriesPerRequest: 3,
}

// Create queue and worker instances
export class PDFJobQueue {
  private queue: Queue<PDFProcessingJobData>
  private worker: Worker<PDFProcessingJobData, JobResult> | null = null
  private progressCallbacks = new Map<string, (progress: ProcessingProgress) => void>()

  constructor() {
    // Create the queue
    this.queue = new Queue<PDFProcessingJobData>('pdf-processing', {
      connection: redisConfig,
      defaultJobOptions: {
        removeOnComplete: 10, // Keep last 10 completed jobs
        removeOnFail: 50,     // Keep last 50 failed jobs
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
    })

    console.log('📦 PDF job queue initialized')
  }

  // Add a PDF processing job to the queue
  async addJob(
    moduleId: string,
    pdfUrl: string,
    pdfFilename: string,
    options: {
      streaming?: boolean
      enableImages?: boolean
      startPage?: number
      maxPages?: number
      priority?: number
    } = {}
  ): Promise<string> {
    const { priority = 0, ...jobOptions } = options
    
    const jobData: PDFProcessingJobData = {
      moduleId,
      pdfUrl,
      pdfFilename,
      streaming: options.streaming ?? PDF_CONFIG.enableStreaming,
      options: jobOptions,
    }

    const job = await this.queue.add(`process-pdf-${moduleId}`, jobData, {
      priority,
      delay: 0,
      jobId: `pdf-${moduleId}-${Date.now()}`,
    })

    console.log(`📋 Added PDF processing job ${job.id} for module ${moduleId}`)
    return job.id!
  }

  // Start the worker to process jobs
  startWorker(): void {
    if (this.worker) {
      console.warn('⚠️ PDF worker is already running')
      return
    }

    this.worker = new Worker<PDFProcessingJobData, JobResult>(
      'pdf-processing',
      async (job: Job<PDFProcessingJobData>) => {
        return await this.processJob(job)
      },
      {
        connection: redisConfig,
        concurrency: parseInt(process.env.PDF_WORKER_CONCURRENCY || '1', 10),
        limiter: {
          max: 3, // Process max 3 jobs per minute
          duration: 60 * 1000,
        },
      }
    )

    // Worker event handlers
    this.worker.on('completed', (job, result) => {
      console.log(`✅ Job ${job.id} completed: ${result.slidesCreated} slides created`)
    })

    this.worker.on('failed', (job, err) => {
      console.error(`❌ Job ${job?.id} failed:`, err.message)
      // Note: Failure webhook is sent in processJob method for better error context
    })

    this.worker.on('progress', (job, progress) => {
      console.log(`📊 Job ${job.id} progress: ${JSON.stringify(progress)}`)
      
      // Call registered progress callback
      const callback = this.progressCallbacks.get(job.id!)
      if (callback && typeof progress === 'object') {
        callback(progress as ProcessingProgress)
      }
    })

    console.log('🔧 PDF worker started')
  }

  // Stop the worker
  async stopWorker(): Promise<void> {
    if (this.worker) {
      await this.worker.close()
      this.worker = null
      console.log('🛑 PDF worker stopped')
    }
  }

  // Register a progress callback for a specific job
  registerProgressCallback(jobId: string, callback: (progress: ProcessingProgress) => void): void {
    this.progressCallbacks.set(jobId, callback)
  }

  // Remove progress callback
  removeProgressCallback(jobId: string): void {
    this.progressCallbacks.delete(jobId)
  }

  // Get job status
  async getJobStatus(jobId: string): Promise<{
    status: string
    progress?: any
    result?: JobResult
    error?: string
  }> {
    const job = await this.queue.getJob(jobId)
    if (!job) {
      return { status: 'not_found' }
    }

    const state = await job.getState()
    return {
      status: state,
      progress: job.progress,
      result: job.returnvalue,
      error: job.failedReason,
    }
  }

  // Get queue statistics
  async getStats(): Promise<{
    waiting: number
    active: number
    completed: number
    failed: number
    delayed: number
  }> {
    return await this.queue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed')
  }

  // Cancel a job
  async cancelJob(jobId: string): Promise<boolean> {
    const job = await this.queue.getJob(jobId)
    if (job) {
      await job.remove()
      return true
    }
    return false
  }

  // Process a single job
  private async processJob(job: Job<PDFProcessingJobData>): Promise<JobResult> {
    const { moduleId, pdfUrl, pdfFilename, streaming, options = {} } = job.data
    const startedAt = Date.now()

    console.log(`🔄 Processing job ${job.id} for module ${moduleId}`)
    
    try {
      // Send processing started webhook
      await WebhookEvents.processingStarted(job.id!, moduleId, {
        pdfUrl,
        pdfFilename,
        streaming: streaming ?? false,
        options,
      })

      // Update job progress
      await job.updateProgress({ status: 'downloading', progress: 0 })

      // Fetch PDF file
      const response = await fetch(pdfUrl)
      if (!response.ok) {
        throw new Error(`Failed to fetch PDF: ${response.status} ${response.statusText}`)
      }

      const pdfBuffer = Buffer.from(await response.arrayBuffer())
      await job.updateProgress({ status: 'processing', progress: 10 })

      let result: PDFProcessResult

      if (streaming) {
        // Use streaming processing
        const payload = await getPayload({ config })
        const processor = new PDFProcessorOptimized({
          enableImages: options.enableImages ?? true,
          maxPages: 1,
        })

        result = await streamProcessPDF(
          pdfBuffer,
          async (pageBuffer: Buffer, pageNum: number, totalPages: number) => {
            // Update job progress for each page
            const progress = Math.round((pageNum / totalPages) * 80) + 10 // 10-90%
            const progressData = { 
              status: 'processing', 
              progress,
              currentPage: pageNum,
              totalPages,
            }
            await job.updateProgress(progressData)

            // Send progress webhook every 5 pages or on completion
            if (pageNum % 5 === 0 || pageNum === totalPages) {
              await WebhookEvents.processingProgress(job.id!, moduleId, {
                processedPages: pageNum,
                totalPages,
                createdSlides: pageNum, // Estimate
                currentPage: pageNum,
                status: 'processing',
              })
            }

            // Process single page
            const pdfDoc = await import('pdf-lib').then(lib => lib.PDFDocument.load(pageBuffer))
            return await processor.processSinglePage(
              pageNum,
              totalPages,
              pdfDoc,
              null,
              pageBuffer,
              pdfFilename,
              payload,
              moduleId
            )
          },
          {
            chunkSize: PDF_CONFIG.streamChunkSize,
            onProgress: async (progress) => {
              const jobProgress = Math.round((progress.processedPages / progress.totalPages) * 80) + 10
              await job.updateProgress({
                status: 'processing',
                progress: jobProgress,
                ...progress,
              })

              // Send progress webhook every 10%
              if (jobProgress % 10 === 0) {
                await WebhookEvents.processingProgress(job.id!, moduleId, {
                  processedPages: progress.processedPages,
                  totalPages: progress.totalPages,
                  createdSlides: progress.createdSlides,
                  status: 'processing',
                })
              }
            }
          }
        )
      } else {
        // Use traditional processing
        const processor = new PDFProcessorOptimized({
          enableImages: options.enableImages ?? true,
          startPage: options.startPage,
          maxPages: options.maxPages,
        })

        result = await processor.processPDFToSlides(pdfBuffer, moduleId, pdfFilename)
      }

      await job.updateProgress({ status: 'completed', progress: 100 })

      const jobResult: JobResult = {
        ...result,
        jobId: job.id!,
        moduleId,
        queuedAt: job.timestamp!,
        startedAt,
        completedAt: Date.now(),
      }

      // Send completion webhook
      await WebhookEvents.processingCompleted(job.id!, moduleId, result, {
        timeElapsed: Date.now() - startedAt,
        jobId: job.id!,
        streaming: streaming ?? false,
      })

      console.log(`✅ Job ${job.id} completed successfully`)
      return jobResult

    } catch (error) {
      console.error(`❌ Job ${job.id} failed:`, error)
      
      await job.updateProgress({ 
        status: 'failed', 
        error: (error as Error).message,
        progress: 0,
      })

      // Send failure webhook
      await WebhookEvents.processingFailed(job.id!, moduleId, (error as Error).message, {
        timeElapsed: Date.now() - startedAt,
        jobId: job.id!,
        pdfUrl,
        pdfFilename,
      })

      throw error
    } finally {
      // Cleanup progress callback
      this.removeProgressCallback(job.id!)
    }
  }

  // Cleanup method
  async cleanup(): Promise<void> {
    await this.stopWorker()
    await this.queue.close()
    this.progressCallbacks.clear()
    console.log('🧹 PDF job queue cleanup completed')
  }
}

// Export singleton instance
export const pdfJobQueue = new PDFJobQueue()

// Auto-start worker if in production or if explicitly enabled
if (process.env.NODE_ENV === 'production' || process.env.PDF_AUTO_START_WORKER === 'true') {
  pdfJobQueue.startWorker()
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🔄 Shutting down PDF job queue...')
  await pdfJobQueue.cleanup()
  process.exit(0)
})

process.on('SIGINT', async () => {
  console.log('🔄 Shutting down PDF job queue...')
  await pdfJobQueue.cleanup()
  process.exit(0)
})