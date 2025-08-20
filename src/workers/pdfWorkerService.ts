#!/usr/bin/env node

/**
 * Standalone PDF Processing Worker Service
 * 
 * This service can be deployed as:
 * - A separate Node.js process
 * - AWS Lambda function
 * - Docker container
 * - Kubernetes job
 * 
 * Usage:
 *   node dist/workers/pdfWorkerService.js
 *   npm run worker:pdf
 */

import { Worker, Job } from 'bullmq'
import { getPayload } from 'payload'
import config from '../payload.config'
import { PDFProcessorOptimized } from '../utils/pdfProcessorOptimized'
import { streamProcessPDF } from '../utils/pdfStreamProcessor'
import { browserPool } from '../utils/browserPool'
import { PDF_CONFIG } from '../utils/pdfConfig'
import type { PDFProcessResult, ProcessingProgress } from '../types/pdfTypes'

// Environment configuration
const WORKER_CONFIG = {
  concurrency: parseInt(process.env.PDF_WORKER_CONCURRENCY || '2', 10),
  maxJobs: parseInt(process.env.PDF_WORKER_MAX_JOBS || '100', 10),
  stalledInterval: parseInt(process.env.PDF_WORKER_STALLED_INTERVAL || '30000', 10),
  maxStalledCount: parseInt(process.env.PDF_WORKER_MAX_STALLED_COUNT || '3', 10),
  webhookUrl: process.env.PDF_WEBHOOK_URL,
  workerName: process.env.PDF_WORKER_NAME || `pdf-worker-${process.pid}`,
}

// Redis connection
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB || '0', 10),
  maxRetriesPerRequest: 3,
  lazyConnect: true,
}

// Job data interface
interface PDFJobData {
  moduleId: string
  pdfUrl: string
  pdfFilename: string
  streaming?: boolean
  options?: {
    enableImages?: boolean
    startPage?: number
    maxPages?: number
  }
  webhookUrl?: string
  metadata?: Record<string, any>
}

interface JobResult extends PDFProcessResult {
  jobId: string
  moduleId: string
  workerName: string
  queuedAt: number
  startedAt: number
  completedAt: number
  processingTime: number
}

class PDFWorkerService {
  private worker: Worker<PDFJobData, JobResult> | null = null
  private isShuttingDown = false
  private activeJobs = new Set<string>()

  constructor() {
    this.setupSignalHandlers()
  }

  async start(): Promise<void> {
    console.log('🚀 Starting PDF Worker Service...')
    console.log('📋 Configuration:', {
      concurrency: WORKER_CONFIG.concurrency,
      maxJobs: WORKER_CONFIG.maxJobs,
      workerName: WORKER_CONFIG.workerName,
      redis: `${redisConfig.host}:${redisConfig.port}`,
    })

    try {
      // Initialize browser pool
      console.log('🌐 Initializing browser pool...')
      
      // Create worker
      this.worker = new Worker<PDFJobData, JobResult>(
        'pdf-processing',
        this.processJob.bind(this),
        {
          connection: redisConfig,
          concurrency: WORKER_CONFIG.concurrency,
          stalledInterval: WORKER_CONFIG.stalledInterval,
          maxStalledCount: WORKER_CONFIG.maxStalledCount,
          limiter: {
            max: 10, // Process max 10 jobs per minute
            duration: 60 * 1000,
          },
        }
      )

      // Event handlers
      this.worker.on('ready', () => {
        console.log('✅ PDF Worker is ready and waiting for jobs')
      })

      this.worker.on('completed', async (job, result) => {
        this.activeJobs.delete(job.id!)
        console.log(`✅ Job ${job.id} completed in ${result.processingTime}ms: ${result.slidesCreated} slides created`)
        
        // Send webhook notification
        await this.sendWebhookNotification(job, result, 'completed')
      })

      this.worker.on('failed', async (job, err) => {
        this.activeJobs.delete(job?.id!)
        console.error(`❌ Job ${job?.id} failed:`, err.message)
        
        // Send webhook notification
        if (job) {
          await this.sendWebhookNotification(job, null, 'failed', err.message)
        }
      })

      this.worker.on('progress', (job, progress) => {
        console.log(`📊 Job ${job.id} progress:`, progress)
      })

      this.worker.on('stalled', (jobId) => {
        console.warn(`⏱️ Job ${jobId} stalled, will be retried`)
      })

      this.worker.on('error', (err) => {
        console.error('💥 Worker error:', err)
      })

      console.log('✅ PDF Worker Service started successfully')

    } catch (error) {
      console.error('💥 Failed to start PDF Worker Service:', error)
      process.exit(1)
    }
  }

