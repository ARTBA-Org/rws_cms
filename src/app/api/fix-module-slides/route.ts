import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '../../../payload.config'

export async function POST(request: NextRequest) {
      try {
            const { moduleId = "16" } = await request.json().catch(() => ({}))

            const payload = await getPayload({ config })

            console.log(`🔍 Finding all slides with parent = ${moduleId}...`)

            // Find all slides that have parent set to the module
            const slides = await payload.find({
                  collection: 'slides',
                  where: {
                        parent: { equals: Number(moduleId) }
                  },
                  limit: 100,
                  depth: 0,
                  overrideAccess: true
            })

            console.log(`📊 Found ${slides.docs.length} slides with parent = ${moduleId}`)

            if (slides.docs.length === 0) {
                  console.log('🔍 No slides found with parent field, checking source.module...')

                  // Try looking for slides with source.module = moduleId
                  const slidesBySource = await payload.find({
                        collection: 'slides',
                        where: {
                              'source.module': { equals: Number(moduleId) }
                        },
                        limit: 100,
                        depth: 0,
                        overrideAccess: true
                  })

                  console.log(`📊 Found ${slidesBySource.docs.length} slides with source.module = ${moduleId}`)

                  if (slidesBySource.docs.length > 0) {
                        console.log('🔄 Updating slides to set parent field...')

                        for (const slide of slidesBySource.docs) {
                              try {
                                    await payload.update({
                                          collection: 'slides',
                                          id: slide.id,
                                          data: {
                                                parent: Number(moduleId)
                                          },
                                          overrideAccess: true
                                    })
                                    console.log(`✅ Updated slide ${slide.id} to have parent = ${moduleId}`)
                              } catch (err: any) {
                                    console.error(`❌ Failed to update slide ${slide.id}:`, err.message)
                              }
                        }

                        // Re-fetch slides after updating
                        const updatedSlides = await payload.find({
                              collection: 'slides',
                              where: {
                                    parent: { equals: Number(moduleId) }
                              },
                              limit: 100,
                              depth: 0,
                              overrideAccess: true
                        })

                        slides.docs = updatedSlides.docs
                  }
            }

            const slideIds = slides.docs.map((slide: any) => slide.id)
            console.log(`📝 Slide IDs to link: ${slideIds.join(', ')}`)

            if (slideIds.length > 0) {
                  console.log(`🔄 Updating module ${moduleId} with slide references...`)

                  await payload.update({
                        collection: 'modules',
                        id: String(moduleId),
                        data: {
                              slides: slideIds
                        },
                        overrideAccess: true,
                        depth: 0
                  })

                  console.log(`✅ Module ${moduleId} updated with ${slideIds.length} slides`)

                  // Verify the update
                  const module = await payload.findByID({
                        collection: 'modules',
                        id: String(moduleId),
                        depth: 1,
                        overrideAccess: true
                  })

                  console.log(`🔍 Verification: Module ${moduleId} now has ${module.slides?.length || 0} slides`)

                  return NextResponse.json({
                        success: true,
                        message: `Module ${moduleId} updated with ${slideIds.length} slides`,
                        slideIds,
                        finalSlideCount: module.slides?.length || 0
                  })
            } else {
                  return NextResponse.json({
                        success: false,
                        message: 'No slides found to link'
                  })
            }

      } catch (error: any) {
            console.error('❌ Error:', error)
            return NextResponse.json({
                  success: false,
                  error: error.message
            }, { status: 500 })
      }
}
