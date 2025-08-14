import type { CollectionConfig } from 'payload'
import { createParentField, createBreadcrumbsField } from '@payloadcms/plugin-nested-docs'

const Courses: CollectionConfig = {
  slug: 'courses',
  trash: true, // Enable soft delete functionality
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
      name: 'description',
      type: 'textarea',
      required: true,
    },
    {
      name: 'learningObjectives',
      type: 'array',
      fields: [
        {
          name: 'objective',
          type: 'text',
        },
      ],
    },
    {
      name: 'Thumbnail',
      type: 'upload',
      relationTo: 'media',
    },
    {
      name: 'modules',
      type: 'relationship',
      relationTo: 'modules',
      hasMany: true,
    },
    // Nested docs fields
    createParentField('courses', {
      admin: {
        position: 'sidebar',
        description: 'Parent course (for sub-courses)',
      },
    }),
    createBreadcrumbsField('courses', {
      admin: {
        position: 'sidebar',
      },
    }),
    // Define search_vector as a text field so Payload creates a column
    {
      name: 'search_vector',
      type: 'text',
      access: {
        read: () => false, // hide from API responses
      },
      // Optionally add a hook to generate the content
      hooks: {
        beforeChange: [
          ({ data }) => {
            if (data && (data.title || data.description)) {
              return `${data.title || ''} ${data.description || ''}`
            }
            return null
          },
        ],
      },
    },
  ],
}

export default Courses
