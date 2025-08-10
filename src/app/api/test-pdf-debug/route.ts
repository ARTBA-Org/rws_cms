import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '../../../payload.config'

export async function POST(request: NextRequest) {
  try {
    const { moduleId } = await request.json()

    if (!moduleId) {
      return NextResponse.json({ error: 'moduleId is required' }, { status: 400 })
    }

    console.log('🔍 Debug: Starting PDF processing test for module:', moduleId)

    const payload = await getPayload({ config })

    // Load module and check pdfUpload
    const mod = await payload.findByID({ collection: 'modules', id: String(moduleId) })
    console.log('📋 Debug: Module data:', {
      id: mod.id,
      title: mod.title,
      pdfUpload: mod.pdfUpload,
      slidesCount: (mod.slides as any)?.length || 0,
    })

    const pdfUpload = mod.pdfUpload
    const pdfId = typeof pdfUpload === 'object' ? (pdfUpload as any).id : pdfUpload

    if (!pdfId) {
      return NextResponse.json(
        {
          error: 'Module has no pdfUpload set',
          moduleData: mod,
        },
        { status: 400 },
      )
    }

    // Get the PDF media document
    const mediaDoc = await payload.findByID({
      collection: 'media',
      id: String(pdfId),
    })

    console.log('📄 Debug: Media document:', {
      id: mediaDoc.id,
      filename: (mediaDoc as any)?.filename,
      url: (mediaDoc as any)?.url,
      mimeType: (mediaDoc as any)?.mimeType,
    })

    // Test PDF processing
    const SERVER_ORIGIN =
      process.env.PAYLOAD_PUBLIC_SERVER_URL || `http://localhost:${process.env.PORT || 3001}`
    const fileUrl = (mediaDoc as any)?.url

    if (!fileUrl) {
      return NextResponse.json({ error: 'PDF file URL not found' }, { status: 404 })
    }

    const absoluteUrl = fileUrl.startsWith('http') ? fileUrl : `${SERVER_ORIGIN}${fileUrl}`
    console.log('🌐 Debug: Fetching PDF from:', absoluteUrl)

    const res = await fetch(absoluteUrl)
    if (!res.ok) {
      return NextResponse.json(
        { error: `Failed to fetch PDF: ${res.status} ${res.statusText}` },
        { status: 502 },
      )
    }

    const ab = await res.arrayBuffer()
    const pdfBuffer = Buffer.from(ab)
    console.log('📦 Debug: PDF buffer size:', pdfBuffer.length)

    // Start PDF processing with detailed logging
    const { PDFProcessor } = await import('../../../utils/pdfProcessor')
    const processor = new PDFProcessor()

    console.log('🚀 Debug: Starting PDF processing...')
    const result = await processor.processPDFToSlides(
      pdfBuffer,
      String(moduleId),
      (mediaDoc as any)?.filename || 'uploaded.pdf',
    )

    console.log('✅ Debug: Processing result:', result)

    return NextResponse.json({
      message: 'PDF processing completed',
      result,
      moduleId: String(moduleId),
    })
  } catch (e: any) {
    console.error('❌ Debug: PDF processing error:', e)
    console.error('❌ Debug: Error stack:', e?.stack)
    return NextResponse.json(
      {
        error: e?.message || 'Internal error',
        stack: e?.stack,
      },
      { status: 500 },
    )
  }
}
