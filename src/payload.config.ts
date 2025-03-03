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
import { mockDBAdapter } from './utils/mock-db-adapter'

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

// S3 Configuration
const AWS_ACCESS_KEY = process.env.S3_ACCESS_KEY as string | undefined
const AWS_SECRET_KEY = process.env.S3_SECRET_KEY as string | undefined
const AWS_REGION = process.env.S3_REGION || 'us-west-1'
const AWS_ENDPOINT = process.env.S3_ENDPOINT as string | undefined

// Algolia Configuration
const ALGOLIA_APP_ID = process.env.ALGOLIA_APP_ID
const ALGOLIA_ADMIN_API_KEY = process.env.ALGOLIA_ADMIN_API_KEY
const ALGOLIA_INDEX = process.env.ALGOLIA_INDEX || 'rs_cms'

// Database Configuration
const DATABASE_URI = process.env.DATABASE_URI
const PAYLOAD_SECRET = process.env.PAYLOAD_SECRET || '1234567890'

// Check if we should skip the database connection
const SKIP_DB = process.env.NEXT_BUILD_SKIP_DB === 'true'

if (SKIP_DB) {
  console.log('⚠️ NEXT_BUILD_SKIP_DB is set to true, using mock database adapter')
} else {
  if (!AWS_ACCESS_KEY || !AWS_SECRET_KEY) {
    console.warn(
      'AWS credentials are missing. Please set S3_ACCESS_KEY and S3_SECRET_KEY environment variables.',
    )
  }

  if (!ALGOLIA_APP_ID || !ALGOLIA_ADMIN_API_KEY) {
    console.warn(
      'Algolia credentials are missing. Please set ALGOLIA_APP_ID and ALGOLIA_ADMIN_API_KEY environment variables.',
    )
  }

  if (!DATABASE_URI) {
    console.warn('Database URI is missing. Please set DATABASE_URI environment variable.')
  }
}

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
  // Use the mock adapter when NEXT_BUILD_SKIP_DB is true, otherwise use the postgres adapter
  db: SKIP_DB
    ? mockDBAdapter()
    : postgresAdapter({
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
          accessKeyId: AWS_ACCESS_KEY || '',
          secretAccessKey: AWS_SECRET_KEY || '',
        },
        region: AWS_REGION,
        endpoint: AWS_ENDPOINT || '',
      },
    }),
    ALGOLIA_APP_ID && ALGOLIA_ADMIN_API_KEY
      ? AlgoliaSearchPlugin({
          algolia: {
            appId: ALGOLIA_APP_ID,
            apiKey: ALGOLIA_ADMIN_API_KEY,
            index: ALGOLIA_INDEX,
          },
          collections: ['courses', 'modules', 'slides'],
          waitForHook: true,
          generateSearchAttributes,
        })
      : null,
  ].filter(Boolean),
})
