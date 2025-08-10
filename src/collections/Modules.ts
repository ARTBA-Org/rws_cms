import type { CollectionConfig } from 'payload'
// Removed PDF auto-processing; collection simplified

const Modules: CollectionConfig = {
  slug: 'modules',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'description', 'slidesCount'],
  },
  // Hooks removed to avoid database timeout issues - using manual processing instead

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
