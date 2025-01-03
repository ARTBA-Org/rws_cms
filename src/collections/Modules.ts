import type { CollectionConfig } from 'payload';

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
      required: true,
      fields: [
        {
          name: 'objective',
          type: 'text',
        },
      ],
    },
    {
      name: 'slides',
      type: 'array',
      required: true,
      admin: {
        components: {
          RowLabel: ({ data }) => {
            return data?.title || 'Slide';
          },
        },
      },
      fields: [
        {
          name: 'slide',
          type: 'relationship',
          relationTo: 'slides',
          required: true,
        },
        {
          name: 'order',
          type: 'number',
          admin: {
            step: 1,
          },
        },
        {
          name: 'isActive',
          type: 'checkbox',
          defaultValue: true,
          admin: {
            description: 'Use this to temporarily disable a slide without removing it',
          },
        },
      ],
    },
    {
      name: 'slidesCount',
      type: 'number',
      admin: {
        position: 'sidebar',
        description: 'Total number of slides in this module',
      },
      hooks: {
        beforeChange: [
          ({ siblingData }) => {
            if (siblingData.slides) {
              return siblingData.slides.length;
            }
            return 0;
          },
        ],
      },
    },
  ],
};

export default Modules; 