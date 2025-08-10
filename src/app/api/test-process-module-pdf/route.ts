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
    console.log('📋 Debug: Module data:', {
      id: mod.id,
      title: mod.title,
      pdfUpload: mod.pdfUpload,
      pdfUploadType: typeof mod.pdfUpload,
    })

    // Determine media doc holding the uploaded PDF
    let effectiveMediaId =
      mediaId || (typeof mod.pdfUpload === 'object' ? mod.pdfUpload?.id : mod.pdfUpload)
    console.log('📋 Debug: Effective media ID:', effectiveMediaId)

    // If no PDF is saved on the module, try to find a recently uploaded PDF
    if (!effectiveMediaId) {
      console.log('🔍 No PDF saved on module, checking for recent uploads...')

      // Look for PDFs uploaded in the last hour that might belong to this module
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
      const recentMedia = await payload.find({
        collection: 'media',
        where: {
          mimeType: {
            equals: 'application/pdf',
          },
          createdAt: {
            greater_than: oneHourAgo.toISOString(),
          },
        },
        sort: '-createdAt',
        limit: 1,
      })

      if (recentMedia.docs.length > 0) {
        effectiveMediaId = recentMedia.docs[0].id
        console.log('📋 Found recent PDF upload:', {
          id: effectiveMediaId,
          filename: (recentMedia.docs[0] as any).filename,
        })
      }
    }

    if (!effectiveMediaId) {
      return NextResponse.json(
        {
          error: 'No PDF uploaded on module. Please save the module after uploading a PDF.',
          debug: {
            moduleId,
            pdfUpload: mod.pdfUpload,
            pdfUploadType: typeof mod.pdfUpload,
          },
        },
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

    const { PDFProcessor } = await import('../../../utils/pdfProcessorWorking')
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
