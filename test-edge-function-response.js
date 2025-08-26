#!/usr/bin/env node

/**
 * Test Edge Function response structure
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const SUPABASE_URL = 'https://nwquaemdrfuhafnugbgl.supabase.co'
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im53cXVhZW1kcmZ1aGFmbnVnYmdsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjM3NDE0MzEsImV4cCI6MjAzOTMxNzQzMX0.4_Oh_q4Rcr6UZe7K7GtA9fjjTDiRYGYTiDuaZv2i3gI'

async function testEdgeFunctionResponse() {
  console.log('🔍 Testing Edge Function response structure...')

  const pdfPath = path.join(__dirname, 'sample-local-pdf.pdf')

  if (!fs.existsSync(pdfPath)) {
    console.error('❌ Sample PDF not found at:', pdfPath)
    return
  }

  const pdfBuffer = fs.readFileSync(pdfPath)
  console.log(`📄 Local PDF buffer size: ${pdfBuffer.length} bytes`)

  const edgeFunctionUrl = `${SUPABASE_URL}/functions/v1/process-pdf`

  const testRequest = {
    moduleId: '16',
    pdfBuffer: Array.from(pdfBuffer),
    options: {
      startPage: 1,
      maxPages: 2,
      enableImages: false,
      enableAI: true, // Enable AI to get better slide data
    },
  }

  console.log('📤 Sending request to Edge Function...')

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

    if (response.ok) {
      const result = await response.json()
      console.log('✅ Success!')
      console.log('📊 Response structure:')
      console.log(`  - success: ${result.success}`)
      console.log(`  - totalPages: ${result.totalPages}`)
      console.log(`  - pagesProcessed: ${result.pagesProcessed}`)
      console.log(
        `  - extractedSlides: ${result.extractedSlides ? result.extractedSlides.length : 'undefined'} slides`,
      )

      if (result.extractedSlides && result.extractedSlides.length > 0) {
        console.log('\n📄 Extracted slides:')
        result.extractedSlides.forEach((slide, index) => {
          console.log(`  ${index + 1}. Page ${slide.pageNumber}: "${slide.title}"`)
          console.log(`     Type: ${slide.type}`)
          console.log(`     Description: ${slide.description.substring(0, 100)}...`)
          console.log(`     Text length: ${slide.text.length} characters`)
        })
      } else {
        console.log('❌ No extractedSlides found in response')
      }
    } else {
      const errorText = await response.text()
      console.log('❌ Error response:', errorText)
    }
  } catch (error) {
    console.error('❌ Request failed:', error.message)
  }
}

testEdgeFunctionResponse().catch(console.error)
