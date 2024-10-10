import type { CollectionConfig } from 'payload'

const Courses: CollectionConfig = {
  slug: 'courses',
  admin: {
    useAsTitle: 'Title',
  },
  fields: [
    {
      name: 'Title',
      type: 'text',
      required: true,
    },
    {
      name: 'LearningObjectives',
      type: 'textarea',
    },
    {
      name: 'TopicsCovered',
      type: 'array',
      fields: [
        {
          name: 'topic',
          type: 'text',
        },
      ],
    },
    {
      name: 'PowerPoint',
      type: 'upload',
      relationTo: 'media',
    },
    {
      name: 'Handouts',
      type: 'array',
      fields: [
        {
          name: 'handout',
          type: 'upload',
          relationTo: 'media',
        },
      ],
    },
    {
      name: 'Interaction',
      type: 'textarea',
    },
    {
      name: 'Assessments',
      type: 'array',
      fields: [
        {
          name: 'assessment',
          type: 'text',
        },
      ],
    },
    {
      name: 'Files',
      type: 'array',
      fields: [
        {
          name: 'file',
          type: 'upload',
          relationTo: 'media',
        },
      ],
    },
    {
      name: 'relatedSimulations',
      type: 'relationship',
      relationTo: 'simulations',
      hasMany: true,
    },
  ],
};

export default Courses;
