import type { SanitizedConfig } from 'payload'
import payload from 'payload'

export const script = async (config: SanitizedConfig) => {
  await payload.init({ config })

  payload.logger.info('🧹 Starting complete data cleanup...')
  payload.logger.warn('⚠️  This will DELETE ALL existing data!')

  try {
    let totalDeleted = 0

    // Collections to clean up (in order to respect relationships)
    const collectionsToClean = [
      { name: 'slides', displayName: 'Slides' },
      { name: 'modules', displayName: 'Modules' },
      { name: 'courses', displayName: 'Courses' },
      { name: 'media', displayName: 'Media Files' },
    ]

    for (const collection of collectionsToClean) {
      payload.logger.info(`\n🗑️  Cleaning up ${collection.displayName}...`)

      try {
        // Get all documents in the collection
        const allDocs = await payload.find({
          collection: collection.name,
          limit: 1000,
          pagination: false,
          // Include trashed items
          trash: true,
        })

        if (allDocs.docs.length === 0) {
          payload.logger.info(`   ✅ No ${collection.displayName.toLowerCase()} found`)
          continue
        }

        payload.logger.info(
          `   📊 Found ${allDocs.docs.length} ${collection.displayName.toLowerCase()}`,
        )

        // Delete all documents
        const deletePromises = allDocs.docs.map(async (doc) => {
          try {
            await payload.delete({
              collection: collection.name,
              id: doc.id,
              // Force permanent deletion (bypass trash)
              overrideLock: true,
            })
            return { success: true, id: doc.id, title: doc.title || doc.filename || doc.id }
          } catch (error) {
            payload.logger.error(`   ❌ Failed to delete ${doc.id}: ${error}`)
            return { success: false, id: doc.id, error }
          }
        })

        const results = await Promise.all(deletePromises)
        const successful = results.filter((r) => r.success)
        const failed = results.filter((r) => !r.success)

        payload.logger.info(
          `   ✅ Deleted ${successful.length} ${collection.displayName.toLowerCase()}`,
        )
        if (failed.length > 0) {
          payload.logger.warn(`   ⚠️  Failed to delete ${failed.length} items`)
        }

        totalDeleted += successful.length

        // Log some deleted items for confirmation
        if (successful.length > 0) {
          const sampleItems = successful.slice(0, 3)
          sampleItems.forEach((item) => {
            payload.logger.info(`     - ${item.title}`)
          })
          if (successful.length > 3) {
            payload.logger.info(`     ... and ${successful.length - 3} more`)
          }
        }
      } catch (error) {
        payload.logger.error(`   ❌ Error cleaning ${collection.displayName}: ${error}`)
      }
    }

    // Clean up any orphaned trash items
    payload.logger.info(`\n🗑️  Cleaning up trash...`)
    try {
      for (const collection of collectionsToClean) {
        const trashedDocs = await payload.find({
          collection: collection.name,
          trash: true,
          where: {
            deletedAt: {
              exists: true,
            },
          },
          limit: 1000,
        })

        if (trashedDocs.docs.length > 0) {
          payload.logger.info(
            `   🗑️  Found ${trashedDocs.docs.length} trashed ${collection.displayName.toLowerCase()}`,
          )

          for (const doc of trashedDocs.docs) {
            try {
              await payload.delete({
                collection: collection.name,
                id: doc.id,
                overrideLock: true,
              })
            } catch (error) {
              payload.logger.warn(`   ⚠️  Could not permanently delete trashed item ${doc.id}`)
            }
          }
        }
      }
    } catch (error) {
      payload.logger.warn(`   ⚠️  Error cleaning trash: ${error}`)
    }

    // Summary
    payload.logger.info(`\n📈 Cleanup Summary:`)
    payload.logger.info(`   Total items deleted: ${totalDeleted}`)
    payload.logger.info(`   Collections cleaned: ${collectionsToClean.length}`)

    if (totalDeleted > 0) {
      payload.logger.info(`\n🎉 Database cleanup completed successfully!`)
      payload.logger.info(`💡 You can now run 'pnpm seed:nested' to create sample data`)
    } else {
      payload.logger.info(`\n✨ Database was already clean!`)
    }
  } catch (error) {
    payload.logger.error(`❌ Cleanup failed: ${error}`)
  }

  process.exit(0)
}
