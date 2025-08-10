import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '../../../payload.config'
import { PDFProcessor } from '../../../utils/pdfProcessor'

export async function POST(request: NextRequest) {
  try {
    const { moduleId } = await request.json()
    if (!moduleId) {
      return NextResponse.json({ error: 'moduleId is required' }, { status: 400 })
    }

    const payload = await getPayload({ config })

    // Load module and ensure pdfUpload exists
    const mod: any = await payload.findByID({ collection: 'modules', id: String(moduleId) })
    const pdfUpload = mod.pdfUpload
    const mediaId = typeof pdfUpload === 'object' ? (pdfUpload as any).id : pdfUpload
    if (!mediaId) {
      return NextResponse.json({ error: 'Module has no pdfUpload set' }, { status: 400 })
    }

    // Get the media document
    const mediaDoc: any = await payload.findByID({
      collection: 'media',
      id: String(mediaId),
    })
    if (!mediaDoc?.url) {
      return NextResponse.json({ error: 'Media file has no accessible URL' }, { status: 400 })
    }

    // Fetch the PDF file
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

    // Process the PDF
    const processor = new PDFProcessor()
    const result = await processor.processPDFToSlides(
      pdfBuffer,
      String(moduleId),
      mediaDoc.filename || 'uploaded.pdf',
    )

    return NextResponse.json(result, { status: result.success ? 200 : 500 })
  } catch (e: any) {
    console.error('process-module-pdf error:', e)
    return NextResponse.json({ error: e?.message || 'Internal error' }, { status: 500 })
  }
}
