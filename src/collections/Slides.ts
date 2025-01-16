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
      name: 'content',
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
  ],
}

export default Slides
