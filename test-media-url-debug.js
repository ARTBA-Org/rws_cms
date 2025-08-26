#!/usr/bin/env node

/**
 * Debug media URL accessibility
 */

async function debugMediaUrl() {
  console.log('🔍 Debugging media URL accessibility...')

  // Test the health endpoint first
  try {
    console.log('1. Testing health endpoint...')
    const healthResponse = await fetch('http://localhost:3000/api/process-pdf-edge', {
      method: 'GET',
    })
    console.log(`Health check: ${healthResponse.status} ${healthResponse.statusText}`)
    const healthData = await healthResponse.json()
    console.log('Health data:', JSON.stringify(healthData, null, 2))
  } catch (error) {
    console.error('❌ Health check failed:', error.message)
    console.log('💡 Make sure your development server is running: npm run dev')
    return
  }

  // Test direct media URL access
  const testUrls = [
    'http://localhost:3000/api/media/file/High%20Visibility%20Clothing%20Deck.pdf',
    'https://0193e912ccb5.ngrok-free.app/api/media/file/High%20Visibility%20Clothing%20Deck.pdf',
    'http://localhost:3000/api/media/file/High Visibility Clothing Deck.pdf',
  ]

  for (const url of testUrls) {
    console.log(`\n2. Testing URL: ${url}`)
    try {
      const response = await fetch(url, {
        method: 'HEAD',
        headers: {
          'ngrok-skip-browser-warning': 'true',
        },
      })
      console.log(`   Status: ${response.status} ${response.statusText}`)
      console.log(`   Content-Type: ${response.headers.get('content-type')}`)
      console.log(`   Content-Length: ${response.headers.get('content-length')}`)
    } catch (error) {
      console.error(`   ❌ Failed: ${error.message}`)
    }
  }

  // Test the Payload API directly
  console.log('\n3. Testing Payload API...')
  try {
    const response = await fetch('http://localhost:3000/api/media?limit=5', {
      method: 'GET',
    })
    console.log(`Payload API: ${response.status} ${response.statusText}`)
    if (response.ok) {
      const data = await response.json()
      console.log('Recent media files:')
      data.docs?.slice(0, 3).forEach((doc) => {
        console.log(`  - ${doc.filename} (${doc.mimeType}) - URL: ${doc.url}`)
      })
    }
  } catch (error) {
    console.error('❌ Payload API failed:', error.message)
  }
}

debugMediaUrl().catch(console.error)
