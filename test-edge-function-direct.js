#!/usr/bin/env node

/**
 * Test script to directly call the Supabase Edge Function
 * This bypasses the local API and tests the Edge Function directly
 */

const SUPABASE_URL = 'https://nwquaemdrfuhafnugbgl.supabase.co'
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im53cXVhZW1kcmZ1aGFmbnVnYmdsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjM3NDQ0MzIsImV4cCI6MjAzOTMyMDQzMn0.ByYzgCKhGKCJBBWlCNNVfUYFOLYOGcUGU2pHOGNWKJQ'

async function testEdgeFunction() {
  console.log('🧪 Testing Supabase Edge Function directly...')

  try {
    const testPayload = {
      moduleId: '123',
      pdfUrl:
        'https://0193e912ccb5.ngrok-free.app/api/media/file/High%20Visibility%20Clothing%20Deck.pdf',
      options: {
        startPage: 1,
        maxPages: 2,
        enableImages: false,
        enableAI: false,
      },
    }

    console.log('📤 Sending request to Edge Function...')
    console.log('🔗 URL:', `${SUPABASE_URL}/functions/v1/process-pdf`)
    console.log('📋 Payload:', JSON.stringify(testPayload, null, 2))

    const response = await fetch(`${SUPABASE_URL}/functions/v1/process-pdf`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify(testPayload),
    })

    console.log('📥 Response status:', response.status)
    console.log('📥 Response headers:', Object.fromEntries(response.headers.entries()))

    const responseText = await response.text()
    console.log('📥 Response body:', responseText)

    if (response.ok) {
      try {
        const result = JSON.parse(responseText)
        console.log('✅ Edge Function test successful!')
        console.log('📊 Result:', JSON.stringify(result, null, 2))
      } catch (parseError) {
        console.log('⚠️ Response is not JSON:', responseText)
      }
    } else {
      console.log('❌ Edge Function test failed')
      console.log('💥 Error response:', responseText)
    }
  } catch (error) {
    console.error('❌ Test failed with error:', error.message)
    console.error('🔍 Full error:', error)
  }
}

// Run the test
testEdgeFunction().catch(console.error)
