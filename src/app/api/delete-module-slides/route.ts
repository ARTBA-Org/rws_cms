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

    // Get the module with its slides
    const module = await payload.findByID({
      collection: 'modules',
      id: String(moduleId),
      depth: 1,
    })

    if (!module) {
      return NextResponse.json({ error: 'Module not found' }, { status: 404 })
    }

    // Delete all slides associated with this module
    let deletedCount = 0
    if (module.slides && Array.isArray(module.slides)) {
      for (const slideRef of module.slides) {
        const slideId = typeof slideRef === 'object' ? slideRef.id : slideRef
        try {
          await payload.delete({
            collection: 'slides',
            id: String(slideId),
          })
          deletedCount++
        } catch (err) {
          console.warn(`Failed to delete slide ${slideId}:`, err)
        }
      }
    }

    // Clear the slides array in the module
    await payload.update({
      collection: 'modules',
      id: String(moduleId),
      data: {
        slides: [],
      },
    })

    return NextResponse.json({
      success: true,
      message: `Deleted ${deletedCount} slides from module`,
      deletedCount,
    })
  } catch (error: any) {
    console.error('delete-module-slides error:', error)
    return NextResponse.json(
      { error: error?.message || 'Failed to delete slides' },
      { status: 500 }
    )
  }
}