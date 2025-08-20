import { NextRequest, NextResponse } from 'next/server'
import { pdfJobQueue } from '../../../../utils/pdfJobQueue'

export async function GET(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const { jobId } = params

    if (!jobId) {
      return NextResponse.json({ error: 'jobId is required' }, { status: 400 })
    }

    const status = await pdfJobQueue.getJobStatus(jobId)
    
    if (status.status === 'not_found') {
      return NextResponse.json({ 
        error: 'Job not found',
        jobId 
      }, { status: 404 })
    }

    // Add helpful status descriptions
    const statusDescriptions: Record<string, string> = {
      'waiting': 'Job is waiting in queue',
      'active': 'Job is currently being processed',
      'completed': 'Job completed successfully',
      'failed': 'Job failed to process',
      'delayed': 'Job is delayed',
      'paused': 'Job is paused',
    }

    return NextResponse.json({
      jobId,
      status: status.status,
      statusDescription: statusDescriptions[status.status] || 'Unknown status',
      progress: status.progress,
      result: status.result,
      error: status.error,
      timestamp: Date.now(),
    })

  } catch (error: any) {
    console.error(`📋 Status check error for job ${params.jobId}:`, error)
    return NextResponse.json({ 
      error: error?.message || 'Failed to get job status',
      jobId: params.jobId 
    }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const { jobId } = params

    if (!jobId) {
      return NextResponse.json({ error: 'jobId is required' }, { status: 400 })
    }

    const cancelled = await pdfJobQueue.cancelJob(jobId)
    
    if (!cancelled) {
      return NextResponse.json({ 
        error: 'Job not found or cannot be cancelled',
        jobId 
      }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      jobId,
      message: 'Job cancelled successfully',
      timestamp: Date.now(),
    })

  } catch (error: any) {
    console.error(`📋 Job cancellation error for ${params.jobId}:`, error)
    return NextResponse.json({ 
      error: error?.message || 'Failed to cancel job',
      jobId: params.jobId 
    }, { status: 500 })
  }
}