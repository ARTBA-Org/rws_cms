import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '../../../payload.config'
import path from 'path'
import { promises as fs } from 'fs'

// Dev-only helper to trigger PDF→Slides using the Local API
export async function POST(request: NextRequest) {
  // Allow PDF processing in all environments
  // Removed production check - PDF processing is now available in deployed environments

  try {
    const {
      moduleId,
      mediaId,
      useOptimized = true,
      useChunked = false,
      processorConfig = {},
      startPage: clientStartPage,
    } = await request.json()
    if (!moduleId) {
      return NextResponse.json({ error: 'moduleId is required' }, { status: 400 })
    }

    const payload = await getPayload({ config })

    // Load module
    const mod: any = await payload.findByID({
      collection: 'modules',
      id: String(moduleId),
      overrideAccess: true,
      depth: 0,
    })
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

    // Dynamically detect the actual port from the request
    const host = request.headers.get('host')
    const SERVER_ORIGIN =
      process.env.PAYLOAD_PUBLIC_SERVER_URL || (host?.startsWith('http') ? host : `http://${host}`)
    const absoluteUrl = mediaDoc.url.startsWith('http')
      ? mediaDoc.url
      : `${SERVER_ORIGIN}${mediaDoc.url}`

    console.log('📋 Fetching PDF from URL:', absoluteUrl)
    console.log('📋 Server origin:', SERVER_ORIGIN)

    const cookie = request.headers.get('cookie') || ''
    let pdfBuffer: Buffer | null = null
    try {
      const res = await fetch(absoluteUrl, { headers: cookie ? { cookie } : undefined })
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
      console.log('✅ PDF fetched successfully, size:', res.headers.get('content-length'))
      const ab = await res.arrayBuffer()
      pdfBuffer = Buffer.from(ab)
    } catch (fetchErr) {
      console.warn('⚠️ HTTP fetch failed, trying filesystem fallback:', fetchErr)
      try {
        // Fallback to local file system when using local storage adapter
        const filename = mediaDoc.filename || 'uploaded.pdf'
        const filePath = path.join(process.cwd(), 'media', filename)
        pdfBuffer = await fs.readFile(filePath)
        console.log('✅ Loaded PDF from filesystem:', filePath)
      } catch (fsErr) {
        console.error('❌ Failed to load PDF from both HTTP and filesystem:', fsErr)
        return NextResponse.json(
          { error: `Failed to fetch PDF: ${String(fetchErr)}`, url: absoluteUrl },
          { status: 502 },
        )
      }
    }

    console.log('✅ PDF buffer ready, size:', pdfBuffer.length)

    // Use client's explicit startPage if provided, otherwise infer from existing slides
    let startPage = clientStartPage
    if (!startPage || startPage < 1) {
      console.log('📌 No valid startPage from client, inferring from existing slides...')
      startPage = 1
      try {
        const existingSlides = await payload.find({
          collection: 'slides',
          where: {
            and: [
              { 'source.module': { equals: Number(moduleId) } },
              { 'source.pdfFilename': { equals: mediaDoc.filename || '' } },
            ],
          },
          limit: 500,
          depth: 0,
          overrideAccess: true,
        })
        const pages = (existingSlides.docs as any[])
          .map((s) => Number(s?.source?.pdfPage))
          .filter((n) => Number.isFinite(n) && n > 0)
        if (pages.length > 0) {
          startPage = Math.max(...pages) + 1
        }
        console.log('📌 Inferred startPage from existing slides:', startPage)
      } catch (inferErr) {
        console.warn('⚠️ Could not infer start page from existing slides:', inferErr)
      }
    } else {
      console.log('📌 Using client-provided startPage:', startPage)
    }

    let result

    if (useChunked) {
      console.log('📋 Using chunked PDF processor...')
      const { PDFProcessorChunked } = await import('../../../utils/pdfProcessorChunked')

      const processor = new PDFProcessorChunked({
        immediatePages: processorConfig.immediatePages || 3,
        chunkSize: processorConfig.chunkSize || 5,
        enableImages: processorConfig.enableImages !== false,
      })

      result = await processor.processPDFChunked(
        pdfBuffer,
        String(moduleId),
        mediaDoc.filename || 'uploaded.pdf',
      )
    } else if (useOptimized) {
      console.log('📋 Using optimized PDF processor...')
      const { PDFProcessorOptimized } = await import('../../../utils/pdfProcessorOptimized')

      // Default config for Lambda environment
      const defaultConfig = {
        maxPages: 5,
        timeoutMs: 25000, // keep under Amplify SSR 28s ceiling
        enableImages: true,
        batchSize: 1,
      }

      const isLambda = !!process.env.AWS_LAMBDA_FUNCTION_NAME || !!process.env.LAMBDA_TASK_ROOT
      const merged = {
        ...defaultConfig,
        ...processorConfig,
        startPage: startPage,
      }

      // Enforce safe caps in server to avoid SSR/Lambda timeout and long requests
      const finalConfig = {
        ...merged,
        timeoutMs: Math.min(Number(merged.timeoutMs || defaultConfig.timeoutMs), 25000),
        maxPages: isLambda
          ? 1 // Keep under Amplify's ~28s SSR ceiling by processing a single page per request
          : Number(merged.maxPages || 5),
        batchSize: 1,
      }

      console.log('⚙️ Processor configuration:', finalConfig)

      const processor = new PDFProcessorOptimized(finalConfig)
      result = await processor.processPDFToSlides(
        pdfBuffer,
        String(moduleId),
        mediaDoc.filename || 'uploaded.pdf',
      )
    } else {
      console.log('📋 Using standard PDF processor with images...')
      const { PDFProcessor } = await import('../../../utils/pdfProcessorWithImages')
      const processor = new PDFProcessor()
      result = await processor.processPDFToSlides(
        pdfBuffer,
        String(moduleId),
        mediaDoc.filename || 'uploaded.pdf',
      )
    }

    console.log('✅ PDF processing completed:', result)

    return NextResponse.json(result, { status: result.success ? 200 : 500 })
  } catch (e: any) {
    console.error('test-process-module-pdf error:', e)
    return NextResponse.json({ error: e?.message || 'Internal error' }, { status: 500 })
  }
}
