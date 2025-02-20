import type { CollectionConfig } from 'payload';

const Courses: CollectionConfig = {
  slug: 'courses',
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
      name: 'Course Thumbnail',
      type: 'upload',
      relationTo: 'media',
    },
    {
      name: 'modules',
      type: 'relationship',
      relationTo: 'modules',
      hasMany: true,
    },
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
            if (data.title || data.description) {
              return `${data.title} ${data.description}`;
            }
            return null;
          },
        ],
      },
    },
  ],
};

export default Courses;