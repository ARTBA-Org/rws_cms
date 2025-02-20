import type { CollectionConfig } from 'payload'

const Slides: CollectionConfig = {
  slug: 'slides',
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
      name: 'slide_image',
      type: 'text',
      required: false,
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
    {
      name: 'slide_color_code',
      type: 'text',
      required: false,
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