  private async processJob(job: Job<PDFJobData>): Promise<JobResult> {
    const startedAt = Date.now()
    this.activeJobs.add(job.id!)
    
    const { moduleId, pdfUrl, pdfFilename, streaming, options = {}, webhookUrl } = job.data
    
    console.log(`🔄 Processing job ${job.id} for module ${moduleId}`)
    console.log(`📄 PDF: ${pdfFilename}, Streaming: ${streaming}`)

    try {
      // Update progress
      await job.updateProgress({
        status: 'started',
        progress: 0,
        startedAt,
        workerName: WORKER_CONFIG.workerName,
      })

      // Fetch PDF
      await job.updateProgress({ status: 'downloading', progress: 5 })
      
      const response = await fetch(pdfUrl, {
        timeout: 30000, // 30 second timeout
        headers: {
          'User-Agent': 'PDF-Worker-Service/1.0',
        }
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch PDF: ${response.status} ${response.statusText}`)
      }

      const pdfBuffer = Buffer.from(await response.arrayBuffer())
      console.log(`📥 Downloaded PDF: ${(pdfBuffer.length / 1024 / 1024).toFixed(2)}MB`)

      await job.updateProgress({ status: 'processing', progress: 10 })

      let result: PDFProcessResult

      if (streaming) {
        result = await this.processStreamingPDF(job, pdfBuffer, moduleId, pdfFilename, options)
      } else {
        result = await this.processTraditionalPDF(job, pdfBuffer, moduleId, pdfFilename, options)
      }

      await job.updateProgress({ status: 'finalizing', progress: 95 })

      const completedAt = Date.now()
      const processingTime = completedAt - startedAt

      const jobResult: JobResult = {
        ...result,
        jobId: job.id!,
        moduleId,
        workerName: WORKER_CONFIG.workerName,
        queuedAt: job.timestamp!,
        startedAt,
        completedAt,
        processingTime,
      }

      await job.updateProgress({ status: 'completed', progress: 100 })
      console.log(`✅ Job ${job.id} completed successfully in ${processingTime}ms`)
      
      return jobResult

    } catch (error) {
      console.error(`❌ Job ${job.id} failed:`, error)
      
      await job.updateProgress({
        status: 'failed',
        error: (error as Error).message,
        progress: 0,
        failedAt: Date.now(),
      })

      throw error
    }
  }

  private async processStreamingPDF(
    job: Job<PDFJobData>, 
    pdfBuffer: Buffer, 
    moduleId: string, 
    pdfFilename: string,
    options: any
  ): Promise<PDFProcessResult> {
    console.log(`🌊 Using streaming processing for job ${job.id}`)
    
    const payload = await getPayload({ config })
    const processor = new PDFProcessorOptimized({
      enableImages: options.enableImages ?? true,
      maxPages: 1,
    })

    return await streamProcessPDF(
      pdfBuffer,
      async (pageBuffer: Buffer, pageNum: number, totalPages: number) => {
        // Update job progress
        const progress = Math.round((pageNum / totalPages) * 80) + 10 // 10-90%
        await job.updateProgress({
          status: 'processing',
          progress,
          currentPage: pageNum,
          totalPages,
        })

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
            processedPages: progress.processedPages,
            totalPages: progress.totalPages,
            createdSlides: progress.createdSlides,
          })
        }
      }
    )
  }

  private async processTraditionalPDF(
    job: Job<PDFJobData>, 
    pdfBuffer: Buffer, 
    moduleId: string, 
    pdfFilename: string,
    options: any
  ): Promise<PDFProcessResult> {
    console.log(`📄 Using traditional processing for job ${job.id}`)
    
    const processor = new PDFProcessorOptimized({
      enableImages: options.enableImages ?? true,
      startPage: options.startPage,
      maxPages: options.maxPages,
    })

    return await processor.processPDFToSlides(pdfBuffer, moduleId, pdfFilename)
  }

  private async sendWebhookNotification(
    job: Job<PDFJobData>, 
    result: JobResult | null, 
    status: 'completed' | 'failed',
    error?: string
  ): Promise<void> {
    const webhookUrl = job.data.webhookUrl || WORKER_CONFIG.webhookUrl
    if (!webhookUrl) return

    try {
      const payload = {
        jobId: job.id,
        moduleId: job.data.moduleId,
        status,
        timestamp: Date.now(),
        workerName: WORKER_CONFIG.workerName,
        ...(result && { result }),
        ...(error && { error }),
        metadata: job.data.metadata,
      }

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'PDF-Worker-Service/1.0',
        },
        body: JSON.stringify(payload),
        timeout: 10000, // 10 second timeout
      })

      if (response.ok) {
        console.log(`📡 Webhook sent successfully for job ${job.id}`)
      } else {
        console.warn(`⚠️ Webhook failed for job ${job.id}: ${response.status}`)
      }

    } catch (webhookError) {
      console.warn(`⚠️ Webhook error for job ${job.id}:`, webhookError)
    }
  }

  private setupSignalHandlers(): void {
    const signals: NodeJS.Signals[] = ['SIGTERM', 'SIGINT', 'SIGUSR2']
    
    signals.forEach(signal => {
      process.on(signal, () => {
        console.log(`📡 Received ${signal}, starting graceful shutdown...`)
        this.gracefulShutdown()
      })
    })
  }

  private async gracefulShutdown(): Promise<void> {
    if (this.isShuttingDown) return
    this.isShuttingDown = true

    console.log('🔄 Initiating graceful shutdown...')
    console.log(`📊 Active jobs: ${this.activeJobs.size}`)

    // Stop accepting new jobs
    if (this.worker) {
      console.log('🛑 Closing worker...')
      await this.worker.close()
    }

    // Wait for active jobs to complete (with timeout)
    const shutdownTimeout = parseInt(process.env.PDF_WORKER_SHUTDOWN_TIMEOUT || '30000', 10)
    let waitTime = 0
    const checkInterval = 1000

    while (this.activeJobs.size > 0 && waitTime < shutdownTimeout) {
      console.log(`⏳ Waiting for ${this.activeJobs.size} active jobs to complete...`)
      await new Promise(resolve => setTimeout(resolve, checkInterval))
      waitTime += checkInterval
    }

    // Cleanup resources
    try {
      await browserPool.shutdown()
      console.log('🧹 Resources cleaned up')
    } catch (cleanupError) {
      console.error('⚠️ Cleanup error:', cleanupError)
    }

    console.log('✅ Graceful shutdown completed')
    process.exit(0)
  }

  async getStats(): Promise<{
    workerName: string
    activeJobs: number
    pid: number
    uptime: number
    memoryUsage: NodeJS.MemoryUsage
    config: typeof WORKER_CONFIG
  }> {
    return {
      workerName: WORKER_CONFIG.workerName,
      activeJobs: this.activeJobs.size,
      pid: process.pid,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      config: WORKER_CONFIG,
    }
  }
}

// Start the worker if this file is run directly
if (require.main === module) {
  const worker = new PDFWorkerService()
  
  worker.start().catch(error => {
    console.error('💥 Failed to start worker:', error)
    process.exit(1)
  })

  // Export for programmatic usage
  global.pdfWorker = worker
}

export { PDFWorkerService }