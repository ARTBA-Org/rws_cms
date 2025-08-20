import { NextRequest, NextResponse } from 'next/server'
import { s3ImageUploader } from '../../../../../utils/s3ImageUploader'

// DELETE - Delete image from CDN
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    const { key } = await params
    
    if (!key) {
      return NextResponse.json({ error: 'Image key is required' }, { status: 400 })
    }

    // Decode the key (it may be URL encoded)
    const decodedKey = decodeURIComponent(key)
    
    const success = await s3ImageUploader.deleteImage(decodedKey)
    
    if (!success) {
      return NextResponse.json({ 
        error: 'Failed to delete image' 
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: `Image ${decodedKey} deleted successfully`,
      key: decodedKey,
    })

  } catch (error: any) {
    console.error('CDN delete error:', error)
    return NextResponse.json({
      error: error?.message || 'Delete failed',
    }, { status: 500 })
  }
}

// HEAD - Check if image exists
export async function HEAD(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    const { key } = await params
    
    if (!key) {
      return new NextResponse(null, { status: 400 })
    }

    const decodedKey = decodeURIComponent(key)
    const exists = await s3ImageUploader.imageExists(decodedKey)
    
    return new NextResponse(null, { 
      status: exists ? 200 : 404,
      headers: {
        'X-Image-Exists': exists.toString(),
      }
    })

  } catch (error: any) {
    console.error('CDN check error:', error)
    return new NextResponse(null, { status: 500 })
  }
}

// GET - Get image info/redirect
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    const { key } = await params
    const { searchParams } = new URL(request.url)
    const redirect = searchParams.get('redirect') === 'true'
    
    if (!key) {
      return NextResponse.json({ error: 'Image key is required' }, { status: 400 })
    }

    const decodedKey = decodeURIComponent(key)
    const exists = await s3ImageUploader.imageExists(decodedKey)
    
    if (!exists) {
      return NextResponse.json({ 
        error: 'Image not found' 
      }, { status: 404 })
    }

    // If redirect is requested, redirect to the CDN URL
    if (redirect) {
      const cdnUrl = `${s3ImageUploader['getCDNUrl']()}/${decodedKey}`
      return NextResponse.redirect(cdnUrl)
    }

    // Otherwise return image info
    return NextResponse.json({
      exists: true,
      key: decodedKey,
      url: `${s3ImageUploader['getCDNUrl']()}/${decodedKey}`,
    })

  } catch (error: any) {
    console.error('CDN get error:', error)
    return NextResponse.json({
      error: error?.message || 'Get failed',
    }, { status: 500 })
  }
}