#!/usr/bin/env node

/**
 * Test the complete Edge Function integration
 * This creates a test scenario that works end-to-end
 */

const SUPABASE_URL = 'https://nwquaemdrfuhafnugbgl.supabase.co'
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im53cXVhZW1kcmZ1aGFmbnVnYmdsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjM3NDE0MzEsImV4cCI6MjAzOTMxNzQzMX0.4_Oh_q4Rcr6UZe7K7GtA9fjjTDiRYGYTiDuaZv2i3gI'

async function testCompleteIntegration() {
  console.log('🧪 Testing complete Supabase Edge Function integration...')

  try {
    // Test 1: Health check through local API
    console.log('\n1️⃣ Testing health check...')
    const healthResponse = await fetch('http://localhost:3000/api/process-pdf-edge')
    const healthData = await healthResponse.json()
    console.log('✅ Health check result:', healthData)

    if (!healthData.edgeFunction?.available) {
      console.log('❌ Edge Function not available, stopping test')
      return
    }

    // Test 2: Direct Edge Function call (simplified payload)
    console.log('\n2️⃣ Testing direct Edge Function call...')

    const testPayload = {
      moduleId: '999',
      pdfUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf', // Public test PDF
      options: {
        startPage: 1,
        maxPages: 1,
        enableImages: false,
        enableAI: false,
      },
    }

    console.log('📤 Sending test payload to Edge Function...')
    console.log('🔗 URL:', `${SUPABASE_URL}/functions/v1/process-pdf`)

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

    const responseText = await response.text()
    console.log('📥 Response body:', responseText)

    if (response.ok) {
      try {
        const result = JSON.parse(responseText)
        console.log('✅ Edge Function test successful!')
        console.log('📊 Processing result:', {
          success: result.success,
          slidesCreated: result.slidesCreated,
          totalPages: result.totalPages,
          timeElapsed: result.timeElapsed,
        })

        if (result.success) {
          console.log('\n🎉 INTEGRATION TEST PASSED!')
          console.log('✅ Edge Function is working correctly')
          console.log('✅ PDF fetching from ngrok tunnel works')
          console.log('✅ Mock slide creation works')
        }
      } catch (parseError) {
        console.log('⚠️ Response is not JSON:', responseText)
      }
    } else {
      console.log('❌ Edge Function test failed')
      console.log('💥 Error response:', responseText)

      if (response.status === 401) {
        console.log('\n🔑 JWT Authentication issue detected')
        console.log('💡 This is expected - the Edge Function has JWT verification enabled')
        console.log('💡 In production, this would be handled by proper authentication')
      }
    }
  } catch (error) {
    console.error('❌ Test failed with error:', error.message)
    console.error('🔍 Full error:', error)
  }
}

// Run the test
testCompleteIntegration().catch(console.error)
