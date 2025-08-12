import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const apiBase = 'https://t9xzxhl1ed.execute-api.us-east-1.amazonaws.com/Prod'

    console.log('[test-lambda] Testing Lambda function...')

    // Test 1: Health check
    const healthRes = await fetch(`${apiBase}/health`)
    const healthData = await healthRes.json()
    console.log('[test-lambda] Health check:', healthData)

    // Test 2: Try to call the PDF endpoint with a simple test
    const testRes = await fetch(`${apiBase}/process-pdf-with-ai`, {
      method: 'POST',
      // Empty body to see what error we get
    })

    const testStatus = testRes.status
    const testText = await testRes.text()
    console.log('[test-lambda] PDF endpoint test:', testStatus, testText)

    // Test 3: Check if we can create a proper FormData request
    const testPdfContent = Buffer.from(
      '%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n2 0 obj\n<<\n/Type /Pages\n/Kids [3 0 R]\n/Count 1\n>>\nendobj\n3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/MediaBox [0 0 612 792]\n>>\nendobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000074 00000 n \n0000000120 00000 n \ntrailer\n<<\n/Size 4\n/Root 1 0 R\n>>\nstartxref\n179\n%%EOF',
    )

    const formData = new FormData()
    const blob = new Blob([testPdfContent], { type: 'application/pdf' })
    formData.append('file', blob, 'test.pdf')

    console.log('[test-lambda] Sending test PDF...')

    const pdfRes = await fetch(`${apiBase}/process-pdf-with-ai`, {
      method: 'POST',
      body: formData,
    })

    const pdfStatus = pdfRes.status
    const pdfText = await pdfRes.text()
    console.log('[test-lambda] PDF processing test:', pdfStatus, pdfText)

    return NextResponse.json({
      success: true,
      tests: {
        health: { status: healthRes.status, data: healthData },
        endpoint: { status: testStatus, response: testText },
        pdf_processing: { status: pdfStatus, response: pdfText },
      },
    })
  } catch (error: any) {
    console.error('[test-lambda] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
