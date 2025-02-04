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

// S3 Configuration
const AWS_ACCESS_KEY = 'AKIAUGLYLUJBDKEQ7VTW'
const AWS_SECRET_KEY = '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'
const AWS_REGION = 'us-east-1'

export default buildConfig({
  admin: {
    user: 'users',
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },
  collections: [Users, Media, Courses, Modules, Slides],
  editor: lexicalEditor(),
  secret: '1234567890',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: postgresAdapter({
    pool: {
      connectionString:
        'postgresql://postgres.nwquaemdrfuhafnugbgl:oUjZXbDAM2VqDgiZ@aws-0-us-west-1.pooler.supabase.com:6543/postgres',
    },
  }),
  sharp,
  plugins: [
    s3Storage({
      collections: {
        media: {
          prefix: 'media',
          generateFileURL: ({ filename }) =>
            `https://rsfilesdata.s3.amazonaws.com/media/${filename}`,
        },
      },
      bucket: 'rsfilesdata',
      config: {
        forcePathStyle: true,
        credentials: {
          accessKeyId: AWS_ACCESS_KEY,
          secretAccessKey: AWS_SECRET_KEY,
        },
        region: AWS_REGION,
        endpoint: 'https://rsfilesdata.s3.amazonaws.com',
      },
    }),
  ],
})
