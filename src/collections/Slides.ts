import type { CollectionConfig } from 'payload'
import { createParentField, createBreadcrumbsField } from '@payloadcms/plugin-nested-docs'

const Slides: CollectionConfig = {
  slug: 'slides',
  trash: true, // Enable soft delete functionality
  // Enable folders for better organization
  folders: true,
  admin: {
    useAsTitle: 'title',
  },
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
      name: 'source',
      type: 'group',
      admin: { readOnly: true },
      fields: [
        { name: 'pdfFilename', type: 'text' },
        { name: 'pdfPage', type: 'number' },
        { name: 'module', type: 'relationship', relationTo: 'modules' },
      ],
    },
    {
      name: 'description',
      type: 'textarea',
    },
    {
      name: 'image',
      type: 'upload',
      relationTo: 'media',
    },
    {
      name: 'type',
      type: 'select',
      required: false,
      defaultValue: 'regular',
      enumName: 'slide_type_enum',
      options: [
        {
          label: 'Regular',
          value: 'regular',
        },
        {
          label: 'Video',
          value: 'video',
        },
        {
          label: 'Quiz',
          value: 'quiz',
        },
        {
          label: 'Reference',
          value: 'reference',
        },
        {
          label: 'Resources',
          value: 'resources',
        },
      ],
      admin: {
        isClearable: false,
      },
    },
    {
      name: 'urls',
      type: 'array',
      fields: [
        {
          name: 'url',
          type: 'text',
        },
      ],
    },
    // Nested docs fields - slides can belong to modules
    createParentField('modules', {
      admin: {
        position: 'sidebar',
        description: 'Module this slide belongs to',
      },
    }),
    createBreadcrumbsField('slides', {
      admin: {
        position: 'sidebar',
      },
    }),
    {
      name: 'search_vector',
      type: 'text',
      access: {
        read: () => false,
      },
      hooks: {
        beforeChange: [
          ({ data }) => {
            const title = data?.title || ''
            const description = data?.description || ''
            return `${title} ${description}`
          },
        ],
      },
    },
  ],
}

export default Slides
