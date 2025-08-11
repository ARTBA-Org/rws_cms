import { NextRequest, NextResponse } from 'next/server'
import { getProcessingStatus } from '../../../../utils/processingStatus'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ moduleId: string }> },
) {
  try {
    const { moduleId } = await params

    if (!moduleId) {
      return NextResponse.json({ error: 'moduleId is required' }, { status: 400 })
    }

    // Get current status from utility
    const status = getProcessingStatus(moduleId)

    // Provide defaults compatible with UI progress components
    return NextResponse.json({
      isProcessing: !!status.isProcessing,
      stage: status.stage || 'idle',
      currentPage: status.currentPage || 0,
      totalPages: status.totalPages || 0,
      slidesCreated: status.slidesCreated || 0,
      error: status.error,
      startTime: status.startTime,
    })
  } catch (error) {
    console.error('Error fetching processing status:', error)
    return NextResponse.json({ error: 'Failed to fetch processing status' }, { status: 500 })
  }
}
