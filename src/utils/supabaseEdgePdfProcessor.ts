/**
 * Supabase Edge Function PDF Processor
 * A more scalable alternative to the current PDF processing system
 */

import { PDFProcessResult } from '../types/pdfTypes'

interface SupabaseEdgePDFOptions {
  startPage?: number
  maxPages?: number
  enableImages?: boolean
  enableAI?: boolean
  imageFormat?: 'png' | 'webp'
  imageQuality?: number
}

interface SupabaseEdgePDFRequest {
  moduleId: string
  pdfBuffer?: ArrayBuffer
  pdfUrl?: string
  options?: SupabaseEdgePDFOptions
}

export class SupabaseEdgePDFProcessor {
  private edgeFunctionUrl: string
  private config: {
    timeout: number
    retryAttempts: number
  }

  constructor(options: {
    supabaseUrl?: string
    supabaseAnonKey?: string
    timeout?: number
    retryAttempts?: number
  } = {}) {
    const supabaseUrl = options.supabaseUrl || process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321'
    this.edgeFunctionUrl = `${supabaseUrl}/functions/v1/process-pdf`
    
    this.config = {
      timeout: options.timeout || 120000, // 2 minutes
      retryAttempts: options.retryAttempts || 2,
    }

    console.log('🚀 SupabaseEdgePDFProcessor initialized')
    console.log('📡 Edge Function URL:', this.edgeFunctionUrl)
  }

