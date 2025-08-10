import { NextRequest, NextResponse } from 'next/server'
// PDF processing removed

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('pdf') as File
    const moduleId = formData.get('moduleId') as string

    if (!file) {
      return NextResponse.json({ error: 'No PDF file provided' }, { status: 400 })
    }

    if (!moduleId) {
      return NextResponse.json({ error: 'Module ID required' }, { status: 400 })
    }

    if (file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'Only PDF files allowed' }, { status: 400 })
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    return NextResponse.json(
      { success: false, error: 'PDF processing is disabled' },
      { status: 410 },
    )
  } catch (error) {
    console.error('PDF upload error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 },
    )
  }
}
