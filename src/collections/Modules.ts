import type { CollectionConfig } from 'payload'
import { createParentField, createBreadcrumbsField } from '@payloadcms/plugin-nested-docs'
// Removed PDF auto-processing; collection simplified

const Modules: CollectionConfig = {
  slug: 'modules',
  trash: true, // Enable soft delete functionality
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
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      admin: {
        description: 'Auto-generated from title (editable)',
        position: 'sidebar',
      },
      hooks: {
        beforeValidate: [
          ({ data, operation }) => {
            if (operation === 'create' || !data?.slug) {
              if (data?.title) {
                // Auto-generate slug from title
                return data.title
                  .toLowerCase()
                  .replace(/[^a-z0-9]+/g, '-') // Replace non-alphanumeric with hyphens
                  .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens
                  .substring(0, 50) // Limit length
              }
            }
            return data?.slug
          },
        ],
      },
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
          Field: '@/components/PdfProcessorField#PdfProcessorField',
        },
      },
    },
    {
      name: 'slidesColor',
      type: 'text',
    },
    // Nested docs fields - modules can belong to courses
    createParentField('courses', {
      admin: {
        position: 'sidebar',
        description: 'Course this module belongs to',
      },
    }),
    createBreadcrumbsField('modules', {
      admin: {
        position: 'sidebar',
      },
    }),
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
