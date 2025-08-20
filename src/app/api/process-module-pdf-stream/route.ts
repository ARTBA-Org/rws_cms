import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '../../../payload.config'
import { streamProcessPDF, PDFStreamProcessor } from '../../../utils/pdfStreamProcessor'
import { PDFProcessorOptimized } from '../../../utils/pdfProcessorOptimized'
import type { PopulatedModule, ProcessingProgress } from '../../../types/pdfTypes'

export async function POST(request: NextRequest) {
  try {
    const { moduleId, streaming = true } = await request.json()
    if (!moduleId) {
      return NextResponse.json({ error: 'moduleId is required' }, { status: 400 })
    }

    const payload = await getPayload({ config })

    // Load module and ensure pdfUpload exists
    const mod = await payload.findByID({ 
      collection: 'modules', 
      id: String(moduleId),
      depth: 1 
    }) as PopulatedModule
    
    const pdfUpload = mod.pdfUpload
    const mediaId = typeof pdfUpload === 'object' ? pdfUpload?.id : pdfUpload
    if (!mediaId) {
      return NextResponse.json({ error: 'Module has no pdfUpload set' }, { status: 400 })
    }

    // Get the media document
    const mediaDoc = await payload.findByID({
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

    if (!streaming) {
      // Use traditional processing for comparison
      const processor = new PDFProcessorOptimized({
        enableImages: true,
      })
      const result = await processor.processPDFToSlides(
        pdfBuffer,
        String(moduleId),
        mediaDoc.filename || 'uploaded.pdf',
      )
      return NextResponse.json(result, { status: result.success ? 200 : 500 })
    }

    // Use streaming processing
    console.log('🌊 Starting streaming PDF processing...')
    
    // Create processor for individual pages
    const processor = new PDFProcessorOptimized({
      enableImages: true,
      maxPages: 1, // Process one page at a time
    })

    // Progress tracking
    const progressUpdates: ProcessingProgress[] = []
    
    const result = await streamProcessPDF(
      pdfBuffer,
      async (pageBuffer: Buffer, pageNum: number, totalPages: number) => {
        console.log(`🌊 Processing page ${pageNum}/${totalPages} via streaming...`)
        
        // Use the optimized processor to handle this single page
        const pageResult = await processor.processSinglePage(
          pageNum,
          totalPages,
          await import('pdf-lib').then(lib => lib.PDFDocument.load(pageBuffer)),
          null, // No full PDF text for streaming
          pageBuffer,
          mediaDoc.filename || 'uploaded.pdf',
          payload,
          String(moduleId),
        )
        
        return pageResult
      },
      {
        chunkSize: 2, // Process 2 pages at a time
        onProgress: (progress) => {
          progressUpdates.push(progress)
          console.log(`📊 Progress: ${progress.processedPages}/${progress.totalPages} pages, ${progress.createdSlides} slides created`)
        }
      }
    )

    // Add progress information to the result
    const enhancedResult = {
      ...result,
      streaming: true,
      progressUpdates: progressUpdates.slice(-5), // Return last 5 progress updates
      processingMethod: 'streaming',
    }

    return NextResponse.json(enhancedResult, { status: result.success ? 200 : 500 })

  } catch (error: any) {
    console.error('🌊 Streaming PDF processing error:', error)
    return NextResponse.json({ 
      error: error?.message || 'Internal streaming error',
      streaming: true 
    }, { status: 500 })
  }
}