import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '../../../payload.config'
import type { PopulatedModule } from '../../../types/pdfTypes'

export async function POST(request: NextRequest) {
  try {
    const { moduleId, instruction = null } = await request.json()
    if (!moduleId) {
      return NextResponse.json({ error: 'moduleId is required' }, { status: 400 })
    }

    const payload = await getPayload({ config })

    // Load module and ensure pdfUpload exists
    const mod = await payload.findByID({ 
      collection: 'modules', 
      id: String(moduleId),
      depth: 1 // Populate pdfUpload 
    }) as PopulatedModule
    
    const pdfUpload = mod.pdfUpload
    const mediaId = typeof pdfUpload === 'object' ? pdfUpload?.id : pdfUpload
    if (!mediaId) {
      return NextResponse.json({ error: 'Module has no pdfUpload set' }, { status: 400 })
    }

    // Get the media document
    const mediaDoc = await payload.findByID({
      collection: 'media',
      id: String(mediaId),
    })
    if (!mediaDoc?.url) {
      return NextResponse.json({ error: 'Media file has no accessible URL' }, { status: 400 })
    }

    // Get file buffer directly from Payload
    let pdfBuffer: Buffer
    
    try {
      // Try to get file buffer directly from the media document
      if (typeof mediaDoc.url === 'string' && mediaDoc.url.startsWith('http')) {
        // External URL (S3, etc.) - fetch directly
        const res = await fetch(mediaDoc.url)
        if (!res.ok) {
          throw new Error(`Failed to fetch from external URL: ${res.status} ${res.statusText}`)
        }
        const ab = await res.arrayBuffer()
        pdfBuffer = Buffer.from(ab)
      } else {
        // Local file - construct proper URL and fetch with session
        const SERVER_ORIGIN = process.env.PAYLOAD_PUBLIC_SERVER_URL || `http://localhost:3000`
        const fileUrl = mediaDoc.url.startsWith('/') 
          ? `${SERVER_ORIGIN}${mediaDoc.url}` 
          : `${SERVER_ORIGIN}/${mediaDoc.url}`
        
        console.log('Attempting to fetch PDF from:', fileUrl)
        
        const cookie = request.headers.get('cookie') || ''
        const res = await fetch(fileUrl, { 
          headers: cookie ? { cookie } : undefined,
          // Add user agent to avoid potential blocks
          ...(!cookie && { headers: { 'User-Agent': 'PayloadCMS-Internal' } })
        })
        
        if (!res.ok) {
          throw new Error(`Failed to fetch PDF: ${res.status} ${res.statusText} from ${fileUrl}`)
        }
        
        const ab = await res.arrayBuffer()
        pdfBuffer = Buffer.from(ab)
      }
    } catch (error: any) {
      console.error('Error fetching PDF file:', error)
      return NextResponse.json(
        { error: `Failed to access PDF file: ${error.message}` },
        { status: 502 },
      )
    }

    // Create FormData for the external PDF extractor API
    const formData = new FormData()
    const pdfBlob = new Blob([pdfBuffer], { type: 'application/pdf' })
    formData.append('file', pdfBlob, mediaDoc.filename || 'module.pdf')
    formData.append('module_id', String(moduleId))
    
    // Specify fields for slide extraction
    const slideFields = ['Title', 'Description', 'Type', 'Content', 'Notes']
    formData.append('fields', JSON.stringify(slideFields))
    
    // Add instruction for better extraction
    const defaultInstruction = 'Extract slide content from this PDF. For each page, identify the Title (main heading), Description (summary or key points), Type (regular/video/quiz/reference/resources), Content (main body text), and Notes (any additional information).'
    formData.append('instruction', instruction || defaultInstruction)

    // Call external PDF extractor API for extraction only (no Payload integration)
    const PDF_EXTRACTOR_URL = process.env.PDF_EXTRACTOR_URL || 'http://localhost:8000'
    formData.append('create_in_payload', 'false')  // Just extract data, don't create in Payload
    formData.append('return_images', 'true')  // Request images to be returned

    const extractorResponse = await fetch(`${PDF_EXTRACTOR_URL}/ingest`, {
      method: 'POST',
      body: formData,
    })

    if (!extractorResponse.ok) {
      const errorText = await extractorResponse.text()
      return NextResponse.json(
        { error: `PDF extractor failed: ${extractorResponse.status} - ${errorText}` },
        { status: 500 }
      )
    }

    const extractorResult = await extractorResponse.json()
    
    console.log('Extractor result:', JSON.stringify(extractorResult, null, 2))

    if (!extractorResult.extracted) {
      return NextResponse.json(
        { error: 'No data extracted from PDF' },
        { status: 500 }
      )
    }

    // Create slides in Payload using the extracted data
    const slideIds: string[] = []
    const results = []
    
    // Get the slides array from the extracted data
    const extractedSlides = extractorResult.extracted?.slides || 
                           extractorResult.extracted?.pages || 
                           [extractorResult.extracted]

    // For each extracted slide/page, create a slide in Payload
    for (let i = 0; i < extractorResult.pages_processed; i++) {
      const pageData = extractedSlides[i] || {}
      
      console.log(`Processing page ${i + 1}:`, JSON.stringify(pageData, null, 2))
      
      const title = pageData.Title || pageData.title || pageData.TITLE || `Page ${i + 1}`
      const description = pageData.Description || pageData.description || pageData.Content || pageData.content || ''
      const type = (pageData.Type || pageData.type || 'regular').toLowerCase()
      
      // Upload page image if available
      let imageId = null
      if (extractorResult.page_images && extractorResult.page_images[i]) {
        try {
          const imageBase64 = extractorResult.page_images[i]
          const imageBuffer = Buffer.from(imageBase64, 'base64')
          
          // Create form data for image upload
          const formData = new FormData()
          const imageBlob = new Blob([imageBuffer], { type: 'image/png' })
          formData.append('file', imageBlob, `slide-${moduleId}-page-${i + 1}.png`)
          formData.append('alt', `Slide ${i + 1}: ${title}`)
          
          // Upload image to media collection
          const uploadRes = await fetch(`${process.env.PAYLOAD_PUBLIC_SERVER_URL || 'http://localhost:3000'}/api/media`, {
            method: 'POST',
            headers: {
              'cookie': request.headers.get('cookie') || '',
            },
            body: formData,
          })
          
          if (uploadRes.ok) {
            const uploadedMedia = await uploadRes.json()
            imageId = uploadedMedia.doc?.id || uploadedMedia.id
            console.log(`Uploaded image for page ${i + 1}, media ID: ${imageId}`)
          } else {
            console.error(`Failed to upload image for page ${i + 1}:`, await uploadRes.text())
          }
        } catch (imgError) {
          console.error(`Error uploading image for page ${i + 1}:`, imgError)
        }
      }
      
      // Generate slug
      const timestamp = Date.now()
      const slug = `${title}-m${moduleId}-p${i + 1}-${timestamp}`
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .substring(0, 50)

      // Create slide in Payload with image if available
      const slideData: any = {
        title,
        slug,
        description,
        type: ['regular', 'video', 'quiz', 'reference', 'resources'].includes(type) ? type : 'regular',
        parent: moduleId,
        source: {
          pdfFilename: mediaDoc.filename || 'module.pdf',
          pdfPage: i + 1,
          module: moduleId,
        },
      }
      
      // Add image if uploaded successfully
      if (imageId) {
        slideData.image = imageId
      }

      const slideDoc = await payload.create({
        collection: 'slides',
        data: slideData,
      })

      slideIds.push(slideDoc.id)
      results.push({
        page: i + 1,
        extracted: pageData,
        created: slideDoc,
      })
    }

    // Update module with slide IDs
    if (slideIds.length > 0) {
      await payload.update({
        collection: 'modules',
        id: String(moduleId),
        data: {
          slides: slideIds,
        },
      })
    }

    return NextResponse.json({
      success: true,
      message: `Successfully processed ${extractorResult.pages_processed} pages and created ${slideIds.length} slides`,
      pages_processed: extractorResult.pages_processed,
      slides_created: slideIds.length,
      results,
    })

  } catch (e: any) {
    console.error('process-module-pdf-external error:', e)
    return NextResponse.json({ error: e?.message || 'Internal error' }, { status: 500 })
  }
}