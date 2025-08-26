#!/usr/bin/env node

/**
 * Test with the specific High Visibility Clothing PDF
 */

async function testSpecificPdf() {
  console.log('🧪 Testing with High Visibility Clothing PDF...')

  const testData = {
    moduleId: '16',
    mediaId: '143', // High Visibility Clothing Deck.pdf
    useEdgeFunction: true,
    processorConfig: {
      maxPages: 5,
      timeoutMs: 120000,
      enableImages: true,
      enableAI: true,
    },
  }

  try {
    const response = await fetch('http://localhost:3000/api/process-pdf-edge', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData),
    })

    console.log(`📡 Response status: ${response.status} ${response.statusText}`)

    const result = await response.json()
    console.log('📄 Response:', JSON.stringify(result, null, 2))

    if (response.ok && result.success) {
      console.log('✅ PDF processing successful!')
      console.log(`📊 Slides created: ${result.slidesCreated}`)
      console.log(`📄 Total pages: ${result.totalPages}`)
      console.log(`⏱️ Processing time: ${result.timeElapsed}ms`)
    } else {
      console.log('❌ PDF processing failed:', result.error)
    }
  } catch (error) {
    console.error('❌ Test failed:', error.message)
  }
}

testSpecificPdf().catch(console.error)
