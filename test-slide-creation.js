#!/usr/bin/env node

/**
 * Test slide creation directly
 */

async function testSlideCreation() {
  console.log('🧪 Testing slide creation directly...')

  // Test creating a slide directly via Payload API
  const slideData = {
    title: 'Test Slide',
    description: 'This is a test slide created directly',
    type: 'regular',
    urls: [],
    source: {
      pdfFilename: 'test.pdf',
      pdfPage: 1,
      module: 16,
    },
    slug: 'test-slide-m16-p1',
    parent: 16,
    parent_id: 16,
  }

  try {
    const response = await fetch('http://localhost:3000/api/slides', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(slideData),
    })

    console.log(`📡 Response status: ${response.status} ${response.statusText}`)

    if (response.ok) {
      const slide = await response.json()
      console.log('✅ Slide created successfully!')
      console.log(`📄 Slide ID: ${slide.id}`)
      console.log(`📄 Slide title: ${slide.title}`)
    } else {
      const errorText = await response.text()
      console.log('❌ Error creating slide:', errorText)
    }
  } catch (error) {
    console.error('❌ Request failed:', error.message)
  }
}

testSlideCreation().catch(console.error)
