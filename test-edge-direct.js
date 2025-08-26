#!/usr/bin/env node

// Direct test of Supabase Edge Function with public PDF
import fetch from 'node-fetch'

async function testEdgeFunction() {
  console.log('🧪 Testing Supabase Edge Function directly...')

  const edgeFunctionUrl = 'https://nwquaemdrfuhafnugbgl.supabase.co/functions/v1/process-pdf'

  // Test payload with a publicly accessible PDF
  const testPayload = {
    moduleId: '16',
    pdfUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf', // Public test PDF
    processorConfig: {
      maxPages: 2,
      enableImages: false, // Disable images for faster testing
      startPage: 1,
    },
    payloadApiUrl: 'https://your-app-url.com', // This will fail but we can see the function logic
  }

  try {
    console.log('📡 Calling Edge Function:', edgeFunctionUrl)
    console.log('📋 Payload:', JSON.stringify(testPayload, null, 2))

    const response = await fetch(edgeFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization:
          'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im53cXVhZW1kcmZ1aGFmbnVnYmdsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjM3NDE0MzEsImV4cCI6MjAzOTMxNzQzMX0.4_Oh_q4Rcr6UZe7K7GtA9fjjTDiRYGYTiDuaZv2i3gI',
      },
      body: JSON.stringify(testPayload),
    })

    console.log('📊 Response Status:', response.status)
    console.log('📊 Response Headers:', Object.fromEntries(response.headers.entries()))

    const result = await response.text()
    console.log('📊 Response Body:', result)

    if (response.ok) {
      console.log('✅ Edge Function is working!')
    } else {
      console.log('❌ Edge Function returned error')
    }
  } catch (error) {
    console.error('❌ Error calling Edge Function:', error.message)
  }
}

testEdgeFunction()
