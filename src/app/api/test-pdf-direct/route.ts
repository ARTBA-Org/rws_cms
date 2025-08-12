import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '../../../payload.config'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const moduleId = body.moduleId || '85'

    console.log(`[test-pdf-direct] Testing direct PDF processing for module ${moduleId}`)

    // Create a test PDF content
    const testPdfContent = Buffer.from(`%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj
2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj
3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
/Contents 4 0 R
/Resources <<
/Font <<
/F1 <<
/Type /Font
/Subtype /Type1
/BaseFont /Helvetica
>>
>>
>>
>>
endobj
4 0 obj
<<
/Length 150
>>
stream
BT
/F1 24 Tf
100 700 Td
(Test PDF Content) Tj
0 -50 Td
/F1 12 Tf
(This is a test slide for debugging) Tj
0 -20 Td
(Key points: API Testing, Lambda Integration) Tj
0 -20 Td
(Action items: Fix timeout issues, Deploy improvements) Tj
ET
endstream
endobj
xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000330 00000 n 
trailer
<<
/Size 5
/Root 1 0 R
>>
startxref
531
%%EOF`)

    const apiBase = 'https://t9xzxhl1ed.execute-api.us-east-1.amazonaws.com/Prod'

    // Create FormData for the Lambda function
    const formData = new FormData()
    const blob = new Blob([testPdfContent], { type: 'application/pdf' })
    formData.append('file', blob, 'test-debug.pdf')

    console.log(`[test-pdf-direct] Calling Lambda at: ${apiBase}/process-pdf-with-ai`)

    // Call the Lambda function
    const aiRes = await fetch(`${apiBase}/process-pdf-with-ai`, {
      method: 'POST',
      body: formData,
      cache: 'no-store',
    })

    if (!aiRes.ok) {
      const txt = await aiRes.text()
      console.error('[test-pdf-direct] Lambda call failed:', aiRes.status, txt)
      return NextResponse.json(
        { error: `AI processing failed: ${aiRes.status} ${aiRes.statusText} - ${txt}` },
        { status: 502 },
      )
    }

    const ai = await aiRes.json()
    console.log('[test-pdf-direct] Lambda response:', ai)

    if (!ai.success || !ai.results) {
      return NextResponse.json(
        { error: 'Invalid response from AI processing service' },
        { status: 502 },
      )
    }

    const results = ai.results
    console.log(`[test-pdf-direct] Processing ${results.length} pages`)

    // Now try to create slides using Payload
    const payload = await getPayload({ config })

    const slideIds: Array<number | string> = []
    let slidesCreated = 0

    for (const result of results) {
      try {
        const pageNum = result.page
        const analysis = result.analysis

        console.log(`[test-pdf-direct] Creating slide for page ${pageNum}:`, analysis)

        const slide = await payload.create({
          collection: 'slides',
          data: {
            title: analysis.title || `Test PDF - Page ${pageNum}`,
            description: analysis.summary || `Test slide content for page ${pageNum}`,
            type: 'regular',
            image: null, // No image for test
            urls: [],
          },
          overrideAccess: true,
          depth: 0,
        })

        slideIds.push(slide.id)
        slidesCreated++
        console.log(`[test-pdf-direct] Created slide ${slide.id} for page ${pageNum}`)
      } catch (err) {
        console.error(`[test-pdf-direct] Failed to create slide for page ${result.page}:`, err)
      }
    }

    // Update module with new slides
    try {
      const currentModule = await payload.findByID({
        collection: 'modules',
        id: String(moduleId),
        overrideAccess: true,
      })

      const previousSlides = (currentModule as any).slides || []
      const nextSlides = [...previousSlides, ...slideIds] as any

      await payload.update({
        collection: 'modules',
        id: String(moduleId),
        data: { slides: nextSlides },
        overrideAccess: true,
        depth: 0,
      })

      console.log(`[test-pdf-direct] Updated module ${moduleId} with ${slidesCreated} new slides`)
    } catch (updateError) {
      console.error(`[test-pdf-direct] Failed to update module:`, updateError)
    }

    return NextResponse.json({
      success: true,
      slidesCreated,
      page_count: ai.page_count || results.length,
      totalPages: results.length,
      processed: results.map((r: any) => r.page),
      mode: 'test-direct',
      lambdaResponse: ai,
    })
  } catch (e: any) {
    console.error('[test-pdf-direct] error:', e)
    return NextResponse.json({ error: e?.message || 'Internal error' }, { status: 500 })
  }
}
