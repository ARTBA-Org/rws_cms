import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '../../../payload.config'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const moduleId = body.moduleId || '85'

    console.log(`[debug-pdf-content] Debugging PDF content for module ${moduleId}`)

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

    console.log(`[debug-pdf-content] Fetching PDF from: ${finalUrl}`)

    // Try to fetch the PDF
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout for debug

    try {
      const bufRes = await fetch(finalUrl, {
        cache: 'no-store',
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!bufRes.ok) {
        return NextResponse.json({
          success: false,
          error: `Failed to fetch PDF: ${bufRes.status} ${bufRes.statusText}`,
          finalUrl,
          mediaDoc: {
            id: mediaDoc.id,
            filename: mediaDoc.filename,
            url: mediaDoc.url,
            mimeType: mediaDoc.mimeType,
            filesize: mediaDoc.filesize,
          },
        })
      }

      const pdfBuffer = Buffer.from(await bufRes.arrayBuffer())

      // Check if it's actually a PDF
      const isPdf = pdfBuffer.toString('ascii', 0, 4) === '%PDF'
      const fileHeader = pdfBuffer.toString('ascii', 0, 20)

      console.log(`[debug-pdf-content] PDF fetched: ${pdfBuffer.length} bytes, isPdf: ${isPdf}`)

      // Now test sending this to Lambda
      const apiBase = 'https://t9xzxhl1ed.execute-api.us-east-1.amazonaws.com/Prod'

      const formData = new FormData()
      const blob = new Blob([pdfBuffer], { type: 'application/pdf' })
      formData.append('file', blob, mediaDoc.filename || 'document.pdf')

      console.log(`[debug-pdf-content] Sending to Lambda: ${blob.size} bytes`)

      const aiRes = await fetch(`${apiBase}/process-pdf-with-ai`, {
        method: 'POST',
        body: formData,
        cache: 'no-store',
      })

      const aiStatus = aiRes.status
      const aiResponse = await aiRes.text()

      let aiData
      try {
        aiData = JSON.parse(aiResponse)
      } catch {
        aiData = { raw: aiResponse }
      }

      return NextResponse.json({
        success: true,
        debug: {
          pdfFetch: {
            url: finalUrl,
            size: pdfBuffer.length,
            isPdf,
            fileHeader,
          },
          lambdaCall: {
            status: aiStatus,
            response: aiData,
            blobSize: blob.size,
          },
          mediaInfo: {
            id: mediaDoc.id,
            filename: mediaDoc.filename,
            url: mediaDoc.url,
            mimeType: mediaDoc.mimeType,
            filesize: mediaDoc.filesize,
          },
        },
      })
    } catch (fetchError: any) {
      clearTimeout(timeoutId)
      return NextResponse.json({
        success: false,
        error: `Fetch error: ${fetchError.message}`,
        finalUrl,
        errorType: fetchError.name,
      })
    }
  } catch (e: any) {
    console.error('[debug-pdf-content] error:', e)
    return NextResponse.json({ error: e?.message || 'Internal error' }, { status: 500 })
  }
}
