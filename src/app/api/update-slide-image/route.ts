import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '../../../payload.config'

/**
 * API route to update a slide with a client-generated image
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const slideId = formData.get('slideId') as string
    const imageFile = formData.get('image') as File
    
    if (!slideId || !imageFile) {
      return NextResponse.json(
        { error: 'Missing slideId or image file' },
        { status: 400 }
      )
    }

    console.log(`📤 Updating slide ${slideId} with client-generated image`)
    
    const payload = await getPayload({ config })
    
    // Convert File to Buffer
    const arrayBuffer = await imageFile.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    
    // Upload image to media collection
    const mediaDoc = await payload.create({
      collection: 'media',
      data: {
        alt: `Generated image for slide ${slideId}`,
      },
      file: {
        data: buffer,
        mimetype: imageFile.type || 'image/png',
        name: imageFile.name || `slide_${slideId}.png`,
        size: buffer.length,
      },
      overrideAccess: true,
      depth: 0,
    })
    
    console.log(`✅ Image uploaded with ID: ${mediaDoc.id}`)
    
    // Update slide with the new image
    const updatedSlide = await payload.update({
      collection: 'slides',
      id: slideId,
      data: {
        image: mediaDoc.id,
      },
      overrideAccess: true,
      depth: 0,
    })
    
    console.log(`✅ Slide ${slideId} updated with image`)
    
    return NextResponse.json({
      success: true,
      mediaId: mediaDoc.id,
      slideId: updatedSlide.id,
    })
    
  } catch (error) {
    console.error('❌ Error updating slide image:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update slide image' },
      { status: 500 }
    )
  }
}