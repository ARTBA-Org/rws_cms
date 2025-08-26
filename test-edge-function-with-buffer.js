#!/usr/bin/env node

/**
 * Test script for Supabase Edge Function using PDF buffer instead of URL
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const SUPABASE_URL = 'https://nwquaemdrfuhafnugbgl.supabase.co'
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im53cXVhZW1kcmZ1aGFmbnVnYmdsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjM3NDE0MzEsImV4cCI6MjAzOTMxNzQzMX0.4_Oh_q4Rcr6UZe7K7GtA9fjjTDiRYGYTiDuaZv2i3gI'

async function testEdgeFunctionWithBuffer() {
  console.log('🧪 Testing Supabase Edge Function with PDF buffer...')

  const edgeFunctionUrl = `${SUPABASE_URL}/functions/v1/process-pdf`

  // Use the sample PDF file
  const pdfPath = path.join(__dirname, 'sample-local-pdf.pdf')

  if (!fs.existsSync(pdfPath)) {
    console.error('❌ Sample PDF not found at:', pdfPath)
    return
  }

  // Read PDF file as buffer
  const pdfBuffer = fs.readFileSync(pdfPath)
  console.log(`📄 Loaded PDF buffer (${pdfBuffer.length} bytes)`)

  const testRequest = {
    moduleId: '16',
    pdfBuffer: Array.from(pdfBuffer), // Convert to array for JSON serialization
    options: {
      startPage: 1,
      maxPages: 2,
      enableImages: false,
      enableAI: false,
    },
  }

  console.log('📤 Sending request to Edge Function...')
  console.log('🔗 URL:', edgeFunctionUrl)
  console.log('📋 Request size:', JSON.stringify(testRequest).length, 'bytes')

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

async function main() {
  await testEdgeFunctionWithBuffer()
}

main().catch(console.error)
