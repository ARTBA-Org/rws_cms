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
      name: 'slidesColor',
      type: 'text',
    },
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
