import { NextRequest, NextResponse } from 'next/server'
import { s3ImageUploader } from '../../../../utils/s3ImageUploader'
import { CDN_CONFIG, validateCDNConfig } from '../../../../utils/cdnConfig'

// POST - Upload image to CDN
export async function POST(request: NextRequest) {
  try {
    // Validate CDN configuration
    const configValidation = validateCDNConfig()
    if (!configValidation.valid) {
      return NextResponse.json({
        error: 'CDN not configured properly',
        details: configValidation.errors,
      }, { status: 500 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File
    const moduleId = formData.get('moduleId') as string
    const customPath = formData.get('customPath') as string
    const generateResponsive = formData.get('generateResponsive') === 'true'
    const generateThumbnails = formData.get('generateThumbnails') === 'true'

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (!moduleId) {
      return NextResponse.json({ error: 'Module ID is required' }, { status: 400 })
    }

    // Validate file type
    if (!CDN_CONFIG.upload.allowedMimeTypes.includes(file.type)) {
      return NextResponse.json({
        error: 'Invalid file type',
        allowed: CDN_CONFIG.upload.allowedMimeTypes,
      }, { status: 400 })
    }

    // Validate file size
    if (file.size > CDN_CONFIG.upload.maxFileSize) {
      return NextResponse.json({
        error: 'File too large',
        maxSize: CDN_CONFIG.upload.maxFileSize,
        actualSize: file.size,
      }, { status: 400 })
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Upload to CDN
    const result = await s3ImageUploader.uploadImage(buffer, {
      moduleId,
      filename: file.name,
      generateResponsive: generateResponsive ?? CDN_CONFIG.images.enableResponsive,
      generateThumbnails: generateThumbnails ?? CDN_CONFIG.upload.generateThumbnails,
      customPath,
      metadata: {
        uploadedBy: 'api',
        originalName: file.name,
        uploadTimestamp: Date.now().toString(),
      },
    })

    if (!result.success) {
      return NextResponse.json({
        error: 'Upload failed',
        details: result.errors,
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      urls: result.urls,
      metadata: result.metadata,
    })

  } catch (error: any) {
    console.error('CDN upload error:', error)
    return NextResponse.json({
      error: error?.message || 'Upload failed',
    }, { status: 500 })
  }
}

// GET - List CDN configuration and status
export async function GET() {
  try {
    const configValidation = validateCDNConfig()
    const isProduction = process.env.NODE_ENV === 'production'
    const cdnEnabled = configValidation.valid && CDN_CONFIG.s3.bucketName

    return NextResponse.json({
      enabled: cdnEnabled,
      production: isProduction,
      config: {
        bucket: CDN_CONFIG.s3.bucketName,
        region: CDN_CONFIG.s3.region,
        cloudfront: {
          enabled: Boolean(CDN_CONFIG.cloudfront.distributionId || CDN_CONFIG.cloudfront.domainName),
          domain: CDN_CONFIG.cloudfront.customDomain || CDN_CONFIG.cloudfront.domainName,
        },
        features: {
          responsiveImages: CDN_CONFIG.images.enableResponsive,
          thumbnails: CDN_CONFIG.upload.generateThumbnails,
          formats: CDN_CONFIG.images.formats,
          sizes: CDN_CONFIG.images.sizes,
        },
      },
      validation: configValidation,
    })

  } catch (error: any) {
    console.error('CDN status error:', error)
    return NextResponse.json({
      error: error?.message || 'Failed to get CDN status',
    }, { status: 500 })
  }
}