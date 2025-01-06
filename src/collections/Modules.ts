import type { CollectionConfig } from 'payload'

const Modules: CollectionConfig = {
  slug: 'modules',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'description', 'slidesCount'],
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
      name: 'slides',
      type: 'relationship',
      relationTo: 'slides',
      hasMany: true,
    },
  ],
}

export default Modules