  /**
   * Process PDF using Supabase Edge Function
   */
  async processPDFToSlides(
    pdfBuffer: Buffer,
    moduleId: string,
    pdfFilename: string,
    options: SupabaseEdgePDFOptions = {}
  ): Promise<PDFProcessResult> {
    console.log('📋 Starting Supabase Edge Function PDF processing...')
    console.log('⚙️ Configuration:', {
      moduleId,
      pdfFilename,
      bufferSize: pdfBuffer.length,
      options,
    })

    const startTime = Date.now()

    try {
      const request: SupabaseEdgePDFRequest = {
        moduleId,
        pdfBuffer: pdfBuffer.buffer.slice(pdfBuffer.byteOffset, pdfBuffer.byteOffset + pdfBuffer.byteLength),
        options: {
          startPage: 1,
          maxPages: 25,
          enableImages: true,
          enableAI: !!process.env.OPENAI_API_KEY,
          imageFormat: 'png',
          imageQuality: 90,
          ...options,
        },
      }

      console.log('📤 Sending request to Edge Function...')
      
      const result = await this.makeRequestWithRetry(request)
      
      const timeElapsed = Date.now() - startTime
      console.log(`⏱️ Total processing time: ${timeElapsed}ms`)

      if (result.success) {
        console.log(`✅ Successfully processed PDF: ${result.slidesCreated} slides created`)
        return {
          success: true,
          slidesCreated: result.slidesCreated || 0,
          slideIds: result.slideIds || [],
          moduleUpdated: true,
          textExtracted: true,
          imagesGenerated: !!options.enableImages,
          totalPages: result.totalPages || 0,
          pagesProcessed: result.pagesProcessed || 0,
          partialSuccess: false,
          timeElapsed,
          startPage: options.startPage || 1,
          nextStartPage: null, // Edge function processes all requested pages at once
        }
      } else {
        throw new Error(result.error || 'PDF processing failed')
      }

    } catch (error) {
      console.error('❌ Supabase Edge Function PDF processing failed:', error)
      
      const timeElapsed = Date.now() - startTime
      return {
        success: false,
        slidesCreated: 0,
        slideIds: [],
        moduleUpdated: false,
        textExtracted: false,
        imagesGenerated: false,
        totalPages: 0,
        pagesProcessed: 0,
        partialSuccess: false,
        timeElapsed,
        startPage: options.startPage || 1,
        nextStartPage: null,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Process PDF from URL using Supabase Edge Function
   */
  async processPDFFromURL(
    pdfUrl: string,
    moduleId: string,
    pdfFilename: string,
    options: SupabaseEdgePDFOptions = {}
  ): Promise<PDFProcessResult> {
    console.log('📋 Starting Supabase Edge Function PDF processing from URL...')
    console.log('📡 PDF URL:', pdfUrl)

    const startTime = Date.now()

    try {
      const request: SupabaseEdgePDFRequest = {
        moduleId,
        pdfUrl,
        options: {
          startPage: 1,
          maxPages: 25,
          enableImages: true,
          enableAI: !!process.env.OPENAI_API_KEY,
          imageFormat: 'png',
          imageQuality: 90,
          ...options,
        },
      }

      console.log('📤 Sending URL request to Edge Function...')
      
      const result = await this.makeRequestWithRetry(request)
      
      const timeElapsed = Date.now() - startTime
      console.log(`⏱️ Total processing time: ${timeElapsed}ms`)

      if (result.success) {
        console.log(`✅ Successfully processed PDF from URL: ${result.slidesCreated} slides created`)
        return {
          success: true,
          slidesCreated: result.slidesCreated || 0,
          slideIds: result.slideIds || [],
          moduleUpdated: true,
          textExtracted: true,
          imagesGenerated: !!options.enableImages,
          totalPages: result.totalPages || 0,
          pagesProcessed: result.pagesProcessed || 0,
          partialSuccess: false,
          timeElapsed,
          startPage: options.startPage || 1,
          nextStartPage: null,
        }
      } else {
        throw new Error(result.error || 'PDF processing failed')
      }

    } catch (error) {
      console.error('❌ Supabase Edge Function PDF processing from URL failed:', error)
      
      const timeElapsed = Date.now() - startTime
      return {
        success: false,
        slidesCreated: 0,
        slideIds: [],
        moduleUpdated: false,
        textExtracted: false,
        imagesGenerated: false,
        totalPages: 0,
        pagesProcessed: 0,
        partialSuccess: false,
        timeElapsed,
        startPage: options.startPage || 1,
        nextStartPage: null,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Make request to Edge Function with retry logic
   */
  private async makeRequestWithRetry(request: SupabaseEdgePDFRequest): Promise<any> {
    let lastError: Error | null = null

    for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
      try {
        console.log(`🔄 Attempt ${attempt}/${this.config.retryAttempts}`)

        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), this.config.timeout)

        const response = await fetch(this.edgeFunctionUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''}`,
          },
          body: JSON.stringify(request),
          signal: controller.signal,
        })

        clearTimeout(timeoutId)

        if (!response.ok) {
          const errorText = await response.text()
          throw new Error(`HTTP ${response.status}: ${errorText}`)
        }

        const result = await response.json()
        console.log(`✅ Request successful on attempt ${attempt}`)
        return result

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
        console.warn(`⚠️ Attempt ${attempt} failed:`, lastError.message)

        if (attempt < this.config.retryAttempts) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000) // Exponential backoff, max 5s
          console.log(`⏳ Retrying in ${delay}ms...`)
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }
    }

    throw lastError || new Error('All retry attempts failed')
  }

  /**
   * Health check for the Edge Function
   */
  async healthCheck(): Promise<{ healthy: boolean; latency?: number; error?: string }> {
    const startTime = Date.now()

    try {
      const response = await fetch(this.edgeFunctionUrl, {
        method: 'OPTIONS',
        headers: {
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''}`,
        },
      })

      const latency = Date.now() - startTime

      if (response.ok) {
        return { healthy: true, latency }
      } else {
        return { 
          healthy: false, 
          latency, 
          error: `HTTP ${response.status}: ${response.statusText}` 
        }
      }

    } catch (error) {
      const latency = Date.now() - startTime
      return { 
        healthy: false, 
        latency, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    }
  }
}

// Export a default instance
export const supabaseEdgePDFProcessor = new SupabaseEdgePDFProcessor()

// Export for easy testing
export function createSupabaseEdgePDFProcessor(options?: {
  supabaseUrl?: string
  supabaseAnonKey?: string
  timeout?: number
  retryAttempts?: number
}) {
  return new SupabaseEdgePDFProcessor(options)
}
