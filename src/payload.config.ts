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
import { importExportPlugin } from '@payloadcms/plugin-import-export'
import { nestedDocsPlugin } from '@payloadcms/plugin-nested-docs'
// AlgoliaSearchPlugin is no longer used directly
// import { AlgoliaSearchPlugin } from 'payload-plugin-algolia'
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
if (!DATABASE_URI) {
  throw new Error('DATABASE_URI environment variable is required')
}

if (!PAYLOAD_SECRET) {
  throw new Error('PAYLOAD_SECRET environment variable is required')
}

if (!AWS_ACCESS_KEY || !AWS_SECRET_KEY || !AWS_ENDPOINT) {
  console.warn('Missing AWS S3 environment variables - S3 storage will be disabled')
}

if (!ALGOLIA_APP_ID || !ALGOLIA_ADMIN_API_KEY) {
  console.warn('Missing Algolia environment variables - Search functionality will be disabled')
}

export default buildConfig({
  admin: {
    user: 'users',
    importMap: {
      baseDir: path.resolve(dirname),
    },
    // Reduce admin DB lookups that can fail on short-lived connections
    livePreview: null,
  },
  // Folders temporarily disabled due to compatibility issue
  // folders: {
  //   browseByFolder: true,
  // },
  // Custom scripts
  bin: [
    // Media cleanup scripts
    {
      scriptPath: path.resolve(dirname, '../scripts/cleanup-orphaned-media-dry-run.ts'),
      key: 'cleanup-media-dry-run',
    },
    {
      scriptPath: path.resolve(dirname, '../scripts/cleanup-orphaned-media.ts'),
      key: 'cleanup-media',
    },
    // Data cleanup scripts
    {
      scriptPath: path.resolve(dirname, '../scripts/cleanup-all-data.ts'),
      key: 'cleanup-all-data',
    },
    {
      scriptPath: path.resolve(dirname, '../scripts/cleanup-content-only.ts'),
      key: 'cleanup-content-only',
    },
    {
      scriptPath: path.resolve(dirname, '../scripts/fix-database-constraints.ts'),
      key: 'fix-database-constraints',
    },
    {
      scriptPath: path.resolve(dirname, '../scripts/reset-database-schema.ts'),
      key: 'reset-database-schema',
    },
    // Seeding scripts
    {
      scriptPath: path.resolve(dirname, '../scripts/seed-nested-structure.ts'),
      key: 'seed-nested',
    },
    {
      scriptPath: path.resolve(dirname, '../scripts/seed-sample-data.ts'),
      key: 'seed-sample',
    },
  ],
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
      ssl: { rejectUnauthorized: false },
      // Serverless-safe pool settings
      max: 4,
      min: 0,
      idleTimeoutMillis: 0,
      connectionTimeoutMillis: 5000,
      keepAlive: true,
      statement_timeout: 300000, // 5 minutes for PDF processing
    },
  }),
  sharp,
  plugins: [
    // Import/Export plugin for slides, modules, and courses
    importExportPlugin({
      collections: ['slides', 'modules', 'courses'],
    }),
    // Nested Docs plugin for hierarchical structure
    nestedDocsPlugin({
      collections: ['courses', 'modules', 'slides'],
      generateLabel: (_, doc) => doc.title || 'Untitled',
      generateURL: (docs) => docs.reduce((url, doc) => `${url}/${doc.slug || doc.id}`, ''),
    }),
    // Conditionally add S3 storage if environment variables are available
    AWS_ACCESS_KEY &&
      AWS_SECRET_KEY &&
      AWS_ENDPOINT &&
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
    // Disable Algolia plugin by default; re-enable if you prefer Algolia
  ].filter(Boolean),
})
