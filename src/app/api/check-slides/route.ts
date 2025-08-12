import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '../../../payload.config'

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const moduleId = url.searchParams.get('moduleId') || '85'

    const payload = await getPayload({ config })

    // Get the module with its slides
    const module = await payload.findByID({
      collection: 'modules',
      id: String(moduleId),
      overrideAccess: true,
      depth: 2, // Get slides with their details
    })

    // Get all slides for this module
    const slides = (module as any).slides || []

    console.log(`[check-slides] Module ${moduleId} has ${slides.length} slides`)

    // Get recent slides (created in last hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
    const recentSlides = await payload.find({
      collection: 'slides',
      where: {
        createdAt: {
          greater_than: oneHourAgo.toISOString(),
        },
      },
      overrideAccess: true,
      limit: 20,
    })

    return NextResponse.json({
      success: true,
      moduleId,
      slidesInModule: slides.length,
      slideIds: slides.map((s: any) => ({ id: s.id || s, title: s.title || 'No title' })),
      recentSlides: recentSlides.docs.length,
      recentSlidesData: recentSlides.docs.map((s: any) => ({
        id: s.id,
        title: s.title,
        description: s.description?.substring(0, 100) + '...',
        createdAt: s.createdAt,
      })),
    })
  } catch (error: any) {
    console.error('[check-slides] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
