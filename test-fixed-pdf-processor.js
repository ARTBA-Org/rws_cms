#!/usr/bin/env node

/**
 * Test the fixed PDF processor end-to-end
 */

async function testFixedProcessor() {
  console.log('🧪 Testing fixed PDF processor...')

  const testData = {
    moduleId: '16',
    mediaId: undefined,
    useEdgeFunction: true,
    processorConfig: {
      maxPages: 2,
      timeoutMs: 120000,
      enableImages: false,
      enableAI: false,
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
    } else {
      console.log('❌ PDF processing failed:', result.error)
    }
  } catch (error) {
    console.error('❌ Test failed:', error.message)
  }
}

testFixedProcessor().catch(console.error)
