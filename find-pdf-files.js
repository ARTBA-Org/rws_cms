#!/usr/bin/env node

/**
 * Find PDF files in the media collection
 */

async function findPdfFiles() {
  console.log('🔍 Looking for PDF files in media collection...')

  try {
    const response = await fetch(
      'http://localhost:3000/api/media?where[mimeType][equals]=application/pdf&limit=10',
      {
        method: 'GET',
      },
    )

    console.log(`Response: ${response.status} ${response.statusText}`)

    if (response.ok) {
      const data = await response.json()
      console.log(`Found ${data.totalDocs} PDF files:`)

      data.docs?.forEach((doc, index) => {
        console.log(`${index + 1}. ${doc.filename}`)
        console.log(`   ID: ${doc.id}`)
        console.log(`   URL: ${doc.url}`)
        console.log(`   Size: ${doc.filesize} bytes`)
        console.log(`   Created: ${doc.createdAt}`)
        console.log('')
      })

      // Test the first PDF file if available
      if (data.docs?.length > 0) {
        const firstPdf = data.docs[0]
        console.log(`🧪 Testing access to first PDF: ${firstPdf.filename}`)

        const testUrl = `http://localhost:3000${firstPdf.url}`
        console.log(`Testing URL: ${testUrl}`)

        const testResponse = await fetch(testUrl, { method: 'HEAD' })
        console.log(`Test result: ${testResponse.status} ${testResponse.statusText}`)

        if (testResponse.ok) {
          console.log('✅ PDF is accessible!')

          // Now test the PDF processor with this file
          console.log('\n🧪 Testing PDF processor with this file...')
          const processorResponse = await fetch('http://localhost:3000/api/process-pdf-edge', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              moduleId: '16',
              mediaId: firstPdf.id,
              useEdgeFunction: true,
              processorConfig: {
                maxPages: 2,
                enableImages: false,
                enableAI: false,
              },
            }),
          })

          console.log(
            `Processor response: ${processorResponse.status} ${processorResponse.statusText}`,
          )
          const processorResult = await processorResponse.json()
          console.log('Processor result:', JSON.stringify(processorResult, null, 2))
        }
      }
    } else {
      console.error('❌ Failed to fetch media files')
    }
  } catch (error) {
    console.error('❌ Error:', error.message)
  }
}

findPdfFiles().catch(console.error)
