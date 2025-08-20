import { NextRequest, NextResponse } from 'next/server'
import { WebhookEvents } from '../../../../../utils/webhookManager'

// POST - Send a test webhook notification
export async function POST(request: NextRequest) {
  try {
    const { 
      event = 'pdf.processing.completed',
      jobId = `test-${Date.now()}`,
      moduleId = 'test-module',
      includeResult = true 
    } = await request.json()

    console.log(`📡 Sending test webhook: ${event}`)

    switch (event) {
      case 'pdf.processing.started':
        await WebhookEvents.processingStarted(jobId, moduleId, { 
          test: true, 
          timestamp: Date.now() 
        })
        break

      case 'pdf.processing.progress':
        await WebhookEvents.processingProgress(jobId, moduleId, {
          processedPages: 5,
          totalPages: 10,
          createdSlides: 3,
          currentPage: 5,
          status: 'processing'
        }, { test: true })
        break

      case 'pdf.processing.completed':
        const mockResult = {
          success: true,
          slidesCreated: 8,
          slideIds: [1, 2, 3, 4, 5, 6, 7, 8],
          moduleUpdated: true,
          textExtracted: true,
          imagesGenerated: true,
          totalPages: 10,
          pagesProcessed: 10,
          partialSuccess: false,
          timeElapsed: 45000,
          startPage: 1,
          nextStartPage: null,
        }

        await WebhookEvents.processingCompleted(
          jobId, 
          moduleId, 
          includeResult ? mockResult : {} as any,
          { test: true }
        )
        break

      case 'pdf.processing.failed':
        await WebhookEvents.processingFailed(jobId, moduleId, 'Test error message', { 
          test: true 
        })
        break

      default:
        return NextResponse.json({ 
          error: 'Invalid event type. Use: started, progress, completed, or failed' 
        }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      message: `Test webhook sent for event: ${event}`,
      event,
      jobId,
      moduleId,
      timestamp: Date.now(),
    })

  } catch (error: any) {
    console.error('📡 Test webhook error:', error)
    return NextResponse.json({ 
      error: error?.message || 'Failed to send test webhook' 
    }, { status: 500 })
  }
}