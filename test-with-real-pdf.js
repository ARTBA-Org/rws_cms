#!/usr/bin/env node

// Test Edge Function with your actual PDF from the media collection
import fetch from 'node-fetch'

async function testWithRealPdf() {
  console.log('🧪 Testing Edge Function with your real PDF...')

  // First, let's get the media info for your PDF
  const mediaResponse = await fetch('http://localhost:3000/api/media/143', {
    headers: {
      'Content-Type': 'application/json',
    },
  })

  if (!mediaResponse.ok) {
    console.log('❌ Could not fetch media info')
    return
  }

  const media = await mediaResponse.json()
  console.log('📁 Media Info:', {
    id: media.id,
    filename: media.filename,
    url: media.url,
    mimeType: media.mimeType,
  })

  // Now test the Edge Function with a mock callback URL
  const edgeFunctionUrl = 'https://nwquaemdrfuhafnugbgl.supabase.co/functions/v1/process-pdf'

  const testPayload = {
    moduleId: '16',
    pdfUrl: `http://localhost:3000${media.url}`, // This will fail from Supabase, but we can see the logic
    processorConfig: {
      maxPages: 3,
      enableImages: false, // Keep images off for faster testing
      startPage: 1,
    },
    payloadApiUrl: 'http://localhost:3000', // This will also fail, but we can see what happens
  }

  try {
    console.log('📡 Testing Edge Function with real PDF...')
    console.log('📋 PDF URL:', testPayload.pdfUrl)

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
    const result = await response.text()
    console.log('📊 Response Body:', result)

    if (response.ok) {
      console.log('✅ Edge Function processed the request!')
      const data = JSON.parse(result)
      console.log('📊 Processing Summary:', {
        success: data.success,
        slidesCreated: data.slidesCreated,
        totalPages: data.totalPages,
        pagesProcessed: data.pagesProcessed,
        timeElapsed: data.timeElapsed + 'ms',
        error: data.error || 'none',
      })
    } else {
      console.log('❌ Edge Function returned error')
    }
  } catch (error) {
    console.error('❌ Error:', error.message)
  }
}

testWithRealPdf()

