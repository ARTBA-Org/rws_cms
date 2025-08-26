#!/usr/bin/env node

/**
 * Test script for the improved Supabase Edge Function
 */

const SUPABASE_URL = 'https://nwquaemdrfuhafnugbgl.supabase.co'
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im53cXVhZW1kcmZ1aGFmbnVnYmdsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjM3MzY2MzEsImV4cCI6MjAzOTMxMjYzMX0.Ej5rJNqzqJOXWBHWJBOKNGvKjHqJQqJQqJQqJQqJQqI'

async function testEdgeFunction() {
  console.log('🧪 Testing improved Supabase Edge Function...')

  const edgeFunctionUrl = `${SUPABASE_URL}/functions/v1/process-pdf`

  // Test with the problematic URL
  const testRequest = {
    moduleId: '16',
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
  console.log('🔗 URL:', edgeFunctionUrl)
  console.log('📋 Request:', JSON.stringify(testRequest, null, 2))

  try {
    const response = await fetch(edgeFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify(testRequest),
    })

    console.log(`📡 Response status: ${response.status} ${response.statusText}`)

    const responseText = await response.text()
    console.log('📄 Response body:', responseText)

    if (response.ok) {
      const result = JSON.parse(responseText)
      console.log('✅ Success:', result)
    } else {
      console.log('❌ Error response:', responseText)
    }
  } catch (error) {
    console.error('❌ Request failed:', error.message)
  }
}

// Also test direct URL access
async function testDirectUrlAccess() {
  console.log('\n🔍 Testing direct URL access...')

  const testUrl =
    'https://0193e912ccb5.ngrok-free.app/api/media/file/High%20Visibility%20Clothing%20Deck.pdf'

  try {
    const response = await fetch(testUrl, {
      headers: {
        'ngrok-skip-browser-warning': 'true',
        'User-Agent': 'Test-Script/1.0',
      },
    })

    console.log(`📡 Direct access status: ${response.status} ${response.statusText}`)
    console.log('📋 Response headers:', Object.fromEntries(response.headers.entries()))

    if (response.ok) {
      const buffer = await response.arrayBuffer()
      console.log(`✅ Successfully fetched PDF (${buffer.byteLength} bytes)`)

      // Check if it's a valid PDF
      const pdfHeader = new TextDecoder().decode(new Uint8Array(buffer.slice(0, 4)))
      console.log(`📄 PDF header: "${pdfHeader}"`)

      if (pdfHeader === '%PDF') {
        console.log('✅ Valid PDF file confirmed')
      } else {
        console.log('❌ Not a valid PDF file')
      }
    } else {
      const errorText = await response.text()
      console.log('❌ Error:', errorText.substring(0, 500))
    }
  } catch (error) {
    console.error('❌ Direct access failed:', error.message)
  }
}

async function main() {
  await testDirectUrlAccess()
  await testEdgeFunction()
}

main().catch(console.error)
