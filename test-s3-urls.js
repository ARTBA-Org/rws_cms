#!/usr/bin/env node

/**
 * Test S3 URLs directly
 */

async function testS3Urls() {
  console.log('🔍 Testing S3 URLs directly...')

  try {
    // Get a PDF file from the API
    const response = await fetch(
      'http://localhost:3000/api/media?where[mimeType][equals]=application/pdf&limit=1',
      {
        method: 'GET',
      },
    )

    if (!response.ok) {
      console.error('❌ Failed to fetch media files')
      return
    }

    const data = await response.json()
    if (!data.docs || data.docs.length === 0) {
      console.error('❌ No PDF files found')
      return
    }

    const pdfFile = data.docs[0]
    console.log('📄 PDF File Info:')
    console.log(`  Filename: ${pdfFile.filename}`)
    console.log(`  ID: ${pdfFile.id}`)
    console.log(`  URL: ${pdfFile.url}`)
    console.log(`  Size: ${pdfFile.filesize} bytes`)

    // Check if there's a direct S3 URL
    if (pdfFile.url && pdfFile.url.includes('supabase.co')) {
      console.log('\n🔗 Direct S3 URL found!')
      console.log(`Testing S3 URL: ${pdfFile.url}`)

      const s3Response = await fetch(pdfFile.url, { method: 'HEAD' })
      console.log(`S3 Response: ${s3Response.status} ${s3Response.statusText}`)

      if (s3Response.ok) {
        console.log('✅ S3 URL is accessible!')

        // Test the PDF processor with the S3 URL directly
        console.log('\n🧪 Testing PDF processor with S3 URL...')

        // Create a modified processor that uses the S3 URL directly
        const testRequest = {
          moduleId: '16',
          mediaId: pdfFile.id,
          useEdgeFunction: true,
          processorConfig: {
            maxPages: 2,
            enableImages: false,
            enableAI: false,
          },
        }

        const processorResponse = await fetch('http://localhost:3000/api/process-pdf-edge', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(testRequest),
        })

        console.log(
          `Processor response: ${processorResponse.status} ${processorResponse.statusText}`,
        )
        const processorResult = await processorResponse.json()
        console.log('Processor result:', JSON.stringify(processorResult, null, 2))
      }
    } else {
      console.log('\n⚠️ No direct S3 URL found, URL is relative')

      // Try to construct the full S3 URL
      const s3BaseUrl = 'https://nwquaemdrfuhafnugbgl.supabase.co/storage/v1/object/public/Media'
      const s3Url = `${s3BaseUrl}/${pdfFile.filename}`

      console.log(`Trying constructed S3 URL: ${s3Url}`)

      const s3Response = await fetch(s3Url, { method: 'HEAD' })
      console.log(`S3 Response: ${s3Response.status} ${s3Response.statusText}`)

      if (s3Response.ok) {
        console.log('✅ Constructed S3 URL works!')
      } else {
        // Try with the media prefix
        const s3UrlWithPrefix = `${s3BaseUrl}/media/${pdfFile.filename}`
        console.log(`Trying with media prefix: ${s3UrlWithPrefix}`)

        const s3Response2 = await fetch(s3UrlWithPrefix, { method: 'HEAD' })
        console.log(`S3 Response: ${s3Response2.status} ${s3Response2.statusText}`)
      }
    }
  } catch (error) {
    console.error('❌ Error:', error.message)
  }
}

testS3Urls().catch(console.error)
