import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '../../../payload.config'
import { supabaseEdgePDFProcessor } from '../../../utils/supabaseEdgePdfProcessor'

/**
 * PDF Processing API using Supabase Edge Functions
 * This provides an alternative to the current PDF processing that uses Edge Functions for better scalability
 */
export async function POST(request: NextRequest) {
  try {
    const {
      moduleId,
      mediaId,
      processorConfig = {},
      startPage: clientStartPage,
      replaceExisting = false,
      useEdgeFunction = true, // Flag to enable/disable Edge Function processing
    } = await request.json()

    if (!moduleId) {
      return NextResponse.json({ error: 'moduleId is required' }, { status: 400 })
    }

    console.log('📋 PDF Processing Request:', {
      moduleId,
      mediaId,
      useEdgeFunction,
      processorConfig,
    })

    const payload = await getPayload({ config })

    // Load module
    const mod: any = await payload.findByID({
      collection: 'modules',
      id: String(moduleId),
      overrideAccess: true,
      depth: 0,
    })

    console.log('📋 Module data:', {
      id: mod.id,
      title: mod.title,
      pdfUpload: mod.pdfUpload,
      pdfUploadType: typeof mod.pdfUpload,
    })

    // Determine media doc holding the uploaded PDF
    let effectiveMediaId =
      mediaId || (typeof mod.pdfUpload === 'object' ? mod.pdfUpload?.id : mod.pdfUpload)

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

    // Clean up existing slides if requested
    if (replaceExisting) {
      console.log('🗑️ Cleaning up existing slides...')
      await cleanupExistingSlides(payload, moduleId)
    }

    let result

    if (useEdgeFunction) {
      console.log('🚀 Using Supabase Edge Function for PDF processing...')
      
      // Construct absolute URL for the PDF
      const host = request.headers.get('host')
      const SERVER_ORIGIN =
        process.env.PAYLOAD_PUBLIC_SERVER_URL || (host?.startsWith('http') ? host : `http://${host}`)
      const absoluteUrl = mediaDoc.url.startsWith('http')
        ? mediaDoc.url
        : `${SERVER_ORIGIN}${mediaDoc.url}`

      console.log('📡 PDF URL for Edge Function:', absoluteUrl)

      // Process using Supabase Edge Function
      result = await supabaseEdgePDFProcessor.processPDFFromURL(
        absoluteUrl,
        String(moduleId),
        mediaDoc.filename || 'uploaded.pdf',
        {
          startPage: clientStartPage || 1,
          maxPages: processorConfig.maxPages || 25,
          enableImages: processorConfig.enableImages !== false,
          enableAI: processorConfig.enableAI !== false,
          imageFormat: processorConfig.imageFormat || 'png',
          imageQuality: processorConfig.imageQuality || 90,
        }
      )
    } else {
      console.log('📋 Falling back to local PDF processing...')
      
      // Fallback to existing PDF processor
      const { PDFProcessorOptimized } = await import('../../../utils/pdfProcessorOptimized')
      
      // Fetch PDF buffer
      const host = request.headers.get('host')
      const SERVER_ORIGIN =
        process.env.PAYLOAD_PUBLIC_SERVER_URL || (host?.startsWith('http') ? host : `http://${host}`)
      const absoluteUrl = mediaDoc.url.startsWith('http')
        ? mediaDoc.url
        : `${SERVER_ORIGIN}${mediaDoc.url}`

      const cookie = request.headers.get('cookie') || ''
      const res = await fetch(absoluteUrl, { headers: cookie ? { cookie } : undefined })
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
      
      const ab = await res.arrayBuffer()
      const pdfBuffer = Buffer.from(ab)

      const processor = new PDFProcessorOptimized({
        maxPages: processorConfig.maxPages || 25,
        timeoutMs: processorConfig.timeoutMs || 120000,
        enableImages: processorConfig.enableImages !== false,
        batchSize: 1,
        imageFormat: processorConfig.imageFormat || 'png',
        imageQuality: processorConfig.imageQuality || 90,
        startPage: clientStartPage || 1,
      })

      result = await processor.processPDFToSlides(
        pdfBuffer,
        String(moduleId),
        mediaDoc.filename || 'uploaded.pdf',
      )
    }

    console.log('✅ PDF processing completed:', {
      success: result.success,
      slidesCreated: result.slidesCreated,
      method: useEdgeFunction ? 'Edge Function' : 'Local Processing',
    })

    return NextResponse.json({
      ...result,
      method: useEdgeFunction ? 'edge-function' : 'local-processing',
    }, { status: result.success ? 200 : 500 })

  } catch (error: any) {
    console.error('❌ PDF processing error:', error)
    return NextResponse.json({ 
      error: error?.message || 'Internal error',
      method: 'unknown',
    }, { status: 500 })
  }
}

/**
 * Clean up existing slides for a module
 */
async function cleanupExistingSlides(payload: any, moduleId: string) {
  try {
    // Find all existing slides for this module
    const existingSlides = await payload.find({
      collection: 'slides',
      where: {
        parent: {
          equals: Number(moduleId),
        },
      },
      limit: 1000,
      overrideAccess: true,
    })

    console.log(`🗑️ Found ${existingSlides.docs.length} existing slides to clean up`)

    // Delete each slide and its associated media
    for (const slide of existingSlides.docs as any[]) {
      try {
        // Delete associated media if it exists
        if (slide.image) {
          const mediaId = typeof slide.image === 'object' ? slide.image.id : slide.image
          if (mediaId) {
            console.log(`🗑️ Deleting media ${mediaId} for slide ${slide.id}`)
            await payload.delete({
              collection: 'media',
              id: String(mediaId),
              overrideAccess: true,
            })
          }
        }

        // Delete the slide
        console.log(`🗑️ Deleting slide ${slide.id}`)
        await payload.delete({
          collection: 'slides',
          id: String(slide.id),
          overrideAccess: true,
        })
      } catch (deleteErr) {
        console.warn(`⚠️ Error deleting slide ${slide.id}:`, deleteErr)
      }
    }

    // Update module to remove slide references
    console.log('🔄 Updating module to remove slide references...')
    await payload.update({
      collection: 'modules',
      id: String(moduleId),
      data: {
        slides: [], // Clear all slide references
      },
      overrideAccess: true,
    })

    console.log('✅ Cleanup completed successfully')
  } catch (cleanupErr) {
    console.error('❌ Error during cleanup:', cleanupErr)
    // Continue with processing even if cleanup fails
  }
}

/**
 * Health check endpoint
 */
export async function GET(request: NextRequest) {
  try {
    console.log('🏥 Health check for PDF processing endpoints...')
    
    // Check Edge Function health
    const edgeHealth = await supabaseEdgePDFProcessor.healthCheck()
    
    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      edgeFunction: {
        available: edgeHealth.healthy,
        latency: edgeHealth.latency,
        error: edgeHealth.error,
      },
      localProcessor: {
        available: true, // Local processor is always available
      },
    })
  } catch (error: any) {
    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error?.message || 'Health check failed',
    }, { status: 500 })
  }
}
