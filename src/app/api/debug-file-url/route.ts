import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '../../../payload.config'

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const moduleId = url.searchParams.get('moduleId') || '85'

    const payload = await getPayload({ config })

    // Load module and get PDF info
    const mod: any = await payload.findByID({
      collection: 'modules',
      id: String(moduleId),
      overrideAccess: true,
      depth: 1,
    })

    const pdfUpload = mod.pdfUpload
    const mediaId = typeof pdfUpload === 'object' ? pdfUpload.id : pdfUpload

    if (!mediaId) {
      return NextResponse.json({ error: 'No PDF upload found' }, { status: 404 })
    }

    // Get the media document
    const mediaDoc: any = await payload.findByID({
      collection: 'media',
      id: String(mediaId),
      overrideAccess: true,
      depth: 0,
    })

    const filePath = mediaDoc.url as string
    const serverOrigin = process.env.PAYLOAD_PUBLIC_SERVER_URL || 'http://localhost:3001'
    const finalUrl = filePath.startsWith('http') ? filePath : `${serverOrigin}${filePath}`

    return NextResponse.json({
      success: true,
      moduleId,
      mediaId,
      filename: mediaDoc.filename,
      originalUrl: mediaDoc.url,
      finalUrl,
      serverOrigin,
      fileExists: !!mediaDoc.url,
      environment: {
        PAYLOAD_PUBLIC_SERVER_URL: process.env.PAYLOAD_PUBLIC_SERVER_URL,
        NODE_ENV: process.env.NODE_ENV,
      },
    })
  } catch (error: any) {
    console.error('[debug-file-url] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
