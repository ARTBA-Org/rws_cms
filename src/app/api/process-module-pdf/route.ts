import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '../../../payload.config'

export async function POST(request: NextRequest) {
  try {
    const { moduleId } = await request.json()
    if (!moduleId) {
      return NextResponse.json({ error: 'moduleId is required' }, { status: 400 })
    }

    const payload = await getPayload({ config })

    // Load module and ensure pdfUpload exists
    const mod = await payload.findByID({ collection: 'modules', id: String(moduleId) })
    const pdfUpload = mod.pdfUpload
    const pdfId = typeof pdfUpload === 'object' ? (pdfUpload as any).id : pdfUpload
    if (!pdfId) {
      return NextResponse.json({ error: 'Module has no pdfUpload set' }, { status: 400 })
    }

    // Load PDF document
    const pdfDoc: any = await payload.findByID({ collection: 'pdfs', id: pdfId })
    if (!pdfDoc || !pdfDoc.filename) {
      return NextResponse.json({ error: 'PDF not found' }, { status: 404 })
    }

    // Build buffer — prefer URL fetch (handles S3/local file route)
    let pdfBuffer: Buffer
    if (pdfDoc.url) {
      const SERVER_ORIGIN =
        process.env.PAYLOAD_PUBLIC_SERVER_URL || `http://localhost:${process.env.PORT || 3001}`
      const absoluteUrl = pdfDoc.url.startsWith('http')
        ? pdfDoc.url
        : `${SERVER_ORIGIN}${pdfDoc.url}`
      const cookie = request.headers.get('cookie') || ''
      const res = await fetch(absoluteUrl, { headers: cookie ? { cookie } : undefined })
      if (!res.ok) {
        return NextResponse.json(
          { error: `Failed to fetch PDF: ${res.status} ${res.statusText}` },
          { status: 502 },
        )
      }
      const ab = await res.arrayBuffer()
      pdfBuffer = Buffer.from(ab)
    } else {
      return NextResponse.json({ error: 'PDF has no accessible URL' }, { status: 400 })
    }

    const { PDFProcessor } = await import('../../../utils/pdfProcessor')
    const processor = new PDFProcessor()
    const result = await processor.processPDFToSlides(
      pdfBuffer,
      String(moduleId),
      pdfDoc.filename || 'uploaded.pdf',
    )

    return NextResponse.json(result, { status: result.success ? 200 : 500 })
  } catch (e: any) {
    console.error('process-module-pdf error:', e)
    return NextResponse.json({ error: e?.message || 'Internal error' }, { status: 500 })
  }
}
