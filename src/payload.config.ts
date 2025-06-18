// storage-adapter-import-placeholder
import { postgresAdapter } from '@payloadcms/db-postgres'
// Remove unused import
// import { payloadCloudPlugin } from '@payloadcms/payload-cloud'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'
import { s3Storage } from '@payloadcms/storage-s3'
// AlgoliaSearchPlugin is no longer used directly
// import { AlgoliaSearchPlugin } from 'payload-plugin-algolia'
import type { Config, Plugin } from 'payload/config'
import type { AlgoliaSearchConfig } from 'payload-plugin-algolia/dist/types'
import enhancedSyncWithSearch from './hooks/enhancedAlgoliaSync'
// Import createClient and getObjectID properly
import createClient from 'payload-plugin-algolia/dist/algolia'
import { getObjectID } from 'payload-plugin-algolia/dist/hooks/syncWithSearch'

import Users from './collections/Users'
import Media from './collections/Media'
import Courses from './collections/Courses'
import Modules from './collections/Modules'
import Slides from './collections/Slides'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

// Fix any types with more specific types where possible
type SearchAttributesArgs = {
  doc: Record<string, unknown>
  collection: { slug: string }
}

const generateSearchAttributes = (args: SearchAttributesArgs) => {
  try {
    const { doc, collection } = args

    if (!doc || !collection) {
      console.error('Missing doc or collection in generateSearchAttributes', {
        hasDoc: !!doc,
        hasCollection: !!collection,
      })
      return null
    }

    let searchAttributes: Record<string, unknown> = {
      title: doc.title || '',
      text: doc.description || '',
      collection: collection.slug,
      image: doc.image,
    }

    if (collection.slug === 'courses') {
      searchAttributes = {
        ...searchAttributes,
        learningObjectives: Array.isArray(doc.learningObjectives)
          ? doc.learningObjectives.map((obj: Record<string, unknown>) => obj.objective).join(' ') ||
            ''
          : '',
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
                  // Enhanced delete function with proper imports
                  (args: { collection: { slug: string }; doc: { id: string } }) => {
                    try {
                      const { collection, doc } = args
                      const { id } = doc
                      // Use imported createClient instead of require
                      const searchClient = createClient(searchConfig.algolia)
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

// Environment Configuration - Read from .env file
const AWS_ACCESS_KEY = process.env.S3_ACCESS_KEY || process.env.AWS_ACCESS_KEY
const AWS_SECRET_KEY = process.env.S3_SECRET_KEY || process.env.AWS_SECRET_KEY
const AWS_REGION = process.env.S3_REGION || process.env.AWS_REGION || 'us-west-1'
const AWS_ENDPOINT = process.env.S3_ENDPOINT || process.env.AWS_ENDPOINT

const ALGOLIA_APP_ID = process.env.ALGOLIA_APP_ID
const ALGOLIA_ADMIN_API_KEY = process.env.ALGOLIA_ADMIN_API_KEY
const ALGOLIA_INDEX = process.env.ALGOLIA_INDEX || 'rs_cms'

const DATABASE_URI = process.env.DATABASE_URI
const PAYLOAD_SECRET = process.env.PAYLOAD_SECRET

// Validate required environment variables
if (!AWS_ACCESS_KEY || !AWS_SECRET_KEY || !AWS_ENDPOINT) {
  console.error('Missing required AWS S3 environment variables')
}

if (!ALGOLIA_APP_ID || !ALGOLIA_ADMIN_API_KEY) {
  console.error('Missing required Algolia environment variables')
}

if (!DATABASE_URI || !PAYLOAD_SECRET) {
  console.error('Missing required database or payload secret environment variables')
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
