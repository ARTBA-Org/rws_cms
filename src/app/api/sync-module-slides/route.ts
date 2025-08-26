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

    // Find all slides that have this module as parent
    const slidesResponse = await payload.find({
      collection: 'slides',
      where: {
        parent: {
          equals: moduleId,
        },
      },
      limit: 1000, // Adjust as needed
    })

    const slideIds = slidesResponse.docs.map(slide => slide.id)

    if (slideIds.length === 0) {
      return NextResponse.json({ 
        message: 'No slides found for this module',
        slideIds: [],
        updatedCount: 0
      })
    }

    // Update the module with all slide IDs
    await payload.update({
      collection: 'modules',
      id: String(moduleId),
      data: {
        slides: slideIds,
      },
    })

    return NextResponse.json({
      message: `Module ${moduleId} updated with ${slideIds.length} slides`,
      slideIds,
      updatedCount: slideIds.length,
    })

  } catch (e: any) {
    console.error('sync-module-slides error:', e)
    return NextResponse.json({ error: e?.message || 'Internal error' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const moduleId = searchParams.get('moduleId')
    
    if (!moduleId) {
      return NextResponse.json({ error: 'moduleId is required' }, { status: 400 })
    }

    const payload = await getPayload({ config })

    // Find all slides that have this module as parent
    const slidesResponse = await payload.find({
      collection: 'slides',
      where: {
        parent: {
          equals: moduleId,
        },
      },
      limit: 1000,
    })

    const slideIds = slidesResponse.docs.map(slide => slide.id)

    return NextResponse.json({
      moduleId,
      slideIds,
      slideCount: slideIds.length,
      slides: slidesResponse.docs.map(slide => ({
        id: slide.id,
        title: slide.title,
        slug: slide.slug,
        type: slide.type,
      })),
    })

  } catch (e: any) {
    console.error('sync-module-slides GET error:', e)
    return NextResponse.json({ error: e?.message || 'Internal error' }, { status: 500 })
  }
}