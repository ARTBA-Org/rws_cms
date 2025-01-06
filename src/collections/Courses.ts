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
      name: 'modules',
      type: 'relationship',
      relationTo: 'modules',
      hasMany: true,
    },
  ],
};

export default Courses; 