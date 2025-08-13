import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '../../../payload.config'

// Dev-only helper to trigger PDF→Slides using the Local API
export async function POST(request: NextRequest) {
  // Allow PDF processing in all environments
  // Removed production check - PDF processing is now available in deployed environments

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

    console.log('📋 Loading media document...')
    const mediaDoc: any = await payload.findByID({
      collection: 'media',
      id: String(effectiveMediaId),
    })
    if (!mediaDoc?.url) {
      console.error('❌ Media file has no accessible URL')
      return NextResponse.json({ error: 'Media file has no accessible URL' }, { status: 400 })
    }
    console.log('✅ Media document loaded:', {
      id: mediaDoc.id,
      filename: mediaDoc.filename,
      url: mediaDoc.url,
      mimeType: mediaDoc.mimeType,
    })

    const SERVER_ORIGIN =
      process.env.PAYLOAD_PUBLIC_SERVER_URL || `http://localhost:${process.env.PORT || 3001}`
    const absoluteUrl = mediaDoc.url.startsWith('http')
      ? mediaDoc.url
      : `${SERVER_ORIGIN}${mediaDoc.url}`
    
    console.log('📋 Fetching PDF from URL:', absoluteUrl)
    console.log('📋 Server origin:', SERVER_ORIGIN)
    
    const cookie = request.headers.get('cookie') || ''
    const res = await fetch(absoluteUrl, { headers: cookie ? { cookie } : undefined })
    if (!res.ok) {
      console.error(`❌ Failed to fetch PDF: ${res.status} ${res.statusText}`)
      console.error('URL attempted:', absoluteUrl)
      return NextResponse.json(
        { error: `Failed to fetch PDF: ${res.status} ${res.statusText}`, url: absoluteUrl },
        { status: 502 },
      )
    }
    console.log('✅ PDF fetched successfully, size:', res.headers.get('content-length'))

    const ab = await res.arrayBuffer()
    const pdfBuffer = Buffer.from(ab)
    console.log('✅ PDF buffer created, size:', pdfBuffer.length)

    console.log('📋 Importing PDFProcessor...')
    // Use processor with Puppeteer image generation
    const { PDFProcessor } = await import('../../../utils/pdfProcessorWithImages')
    console.log('✅ PDFProcessor imported successfully')
    
    console.log('📋 Creating PDFProcessor instance...')
    const processor = new PDFProcessor()
    console.log('✅ PDFProcessor instance created')
    
    console.log('📋 Starting PDF processing...')
    const result = await processor.processPDFToSlides(
      pdfBuffer,
      String(moduleId),
      mediaDoc.filename || 'uploaded.pdf',
    )
    console.log('✅ PDF processing completed:', result)

    return NextResponse.json(result, { status: result.success ? 200 : 500 })
  } catch (e: any) {
    console.error('test-process-module-pdf error:', e)
    return NextResponse.json({ error: e?.message || 'Internal error' }, { status: 500 })
  }
}
