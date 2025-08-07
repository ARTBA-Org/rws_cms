import type { CollectionConfig } from 'payload'
import { PDFProcessor } from '../utils/pdfProcessor'

const Modules: CollectionConfig = {
  slug: 'modules',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'description', 'slidesCount'],
  },
  hooks: {
    afterChange: [
      async ({ doc, previousDoc, req, operation }) => {
        // Only process on create or update when PDF is uploaded
        if (operation === 'create' || operation === 'update') {
          // Check if PDF exists and either it's new or module has no slides yet
          const shouldProcess =
            doc.pdfUpload &&
            (doc.pdfUpload !== previousDoc?.pdfUpload || // New PDF uploaded
              !doc.slides ||
              doc.slides.length === 0) // Has PDF but no slides

          if (shouldProcess) {
            console.log('🎯 PDF processing triggered for module:', doc.id)

            try {
              // Resolve ID if the upload field returns an object
              const pdfUploadId =
                typeof doc.pdfUpload === 'object' ? (doc.pdfUpload as any).id : doc.pdfUpload

              // Get the PDF document
              const pdfDoc = await req.payload.findByID({
                collection: 'pdfs',
                id: pdfUploadId,
              })

              if (pdfDoc && pdfDoc.filename) {
                console.log('📄 PDF found:', pdfDoc.filename)

                // Get PDF buffer directly from storage
                let pdfBuffer!: Buffer

                // Determine how to retrieve the file
                if (pdfDoc.url) {
                  // -----------------------
                  // Case 1: URL available
                  // -----------------------
                  // Absolute URL → use directly. Relative URL (/api/...) → add server origin.
                  const SERVER_ORIGIN =
                    process.env.PAYLOAD_PUBLIC_SERVER_URL ||
                    `http://localhost:${process.env.PORT || 3001}`
                  const absoluteUrl = pdfDoc.url.startsWith('http')
                    ? pdfDoc.url
                    : `${SERVER_ORIGIN}${pdfDoc.url}`

                  console.log('🌐 Fetching PDF from:', absoluteUrl)

                  const cookie = (req.headers as any).cookie ?? ''
                  const response = await fetch(absoluteUrl, {
                    headers: cookie ? { cookie } : undefined,
                  })
                  if (!response.ok) {
                    throw new Error(
                      `Failed to fetch PDF: ${response.status} ${response.statusText}`,
                    )
                  }
                  const arrayBuffer = await response.arrayBuffer()
                  pdfBuffer = Buffer.from(arrayBuffer)
                } else {
                  // -------------------------
                  // No URL field -> filesystem
                  // -------------------------
                  // No URL field – fall back to local filesystem search
                  const fs = await import('fs')
                  const path = await import('path')

                  // Check multiple possible locations (including uploads dir and any prefix)
                  // Build possible local file paths (covers default Payload uploads dir and custom prefixes)
                  const possiblePaths = [
                    path.join(process.cwd(), 'uploads', pdfDoc.prefix || '', pdfDoc.filename),
                    // Payload default uploads folder (./uploads/<collectionSlug>/<filename>)
                    path.join(process.cwd(), 'uploads', 'pdfs', pdfDoc.filename),
                    // Prefix set by S3 / local upload config
                    pdfDoc.prefix ? path.join(process.cwd(), pdfDoc.prefix, pdfDoc.filename) : '',
                    // Legacy hard-coded locations used earlier in the project
                    path.join(process.cwd(), 'pdfs', pdfDoc.filename),
                    path.join(process.cwd(), 'public', 'pdfs', pdfDoc.filename),
                    path.join(process.cwd(), 'media', pdfDoc.filename),
                  ].filter(Boolean) // remove empty strings

                  let fileFound = false
                  for (const filePath of possiblePaths) {
                    if (fs.existsSync(filePath)) {
                      console.log('📂 Found PDF at:', filePath)
                      pdfBuffer = await fs.promises.readFile(filePath)
                      fileFound = true
                      break
                    }
                  }

                  if (!fileFound) {
                    // As a fallback, try to read the PDF document's buffer if available
                    console.log('⚠️ PDF file not found in filesystem, checking document buffer...')

                    // Re-query with depth to get file data
                    const pdfWithData = await req.payload.findByID({
                      collection: 'pdfs',
                      id: pdfDoc.id,
                      depth: 2,
                    })

                    if (pdfWithData && (pdfWithData as any)._buffer) {
                      pdfBuffer = (pdfWithData as any)._buffer
                      console.log('✅ Got PDF buffer from document')
                    } else {
                      throw new Error('Could not access PDF file data')
                    }
                  }
                }

                console.log('✅ PDF loaded successfully, size:', pdfBuffer.length, 'bytes')

                // Process the PDF
                const processor = new PDFProcessor()
                const result = await processor.processPDFToSlides(
                  pdfBuffer,
                  doc.id,
                  pdfDoc.filename || 'uploaded.pdf',
                )

                console.log('✅ PDF processing result:', result)
                // Ensure the response doc reflects new slides immediately in Admin without manual refresh
                try {
                  const updated = await req.payload.findByID({
                    collection: 'modules',
                    id: String(doc.id),
                  })
                  if (updated?.slides) {
                    // @ts-ignore - mutate returned doc for admin display
                    doc.slides = updated.slides
                  }
                } catch (e) {
                  // Non-fatal; admin may need a manual refresh if fetch fails
                }
              }
            } catch (error) {
              console.error('❌ Error processing PDF:', error)
            }
          }
        }

        return doc
      },
    ],
  },

  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      name: 'description',
      type: 'textarea',
    },
    {
      name: 'moduleThumbnail',
      type: 'upload',
      relationTo: 'media',
    },
    {
      name: 'slides',
      type: 'relationship',
      relationTo: 'slides',
      hasMany: true,
    },
    {
      name: 'slidesColor',
      type: 'text',
    },
    {
      name: 'pdfUpload',
      type: 'upload',
      relationTo: 'pdfs',
      label: 'PDF Upload',
      admin: {
        description: 'Upload a PDF to automatically generate slides from each page',
      },
    },
    {
      name: 'search_vector',
      type: 'text',
      access: {
        read: () => false,
      },
      hooks: {
        beforeChange: [
          ({ data }) => {
            if (data?.title || data?.description) {
              return `${data.title} ${data.description}`
            }
            return null
          },
        ],
      },
    },
  ],
}

export default Modules
