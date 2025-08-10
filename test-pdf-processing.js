// Simple test script to debug PDF processing
// Run with: node test-pdf-processing.js

const moduleId = process.argv[2] || '1' // Pass module ID as argument

async function testPdfProcessing() {
  try {
    console.log('🧪 Testing PDF processing for module:', moduleId)

    const response = await fetch('http://localhost:3001/api/test-pdf-debug', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ moduleId }),
    })

    const result = await response.json()

    if (response.ok) {
      console.log('✅ Test successful:', result)
    } else {
      console.error('❌ Test failed:', result)
    }
  } catch (error) {
    console.error('❌ Network error:', error.message)
  }
}

testPdfProcessing()
