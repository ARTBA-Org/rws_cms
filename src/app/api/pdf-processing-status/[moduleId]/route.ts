import { NextRequest, NextResponse } from 'next/server'
import { getProcessingStatus } from '../../../../utils/processingStatus'

export async function GET(request: NextRequest, { params }: { params: { moduleId: string } }) {
  try {
    const { moduleId } = params

    if (!moduleId) {
      return NextResponse.json({ error: 'moduleId is required' }, { status: 400 })
    }

    // Get current status from utility
    const status = getProcessingStatus(moduleId)

    return NextResponse.json(status)
  } catch (error) {
    console.error('Error fetching processing status:', error)
    return NextResponse.json({ error: 'Failed to fetch processing status' }, { status: 500 })
  }
}
