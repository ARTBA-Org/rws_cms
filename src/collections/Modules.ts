import type { CollectionConfig } from 'payload'
// Removed PDF auto-processing; collection simplified

const Modules: CollectionConfig = {
  slug: 'modules',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'description', 'slidesCount'],
  },
  hooks: {
    afterChange: [
      async ({ doc, previousDoc, req, operation }) => {
        if (operation !== 'create' && operation !== 'update') return doc
        const current = doc as any
        const prev = (previousDoc || {}) as any
        const pdfChanged = !!current.pdfUpload && current.pdfUpload !== prev.pdfUpload
        if (!pdfChanged) return doc

        try {
          // Fetch the uploaded file from media
          const pdfMediaId =
            typeof current.pdfUpload === 'object' ? current.pdfUpload.id : current.pdfUpload
          const mediaDoc = await req.payload.findByID({
            collection: 'media',
            id: String(pdfMediaId),
          })
          const fileUrl: string | undefined = (mediaDoc as any)?.url
          if (!fileUrl) return doc

          const SERVER_ORIGIN =
            process.env.PAYLOAD_PUBLIC_SERVER_URL || `http://localhost:${process.env.PORT || 3001}`
          const absoluteUrl = fileUrl.startsWith('http') ? fileUrl : `${SERVER_ORIGIN}${fileUrl}`

          const headers: Record<string, string> = {}
          const cookie = (req.headers as any)?.cookie
          if (cookie) headers.cookie = cookie
          const res = await fetch(absoluteUrl, { headers })
          if (!res.ok) return doc
          const ab = await res.arrayBuffer()
          const buffer = Buffer.from(ab)

          const { PDFProcessor } = await import('../utils/pdfProcessor')
          const processor = new PDFProcessor()
          await processor.processPDFToSlides(
            buffer,
            String(current.id),
            (mediaDoc as any)?.filename || 'uploaded.pdf',
          )
          // Refresh admin view with updated slides immediately
          try {
            const updated = await req.payload.findByID({
              collection: 'modules',
              id: String(current.id),
            })
            if (updated?.slides) {
              // @ts-ignore mutate returned doc for admin display only
              doc.slides = updated.slides
            }
          } catch {}
        } catch (e) {
          console.error('PDF-to-slides processing failed:', e)
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
      name: 'pdfUpload',
      type: 'upload',
      relationTo: 'media',
      label: 'PDF Upload',
      admin: {
        description: 'Upload a PDF to generate slides from each page',
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
