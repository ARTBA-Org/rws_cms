import { CollectionAfterChangeHook } from 'payload'

export const afterUploadPDF: CollectionAfterChangeHook = async ({
  doc,
  req,
  previousDoc,
  operation,
}) => {
  // Only process PDFs on create
  if (operation !== 'create' || doc.mimeType !== 'application/pdf') {
    return doc
  }

  try {
    console.log('🎯 PDF upload detected, triggering background processing...')
    
    // Find the associated module (if any)
    const payload = req.payload
    const modules = await payload.find({
      collection: 'modules',
      where: {
        pdfUpload: {
          equals: doc.id,
        },
      },
      limit: 1,
    })

    if (modules.docs.length === 0) {
      console.log('⚠️ No module found for this PDF upload yet')
      return doc
    }

    const module = modules.docs[0]
    console.log(`📦 Found module ${module.id} for PDF ${doc.id}`)

    // Trigger PDF processing in the background
    const baseUrl = process.env.PAYLOAD_PUBLIC_SERVER_URL || `http://localhost:${process.env.PORT || 3001}`
    const processUrl = `${baseUrl}/api/test-process-module-pdf`
    
    // Use optimized processor with Lambda-friendly config
    const requestBody = {
      moduleId: module.id,
      mediaId: doc.id,
      useOptimized: true,
      processorConfig: {
        maxPages: 5,        // Process up to 5 pages
        timeoutMs: 25000,   // 25 seconds for Lambda
        enableImages: true, // Generate images
        batchSize: 1,       // Process one page at a time
      }
    }

    console.log('🚀 Triggering PDF processing:', requestBody)
    
    // Fire and forget - don't wait for the response
    fetch(processUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    })
      .then(res => res.json())
      .then(result => {
        if (result.success) {
          console.log(`✅ PDF processing completed: ${result.slidesCreated} slides created`)
          if (result.partialSuccess) {
            console.warn(`⚠️ Partial success: processed ${result.pagesProcessed}/${result.totalPages} pages in ${result.timeElapsed}ms`)
          }
        } else {
          console.error('❌ PDF processing failed:', result.errors)
        }
      })
      .catch(error => {
        console.error('❌ Failed to trigger PDF processing:', error)
      })

    return doc
  } catch (error) {
    console.error('❌ Error in afterUploadPDF hook:', error)
    return doc
  }
}