import { CollectionAfterChangeHook } from 'payload/types'
import { getObjectID } from 'payload-plugin-algolia/dist/hooks/syncWithSearch'
import createClient from 'payload-plugin-algolia/dist/algolia'
import { AlgoliaSearchConfig } from 'payload-plugin-algolia/dist/types'

// More explicit types for the function arguments
type CollectionDocument = {
  id: string
  title?: string
  _status?: string
  [key: string]: unknown
}

type CollectionInfo = {
  slug: string
  [key: string]: unknown
}

type SearchFunctionArgs = {
  collection: CollectionInfo
  doc: CollectionDocument
  req: { payload: any }
  previousDoc?: CollectionDocument
}

// Enhanced version of the syncWithSearch hook with better error handling
export default function enhancedSyncWithSearch(
  searchConfig: AlgoliaSearchConfig,
): CollectionAfterChangeHook {
  return async (args: Parameters<CollectionAfterChangeHook>[0]) => {
    const {
      collection,
      doc,
      req: { payload },
      previousDoc,
    } = args as SearchFunctionArgs

    try {
      if (doc?._status === 'draft' && !previousDoc) {
        // quick early exit for first drafts
        return doc
      }

      const searchClient = createClient(searchConfig.algolia)
      const objectID = getObjectID({ collection, doc })

      // remove search results for unpublished docs
      if (doc?._status === 'draft' && previousDoc) {
        // distinguish between "pending change" (canonical document is still published)
        // vs "unpublish" (canonical document is draft)
        try {
          const publishedDoc = await payload.findByID({
            collection: collection.slug,
            id: doc.id,
            draft: false,
          })

          if (publishedDoc && publishedDoc._status === 'published') {
            // ignore pending changes
            return doc
          } else {
            // remove search results for unpublished
            const deleteOp = searchClient.deleteObject(objectID)

            if (searchConfig.waitForHook === true) {
              await deleteOp.wait()
            }

            return doc
          }
        } catch (error) {
          // Log specific details about this error
          payload.logger.error({
            err: `Error checking published state for ${collection.slug} ${doc.id}: ${error instanceof Error ? error.message : String(error)}`,
            stack: error instanceof Error ? error.stack : undefined,
            docId: doc.id,
            collectionSlug: collection.slug,
          })
          return doc
        }
      }

      const generateSearchAttributesFn =
        searchConfig.generateSearchAttributes ||
        ((searchArgs: SearchFunctionArgs) => {
          return {
            collection: searchArgs.collection.slug,
            ...searchArgs.doc,
          }
        })

      const searchDoc = await generateSearchAttributesFn(args as SearchFunctionArgs)

      if (!searchDoc) {
        payload.logger.warn({
          msg: `No search document generated for ${collection.slug} ${doc.id}. Skipping search sync.`,
          docId: doc.id,
          collectionSlug: collection.slug,
        })
        return doc
      }

      const saveOp = searchClient.saveObject({
        objectID,
        collection: collection.slug,
        ...searchDoc,
      })

      if (searchConfig.waitForHook === true) {
        await saveOp.wait()
      }

      payload.logger.info({
        msg: `Successfully synced ${collection.slug} ${doc.id} to search index ${searchConfig.algolia.index}`,
        docId: doc.id,
        collectionSlug: collection.slug,
      })
    } catch (error) {
      // Enhanced error logging with detailed information
      payload.logger.error({
        msg: `Error syncing search for ${collection.slug} ${doc.id}`,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        docId: doc.id,
        collectionSlug: collection.slug,
        docData: JSON.stringify({
          id: doc.id,
          title: doc.title,
          _status: doc._status,
        }),
      })
    }

    return doc
  }
}
