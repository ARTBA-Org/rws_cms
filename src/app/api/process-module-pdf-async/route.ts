import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '../../../payload.config'
import { pdfJobQueue } from '../../../utils/pdfJobQueue'
import type { PopulatedModule } from '../../../types/pdfTypes'

export async function POST(request: NextRequest) {
  try {
    const { 
      moduleId, 
      priority = 0, 
      streaming = true,
      enableImages = true,
      startPage,
      maxPages 
    } = await request.json()
    
    if (!moduleId) {
      return NextResponse.json({ error: 'moduleId is required' }, { status: 400 })
    }

    const payload = await getPayload({ config })

    // Load module and ensure pdfUpload exists
    const mod = await payload.findByID({ 
      collection: 'modules', 
      id: String(moduleId),
      depth: 1 
    }) as PopulatedModule
    
    const pdfUpload = mod.pdfUpload
    const mediaId = typeof pdfUpload === 'object' ? pdfUpload?.id : pdfUpload
    if (!mediaId) {
      return NextResponse.json({ error: 'Module has no pdfUpload set' }, { status: 400 })
    }

    // Get the media document
    const mediaDoc = await payload.findByID({
      collection: 'media',
      id: String(mediaId),
    })
    if (!mediaDoc?.url) {
      return NextResponse.json({ error: 'Media file has no accessible URL' }, { status: 400 })
    }

    // Construct absolute URL for the job worker
    const SERVER_ORIGIN =
      process.env.PAYLOAD_PUBLIC_SERVER_URL || `http://localhost:${process.env.PORT || 3001}`
    const absoluteUrl = mediaDoc.url.startsWith('http')
      ? mediaDoc.url
      : `${SERVER_ORIGIN}${mediaDoc.url}`

    // Add job to queue
    const jobId = await pdfJobQueue.addJob(
      String(moduleId),
      absoluteUrl,
      mediaDoc.filename || 'uploaded.pdf',
      {
        priority,
        streaming,
        enableImages,
        startPage,
        maxPages,
      }
    )

    console.log(`📋 Queued PDF processing job ${jobId} for module ${moduleId}`)

    return NextResponse.json({
      success: true,
      jobId,
      moduleId: String(moduleId),
      message: 'PDF processing job queued successfully',
      estimatedProcessingTime: '2-5 minutes', // Rough estimate
      statusEndpoint: `/api/process-module-pdf-status/${jobId}`,
    })

  } catch (error: any) {
    console.error('📋 Job queue error:', error)
    return NextResponse.json({ 
      error: error?.message || 'Failed to queue PDF processing job',
      success: false 
    }, { status: 500 })
  }
}

// GET endpoint to check job status
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const jobId = url.searchParams.get('jobId')
    
    if (!jobId) {
      return NextResponse.json({ error: 'jobId parameter is required' }, { status: 400 })
    }

    const status = await pdfJobQueue.getJobStatus(jobId)
    const stats = await pdfJobQueue.getStats()

    return NextResponse.json({
      jobId,
      ...status,
      queueStats: stats,
      timestamp: Date.now(),
    })

  } catch (error: any) {
    console.error('📋 Status check error:', error)
    return NextResponse.json({ 
      error: error?.message || 'Failed to get job status' 
    }, { status: 500 })
  }
}