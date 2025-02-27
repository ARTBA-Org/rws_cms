import type { CollectionConfig } from 'payload'

const Modules: CollectionConfig = {
  slug: 'modules',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'description', 'slidesCount'],
  },
  hooks: {
    beforeChange: [
      async ({ req, data, operation }) => {
        // Validate slides existence before updating relationships
        if (data.slides && Array.isArray(data.slides)) {
          const slideIds = data.slides.map((id) => (typeof id === 'object' ? id.id : id))
          const validSlides = await req.payload.find({
            collection: 'slides',
            where: {
              id: {
                in: slideIds,
              },
            },
          })

          // Only include slides that exist
          data.slides = validSlides.docs.map((slide) => slide.id)
        }
        return data
      },
    ],
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
