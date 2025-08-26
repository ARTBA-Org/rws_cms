import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '../../../payload.config'
// Using FastAPI for slide analysis instead of local SlideAnalyzer

export async function POST(request: NextRequest) {
  try {
    const { moduleId, maxSlides = 10 } = await request.json()

    if (!moduleId) {
      return NextResponse.json({ error: 'moduleId is required' }, { status: 400 })
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 400 })
    }

    const payload = await getPayload({ config })
    // Note: This endpoint is now deprecated - use FastAPI directly instead

    // Find slides for this module that have images but generic titles
    const slides = await payload.find({
      collection: 'slides',
      where: {
        and: [
          { 'source.module': { equals: Number(moduleId) } },
          { 'image': { exists: true } },
        ],
      },
      limit: maxSlides,
      depth: 2,
      overrideAccess: true,
    })

    console.log(`🔍 Found ${slides.docs.length} slides to reprocess for module ${moduleId}`)

    const results = []
    let processed = 0
    let updated = 0

    for (const slide of slides.docs as any[]) {
      try {
        console.log(`🤖 Processing slide ${slide.id}: "${slide.title}"`)

        // Get the image media document
        const imageMedia = typeof slide.image === 'object' ? slide.image : null
        if (!imageMedia?.url) {
          console.warn(`⚠️ Slide ${slide.id} has no accessible image URL`)
          continue
        }

        // Fetch the image
        const SERVER_ORIGIN = process.env.PAYLOAD_PUBLIC_SERVER_URL || `http://localhost:3002`
        const imageUrl = imageMedia.url.startsWith('http')
          ? imageMedia.url
          : `${SERVER_ORIGIN}${imageMedia.url}`

        console.log(`📥 Fetching image from: ${imageUrl}`)

        const cookie = request.headers.get('cookie') || ''
        const imageResponse = await fetch(imageUrl, {
          headers: cookie ? { cookie } : undefined
        })

        if (!imageResponse.ok) {
          console.warn(`⚠️ Failed to fetch image for slide ${slide.id}: ${imageResponse.status}`)
          continue
        }

        const imageBuffer = Buffer.from(await imageResponse.arrayBuffer())

        // This endpoint is deprecated - use FastAPI /slides/ingest instead
        return NextResponse.json({
          error: 'This endpoint is deprecated. Use FastAPI /slides/ingest endpoint instead.',
          fastapi_url: process.env.PDF_EXTRACTOR_URL || 'http://localhost:8080'
        }, { status: 410 })

        // Update the slide with AI-extracted data
        const updatedSlide = await payload.update({
          collection: 'slides',
          id: slide.id,
          data: {
            title: analysis.Title,
            description: analysis.Description,
            type: analysis.Type.toLowerCase(),
          },
          overrideAccess: true,
        })

        console.log(`✅ Updated slide ${slide.id}: "${analysis.Title}" (${analysis.Type})`)

        results.push({
          slideId: slide.id,
          oldTitle: slide.title,
          newTitle: analysis.Title,
          type: analysis.Type,
          success: true,
        })

        updated++

      } catch (slideError) {
        console.error(`❌ Error processing slide ${slide.id}:`, slideError)
        results.push({
          slideId: slide.id,
          oldTitle: slide.title,
          error: slideError instanceof Error ? slideError.message : String(slideError),
          success: false,
        })
      }

      processed++
    }

    return NextResponse.json({
      success: true,
      message: `Successfully reprocessed ${updated} out of ${processed} slides`,
      moduleId,
      slidesFound: slides.docs.length,
      slidesProcessed: processed,
      slidesUpdated: updated,
      results,
    })

  } catch (error: any) {
    console.error('reprocess-slides-ai error:', error)
    return NextResponse.json({
      error: error?.message || 'Internal error',
      details: error?.stack
    }, { status: 500 })
  }
}
