import type { CollectionConfig } from 'payload'

const Pdfs: CollectionConfig = {
  slug: 'pdfs',
  admin: {
    hidden: false,
  },
  access: {
    read: () => true, // Make PDFs publicly readable
  },
  upload: {
    mimeTypes: ['application/pdf'],
    adminThumbnail: ({ doc }) => doc.url,
    // Remove staticDir to use S3 storage
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: false,
      label: 'PDF Title',
    },
  ],
}

export default Pdfs