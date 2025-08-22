import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '../../../payload.config'

export async function GET(request: NextRequest) {
  try {
    const payload = await getPayload({ config })

    console.log('🔍 Checking slides and module relationships...')

    // Check slides with parent = 16
    const slidesByParent = await payload.find({
      collection: 'slides',
      where: {
        parent: { equals: 16 }
      },
      limit: 50,
      depth: 1,
      overrideAccess: true
    })

    console.log(`📊 Found ${slidesByParent.docs.length} slides with parent = 16`)

    // Check slides with source.module = 16
    const slidesBySource = await payload.find({
      collection: 'slides',
      where: {
        'source.module': { equals: 16 }
      },
      limit: 50,
      depth: 1,
      overrideAccess: true
    })

    console.log(`📊 Found ${slidesBySource.docs.length} slides with source.module = 16`)

    // Check module 16
    const module = await payload.findByID({
      collection: 'modules',
      id: '16',
      depth: 2,
      overrideAccess: true
    })

    console.log(`📊 Module 16 slides field: ${module.slides?.length || 0} slides`)

    return NextResponse.json({
      slidesByParent: {
        count: slidesByParent.docs.length,
        slides: slidesByParent.docs.map((s: any) => ({
          id: s.id,
          title: s.title,
          parent: s.parent?.id || s.parent,
          source: s.source
        }))
      },
      slidesBySource: {
        count: slidesBySource.docs.length,
        slides: slidesBySource.docs.map((s: any) => ({
          id: s.id,
          title: s.title,
          parent: s.parent?.id || s.parent,
          source: s.source
        }))
      },
      module: {
        id: module.id,
        title: module.title,
        slidesCount: module.slides?.length || 0,
        slides: module.slides?.map((s: any) => ({
          id: typeof s === 'object' ? s.id : s,
          title: typeof s === 'object' ? s.title : 'Unknown'
        })) || []
      }
    })

  } catch (error: any) {
    console.error('❌ Error:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}