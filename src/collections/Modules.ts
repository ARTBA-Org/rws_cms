import type { CollectionConfig } from 'payload'

const Modules: CollectionConfig = {
  slug: 'modules',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'description', 'thumbnail', 'slidesCount'],
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
      name: 'thumbnail',
      type: 'upload',
      relationTo: 'media',
      required: false,
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
  ],
}

export default Modules
