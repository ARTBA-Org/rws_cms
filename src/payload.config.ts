import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { buildConfig } from 'payload/config'
import { fileURLToPath } from 'url'
import sharp from 'sharp'
import { Users } from './collections/Users'
import { Media } from './collections/Media'
import Courses from './collections/Courses'
import Simulations from './collections/Simulations'
import { s3Storage } from '@payloadcms/storage-s3'
import slugify from 'slugify' // You might need to install this package: npm install slugify

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

const sanitizeFilename = (filename: string): string => {
  // Remove the file extension
  const parts = filename.split('.')
  const ext = parts.pop()
  const name = parts.join('.')

  // Sanitize the filename
  const sanitized = slugify(name, { lower: true, strict: true })

  // Reattach the extension
  return `${sanitized}.${ext}`
}

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },
  collections: [Users, Media, Courses, Simulations],
  editor: lexicalEditor(),
  secret: '999a184aee931b24ea650729',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URI,
    },
  }),
  sharp,
  plugins: [
    s3Storage({
      collections: {
        media: {
          prefix: 'media',
          generateFileURL: ({ filename }) =>
            `https://Media.s3.amazonaws.com/media/${sanitizeFilename(filename)}`,
        },
       
      },
      bucket: 'Media',
      config: {
        forcePathStyle: true,
        credentials: {
          accessKeyId: '001193540c399274d13b9c08d188a377',
          secretAccessKey: 'df3d6c24099cab8a75783ed2cfe2aeadfbe0b1f69e6e50371d0940fdbae11ac6',
        },
        region: 'us-west-1',
        endpoint: 'https://hykhltcjktdczownctqf.supabase.co/storage/v1/s3',
      },
    }),
  ],
})
