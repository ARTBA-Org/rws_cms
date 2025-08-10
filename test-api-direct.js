// Test the API directly
// Run with: node test-api-direct.js <moduleId>

const moduleId = process.argv[2] || '81' // Use your module ID

async function testApi() {
  try {
    console.log('🧪 Testing API for module:', moduleId)

    const response = await fetch('http://localhost:3001/api/test-process-module-pdf', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ moduleId }),
    })

    console.log('📋 Response status:', response.status)

    const result = await response.json()
    console.log('📋 Response body:', JSON.stringify(result, null, 2))

    if (response.ok) {
      console.log('✅ API test successful!')
    } else {
      console.log('❌ API test failed')
    }
  } catch (error) {
    console.error('❌ Network error:', error.message)
  }
}

testApi()
