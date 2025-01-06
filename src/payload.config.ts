// storage-adapter-import-placeholder
import { postgresAdapter } from '@payloadcms/db-postgres'
import { payloadCloudPlugin } from '@payloadcms/payload-cloud'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'
import { s3Storage } from '@payloadcms/storage-s3'

import Users from './collections/Users'
import Media from './collections/Media'
import Courses from './collections/Courses'
import Modules from './collections/Modules'
import Slides from './collections/Slides'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  admin: {
    user: 'users',
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },
  collections: [Users, Media, Courses, Modules, Slides],
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URI || '',
    },
  }),
  sharp,
  plugins: [
    s3Storage({
      collections: {
        media: {
          prefix: 'media',
          generateFileURL: ({ filename }) => `https://Media.s3.amazonaws.com/media/${filename}`,
        },
      },
      bucket: 'Media',
      config: {
        forcePathStyle: true,
        credentials: {
          accessKeyId: 'e6b00e5933eafae276f1b808c04a1c52',
          secretAccessKey: '70a6822b021c5e9f862504fe8a1843dd548eac7a3a03fa948e1034321fda2e5c',
        },
        region: 'us-west-1',
        endpoint: 'https://nwquaemdrfuhafnugbgl.supabase.co/storage/v1/s3',
      },
    }),
  ],
})
