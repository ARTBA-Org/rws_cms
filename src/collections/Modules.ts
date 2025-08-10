import type { CollectionConfig } from 'payload'

const Modules: CollectionConfig = {
  slug: 'modules',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'description', 'slidesCount'],
  },
  hooks: {
    afterChange: [
      async ({ doc, previousDoc, operation, req }) => {
        // Only trigger on updates (not creates) and when a PDF is newly uploaded
        if (operation === 'update' && doc.pdfUpload && doc.pdfUpload !== previousDoc?.pdfUpload) {
          console.log('🔄 PDF upload detected, triggering automatic processing...')

          try {
            // Import the PDF processor
            const { PDFProcessor } = await import('../utils/pdfProcessorWorking')

            // Get the uploaded PDF media document
            const mediaId = typeof doc.pdfUpload === 'object' ? doc.pdfUpload.id : doc.pdfUpload
            const mediaDoc = await req.payload.findByID({
              collection: 'media',
              id: String(mediaId),
            })

            if (!mediaDoc?.url) {
              console.error('❌ Media file has no accessible URL')
              return
            }

            // Fetch the PDF file
            const SERVER_ORIGIN =
              process.env.PAYLOAD_PUBLIC_SERVER_URL ||
              `http://localhost:${process.env.PORT || 3001}`
            const absoluteUrl = mediaDoc.url.startsWith('http')
              ? mediaDoc.url
              : `${SERVER_ORIGIN}${mediaDoc.url}`

            const response = await fetch(absoluteUrl)
            if (!response.ok) {
              console.error(`❌ Failed to fetch PDF: ${response.status} ${response.statusText}`)
              return
            }

            const arrayBuffer = await response.arrayBuffer()
            const pdfBuffer = Buffer.from(arrayBuffer)

            // Process the PDF in the background
            const processor = new PDFProcessor()
            console.log('🚀 Starting automatic PDF processing...')

            // Process asynchronously to avoid blocking the response
            processor
              .processPDFToSlides(
                pdfBuffer,
                String(doc.id),
                (mediaDoc as any).filename || 'uploaded.pdf',
              )
              .then((result) => {
                if (result.success) {
                  console.log(
                    `✅ Automatic PDF processing completed: ${result.slidesCreated} slides created`,
                  )
                } else {
                  console.error('❌ Automatic PDF processing failed:', result.errors)
                }
              })
              .catch((error) => {
                console.error('❌ Automatic PDF processing error:', error)
              })
          } catch (error) {
            console.error('❌ Error in automatic PDF processing hook:', error)
          }
        }
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
      name: 'pdfUpload',
      type: 'upload',
      relationTo: 'media',
      label: 'PDF Upload',
      admin: {
        description:
          'Upload a PDF file here, then use the processing button below to convert it into slides.',
      },
    },
    {
      name: 'pdfProcessing',
      type: 'ui',
      admin: {
        components: {
          Field: '@/components/ProcessPdfButton#default',
        },
      },
    },
    {
      name: 'slidesColor',
      type: 'text',
    },
    // PDF fields removed
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
