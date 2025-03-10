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
import type { Config, Plugin } from 'payload/config'
import type { AlgoliaSearchConfig } from 'payload-plugin-algolia/dist/types'
import enhancedSyncWithSearch from './hooks/enhancedAlgoliaSync'

import Users from './collections/Users'
import Media from './collections/Media'
import Courses from './collections/Courses'
import Modules from './collections/Modules'
import Slides from './collections/Slides'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

const generateSearchAttributes = (args: any) => {
  try {
    const { doc, collection } = args

    if (!doc || !collection) {
      console.error('Missing doc or collection in generateSearchAttributes', {
        hasDoc: !!doc,
        hasCollection: !!collection,
      })
      return null
    }

    let searchAttributes: Record<string, any> = {
      title: doc.title || '',
      text: doc.description || '',
      collection: collection.slug,
      image: doc.image,
    }

    if (collection.slug === 'courses') {
      searchAttributes = {
        ...searchAttributes,
        learningObjectives:
          doc.learningObjectives?.map((obj: any) => obj.objective).join(' ') || '',
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
  } catch (error) {
    console.error(
      'Error in generateSearchAttributes:',
      error instanceof Error ? error.message : String(error),
    )
    // Return minimal valid search attributes to avoid breaking the sync
    return {
      title: args?.doc?.title || 'Untitled',
      text: args?.doc?.description || '',
      collection: args?.collection?.slug || 'unknown',
    }
  }
}

// Create an enhanced version of the AlgoliaSearchPlugin that uses our custom sync function
const EnhancedAlgoliaSearchPlugin =
  (searchConfig: AlgoliaSearchConfig): Plugin =>
  (config: Config): Config => {
    const { collections } = config

    if (collections) {
      const enabledCollections = searchConfig.collections || []

      const collectionsWithSearchHooks = collections
        ?.map((collection) => {
          const { hooks: existingHooks } = collection
          const isEnabled = enabledCollections.indexOf(collection.slug) > -1

          if (isEnabled) {
            return {
              ...collection,
              hooks: {
                ...collection.hooks,
                afterChange: [
                  ...(existingHooks?.afterChange || []),
                  enhancedSyncWithSearch(searchConfig),
                ],
                afterDelete: [
                  ...(existingHooks?.afterDelete || []),
                  // Keep using the original delete function
                  (args: any) => {
                    try {
                      const { collection, doc } = args
                      const { id } = doc
                      const searchClient = require('payload-plugin-algolia/dist/algolia').default(
                        searchConfig.algolia,
                      )
                      const objectID = `${collection.slug}:${id}`

                      const deleteOp = searchClient.deleteObject(objectID)

                      if (searchConfig.waitForHook === true) {
                        return deleteOp.wait()
                      }

                      return Promise.resolve()
                    } catch (error) {
                      console.error(
                        `Error deleting from search: ${error instanceof Error ? error.message : String(error)}`,
                      )
                      return Promise.resolve()
                    }
                  },
                ],
              },
            }
          }

          return collection
        })
        .filter(Boolean)

      return {
        ...config,
        collections: [...(collectionsWithSearchHooks || [])],
      }
    }

    return config
  }

// S3 Configuration - Hardcoded values from .env
const AWS_ACCESS_KEY = 'c258920f1af99511a2d32bb082e999d2'
const AWS_SECRET_KEY = '726cf05f11d1f8200901c9b5ecb4c6b382332a85463d3c2f09405f16e2cdb540'
const AWS_REGION = 'us-west-1'
const AWS_ENDPOINT = 'https://nwquaemdrfuhafnugbgl.supabase.co/storage/v1/s3'

// Algolia Configuration - Hardcoded values from .env
const ALGOLIA_APP_ID = 'HTODLVG92P'
const ALGOLIA_ADMIN_API_KEY = '8136653daed7fabb9332f53ec87481a4'
const ALGOLIA_INDEX = 'rs_cms'

// Database Configuration - Hardcoded values from .env
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
  // Direct database connection with hardcoded configuration
  db: postgresAdapter({
    pool: {
      connectionString: DATABASE_URI,
      ssl: {
        rejectUnauthorized: false,
      },
      max: 20, // Maximum number of clients in the pool
      min: 5, // Minimum number of idle clients maintained in the pool
      idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
      connectionTimeoutMillis: 10000, // Return an error after 10 seconds if connection could not be established
      statement_timeout: 60000, // Statement timeout in milliseconds (60 seconds)
    },
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
    // Use our enhanced Algolia search plugin
    EnhancedAlgoliaSearchPlugin({
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
