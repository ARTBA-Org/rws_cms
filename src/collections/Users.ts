import type { CollectionConfig } from 'payload';

const Users: CollectionConfig = {
  slug: 'users',
  auth: true,
  admin: {
    useAsTitle: 'email',
  },
  fields: [
    {
      name: 'email',
      type: 'email',
      required: true,
      unique: true,
    },
    {
      name: 'name',
      type: 'text',
    },
    {
      name: 'userRole',
      type: 'radio',
      required: true,
      defaultValue: 'user',
      options: [
        {
          label: 'Admin',
          value: 'admin',
        },
        {
          label: 'User',
          value: 'user',
        },
      ],
      access: {
        create: () => false, // Only through admin UI
        update: ({ req: { user } }) => {
          return user?.userRole === 'admin';
        },
      },
    },
  ],
  access: {
    read: () => true,
    create: () => true,
    update: ({ req: { user } }) => {
      if (user?.userRole === 'admin') return true;
      return {
        id: {
          equals: user?.id,
        },
      };
    },
    delete: ({ req: { user } }) => {
      return user?.userRole === 'admin';
    },
  },
};

export default Users;
