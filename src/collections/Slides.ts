import type { CollectionConfig } from 'payload';

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
      type: 'richText',
      required: true,
    },
    {
      name: 'image',
      type: 'upload',
      relationTo: 'media',
      required: false,
    },
    {
      name: 'type',
      type: 'select',
      required: true,
      options: [
        { label: 'Regular', value: 'regular' },
        { label: 'Video', value: 'video' },
        { label: 'Quiz', value: 'quiz' },
        { label: 'Reference', value: 'reference' },
        { label: 'Resources', value: 'resources' },
      ],
      defaultValue: 'regular',
    },
  ],
};

export default Slides; 