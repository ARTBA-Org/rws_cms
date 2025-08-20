import { withRetry } from './retryUtils'
import type { PDFProcessResult } from '../types/pdfTypes'

export interface WebhookPayload {
  event: 'pdf.processing.started' | 'pdf.processing.progress' | 'pdf.processing.completed' | 'pdf.processing.failed'
  jobId: string
  moduleId: string
  timestamp: number
  data: {
    result?: PDFProcessResult
    progress?: {
      processedPages: number
      totalPages: number
      createdSlides: number
      currentPage?: number
      status: string
    }
    error?: string
    metadata?: Record<string, any>
  }
  signature?: string // For webhook verification
}

export interface WebhookConfig {
  url: string
  secret?: string // For HMAC signature verification
  timeout?: number
  retries?: number
  headers?: Record<string, string>
}

export class WebhookManager {
  private static instance: WebhookManager
  private webhooks = new Map<string, WebhookConfig>()

  static getInstance(): WebhookManager {
    if (!WebhookManager.instance) {
      WebhookManager.instance = new WebhookManager()
    }
    return WebhookManager.instance
  }

  // Register a webhook for a specific module or global
  registerWebhook(key: string, config: WebhookConfig): void {
    this.webhooks.set(key, {
      timeout: 10000, // 10 seconds default
      retries: 3,
      ...config,
    })
    console.log(`📡 Registered webhook for ${key}: ${config.url}`)
  }

  // Remove a webhook
  unregisterWebhook(key: string): void {
    this.webhooks.delete(key)
    console.log(`📡 Unregistered webhook for ${key}`)
  }

  // Send webhook notification
  async sendNotification(
    event: WebhookPayload['event'],
    jobId: string,
    moduleId: string,
    data: WebhookPayload['data'],
    metadata?: Record<string, any>
  ): Promise<void> {
    const payload: WebhookPayload = {
      event,
      jobId,
      moduleId,
      timestamp: Date.now(),
      data: {
        ...data,
        metadata,
      },
    }

    // Send to module-specific webhook
    const moduleWebhook = this.webhooks.get(`module:${moduleId}`)
    if (moduleWebhook) {
      await this.sendWebhook(moduleWebhook, payload)
    }

    // Send to global webhook
    const globalWebhook = this.webhooks.get('global')
    if (globalWebhook) {
      await this.sendWebhook(globalWebhook, payload)
    }

    // Send to environment-configured webhook
    const envWebhookUrl = process.env.PDF_WEBHOOK_URL
    if (envWebhookUrl) {
      const envWebhook: WebhookConfig = {
        url: envWebhookUrl,
        secret: process.env.PDF_WEBHOOK_SECRET,
        timeout: parseInt(process.env.PDF_WEBHOOK_TIMEOUT || '10000', 10),
        retries: parseInt(process.env.PDF_WEBHOOK_RETRIES || '3', 10),
      }
      await this.sendWebhook(envWebhook, payload)
    }
  }

  private async sendWebhook(config: WebhookConfig, payload: WebhookPayload): Promise<void> {
    try {
      // Add signature if secret is provided
      if (config.secret) {
        payload.signature = this.generateSignature(JSON.stringify(payload), config.secret)
      }

      const response = await withRetry(
        async () => {
          const fetchResponse = await fetch(config.url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'User-Agent': 'PDF-Processing-Webhook/1.0',
              ...(config.headers || {}),
            },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(config.timeout || 10000),
          })

          if (!fetchResponse.ok) {
            throw new Error(`Webhook failed: ${fetchResponse.status} ${fetchResponse.statusText}`)
          }

          return fetchResponse
        },
        {
          maxRetries: config.retries || 3,
          baseDelayMs: 1000,
          backoffFactor: 2,
          retryCondition: (error) => {
            // Retry on network errors and 5xx status codes
            return error.message.includes('fetch') || 
                   error.message.includes('timeout') ||
                   error.message.includes('5')
          },
        }
      )

      console.log(`📡 Webhook sent successfully to ${config.url} for event ${payload.event}`)

    } catch (error) {
      console.error(`📡 Webhook failed for ${config.url}:`, error)
      
      // Optionally store failed webhook for retry later
      await this.handleWebhookFailure(config, payload, error as Error)
    }
  }

  private generateSignature(payload: string, secret: string): string {
    // HMAC-SHA256 signature for webhook verification
    const crypto = require('crypto')
    const hmac = crypto.createHmac('sha256', secret)
    hmac.update(payload)
    return `sha256=${hmac.digest('hex')}`
  }

  private async handleWebhookFailure(
    config: WebhookConfig, 
    payload: WebhookPayload, 
    error: Error
  ): Promise<void> {
    // Store failed webhook for later retry (could use a dead letter queue)
    console.error(`📡 Webhook failure logged:`, {
      url: config.url,
      event: payload.event,
      jobId: payload.jobId,
      error: error.message,
      timestamp: Date.now(),
    })

    // TODO: Implement dead letter queue for failed webhooks
    // This could integrate with your existing job queue system
  }

  // Verify webhook signature (for incoming webhooks)
  verifySignature(payload: string, signature: string, secret: string): boolean {
    const expectedSignature = this.generateSignature(payload, secret)
    return signature === expectedSignature
  }

  // Get webhook statistics
  getStats(): {
    registeredWebhooks: number
    webhooks: Array<{ key: string; url: string }>
  } {
    return {
      registeredWebhooks: this.webhooks.size,
      webhooks: Array.from(this.webhooks.entries()).map(([key, config]) => ({
        key,
        url: config.url,
      })),
    }
  }
}

// Webhook event helpers
export class WebhookEvents {
  private static webhookManager = WebhookManager.getInstance()

  static async processingStarted(jobId: string, moduleId: string, metadata?: Record<string, any>): Promise<void> {
    await this.webhookManager.sendNotification(
      'pdf.processing.started',
      jobId,
      moduleId,
      {},
      metadata
    )
  }

  static async processingProgress(
    jobId: string, 
    moduleId: string, 
    progress: {
      processedPages: number
      totalPages: number
      createdSlides: number
      currentPage?: number
      status: string
    },
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.webhookManager.sendNotification(
      'pdf.processing.progress',
      jobId,
      moduleId,
      { progress },
      metadata
    )
  }

  static async processingCompleted(
    jobId: string, 
    moduleId: string, 
    result: PDFProcessResult,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.webhookManager.sendNotification(
      'pdf.processing.completed',
      jobId,
      moduleId,
      { result },
      metadata
    )
  }

  static async processingFailed(
    jobId: string, 
    moduleId: string, 
    error: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.webhookManager.sendNotification(
      'pdf.processing.failed',
      jobId,
      moduleId,
      { error },
      metadata
    )
  }
}

// Export singleton instance
export const webhookManager = WebhookManager.getInstance()