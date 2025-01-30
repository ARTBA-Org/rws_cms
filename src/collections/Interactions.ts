import type { CollectionConfig } from 'payload'

const Interactions: CollectionConfig = {
  slug: 'interactions',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'url', 'thumbnail', 'module'],
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'url',
      type: 'text',
      required: true,
    },
    {
      name: 'thumbnail',
      type: 'upload',
      relationTo: 'media',
      required: false,
    },
    {
      name: 'module',
      type: 'relationship',
      relationTo: 'modules',
      required: true,
    },
  ],
}

export default Interactions
