import type { CollectionConfig } from 'payload'

const Media: CollectionConfig = {
  slug: 'media',
  admin: {
    hidden: false,
  },
  access: {
    // Allow public read so the server can fetch PDFs from /api/media/file/* during processing
    read: () => true,
  },
  upload: {
    staticDir: 'media',
    // Allow PDFs so modules can upload a PDF file for slide generation
    mimeTypes: ['image/*', 'video/*', 'application/pdf'],
    imageSizes: [
      {
        name: 'thumbnail',
        width: 400,
        height: 300,
        position: 'centre',
      },
      {
        name: 'card',
        width: 768,
        height: 1024,
        position: 'centre',
      },
    ],
    adminThumbnail: 'thumbnail',
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      required: false,
      label: 'Alt Text',
      defaultValue: '',
    },
  ],
}

export default Media
