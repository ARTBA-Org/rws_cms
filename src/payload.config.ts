// storage-adapter-import-placeholder
import { postgresAdapter } from '@payloadcms/db-postgres'
import { payloadCloudPlugin } from '@payloadcms/payload-cloud'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'
import { s3Storage } from '@payloadcms/storage-s3'
import { AlgoliaSearchPlugin } from 'payload-plugin-algolia'
import { getDBConnectionOptions } from './utils/ssl-config'

import Users from './collections/Users'
import Media from './collections/Media'
import Courses from './collections/Courses'
import Modules from './collections/Modules'
import Slides from './collections/Slides'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

const generateSearchAttributes = (args: any) => {
  const { doc, collection } = args
  let searchAttributes: Record<string, any> = {
    title: doc.title,
    text: doc.description,
    collection: collection.slug,
    image: doc.image,
  }

  if (collection.slug === 'courses') {
    searchAttributes = {
      ...searchAttributes,
      learningObjectives: doc.learningObjectives?.map((obj: any) => obj.objective).join(' ') || '',
      modules: doc.modules, // Keeping modules IDs for now
    }
  }

  if (collection.slug === 'modules') {
    searchAttributes = {
      ...searchAttributes,
      slides: doc.slides, // Keeping slides IDs for now
    }
  }

  if (collection.slug === 'slides') {
    searchAttributes = {
      ...searchAttributes,
      type: doc.type,
      slide_image: doc.slide_image,
      urls: doc.urls,
    }
  }

  return searchAttributes
}

// S3 Configuration - Hard coded values
const AWS_ACCESS_KEY = 'c258920f1af99511a2d32bb082e999d2'
const AWS_SECRET_KEY = '726cf05f11d1f8200901c9b5ecb4c6b382332a85463d3c2f09405f16e2cdb540'
const AWS_REGION = 'us-west-1'
const AWS_ENDPOINT = 'https://nwquaemdrfuhafnugbgl.supabase.co/storage/v1/s3'

// Algolia Configuration - Hard coded values
const ALGOLIA_APP_ID = 'HTODLVG92P'
const ALGOLIA_ADMIN_API_KEY = '8136653daed7fabb9332f53ec87481a4'
const ALGOLIA_INDEX = 'rs_cms'

// Database Configuration - Hard coded values
const DATABASE_URI =
  'postgresql://postgres.nwquaemdrfuhafnugbgl:UHB6tySaRY06Lr8g@aws-0-us-west-1.pooler.supabase.com:6543/postgres?sslmode=no-verify'
const PAYLOAD_SECRET = '8tok6QrKzWdsBag4/MIvm4Pp1TF+d9xx8tok6QrKzWd'

export default buildConfig({
  admin: {
    user: 'users',
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },
  collections: [Users, Media, Courses, Modules, Slides],
  editor: lexicalEditor(),
  secret: PAYLOAD_SECRET,
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: postgresAdapter({
    pool: getDBConnectionOptions(DATABASE_URI),
  }),
  sharp,
  plugins: [
    s3Storage({
      collections: {
        media: {
          prefix: 'media',
        },
      },
      bucket: 'Media',
      config: {
        forcePathStyle: true,
        credentials: {
          accessKeyId: AWS_ACCESS_KEY,
          secretAccessKey: AWS_SECRET_KEY,
        },
        region: AWS_REGION,
        endpoint: AWS_ENDPOINT,
      },
    }),
    AlgoliaSearchPlugin({
      algolia: {
        appId: ALGOLIA_APP_ID,
        apiKey: ALGOLIA_ADMIN_API_KEY,
        index: ALGOLIA_INDEX,
      },
      collections: ['courses', 'modules', 'slides'],
      waitForHook: true,
      generateSearchAttributes,
    }),
  ].filter(Boolean),
})
