import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '../../../payload.config'

// Dev-only helper to trigger PDF→Slides using the Local API
export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Disabled in production' }, { status: 403 })
  }

  try {
    const { moduleId, mediaId } = await request.json()
    if (!moduleId) {
      return NextResponse.json({ error: 'moduleId is required' }, { status: 400 })
    }

    const payload = await getPayload({ config })

    // Load module
    const mod: any = await payload.findByID({ collection: 'modules', id: String(moduleId) })

    // Determine media doc holding the uploaded PDF
    const effectiveMediaId =
      mediaId || (typeof mod.pdfUpload === 'object' ? mod.pdfUpload?.id : mod.pdfUpload)
    if (!effectiveMediaId) {
      return NextResponse.json(
        { error: 'No PDF uploaded on module and no mediaId provided' },
        { status: 400 },
      )
    }

    const mediaDoc: any = await payload.findByID({
      collection: 'media',
      id: String(effectiveMediaId),
    })
    if (!mediaDoc?.url) {
      return NextResponse.json({ error: 'Media file has no accessible URL' }, { status: 400 })
    }

    const SERVER_ORIGIN =
      process.env.PAYLOAD_PUBLIC_SERVER_URL || `http://localhost:${process.env.PORT || 3001}`
    const absoluteUrl = mediaDoc.url.startsWith('http')
      ? mediaDoc.url
      : `${SERVER_ORIGIN}${mediaDoc.url}`

    const cookie = request.headers.get('cookie') || ''
    const res = await fetch(absoluteUrl, { headers: cookie ? { cookie } : undefined })
    if (!res.ok) {
      return NextResponse.json(
        { error: `Failed to fetch PDF: ${res.status} ${res.statusText}` },
        { status: 502 },
      )
    }

    const ab = await res.arrayBuffer()
    const pdfBuffer = Buffer.from(ab)

    const { PDFProcessor } = await import('../../../utils/pdfProcessor')
    const processor = new PDFProcessor()
    const result = await processor.processPDFToSlides(
      pdfBuffer,
      String(moduleId),
      mediaDoc.filename || 'uploaded.pdf',
    )

    return NextResponse.json(result, { status: result.success ? 200 : 500 })
  } catch (e: any) {
    console.error('test-process-module-pdf error:', e)
    return NextResponse.json({ error: e?.message || 'Internal error' }, { status: 500 })
  }
}
