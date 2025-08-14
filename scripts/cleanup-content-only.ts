import type { SanitizedConfig } from 'payload'
import payload from 'payload'

export const script = async (config: SanitizedConfig) => {
  await payload.init({ config })

  payload.logger.info('🧹 Starting content-only cleanup...')
  payload.logger.info('👥 Users will be preserved')

  try {
    let totalDeleted = 0

    // Only clean content collections (preserve users)
    const collectionsToClean = [
      { name: 'slides', displayName: 'Slides' },
      { name: 'modules', displayName: 'Modules' },
      { name: 'courses', displayName: 'Courses' },
    ]

    for (const collection of collectionsToClean) {
      payload.logger.info(`\n🗑️  Cleaning up ${collection.displayName}...`)

      try {
        // Get all documents including trashed ones
        const allDocs = await payload.find({
          collection: collection.name,
          limit: 1000,
          pagination: false,
          trash: true, // Include soft-deleted items
        })

        if (allDocs.docs.length === 0) {
          payload.logger.info(`   ✅ No ${collection.displayName.toLowerCase()} found`)
          continue
        }

        payload.logger.info(
          `   📊 Found ${allDocs.docs.length} ${collection.displayName.toLowerCase()}`,
        )

        // Delete all documents permanently
        for (const doc of allDocs.docs) {
          try {
            await payload.delete({
              collection: collection.name,
              id: doc.id,
              overrideLock: true,
            })
            payload.logger.info(`     ✅ Deleted: ${doc.title || doc.id}`)
            totalDeleted++
          } catch (error) {
            payload.logger.error(`     ❌ Failed to delete ${doc.title || doc.id}: ${error}`)
          }
        }
      } catch (error) {
        payload.logger.error(`   ❌ Error cleaning ${collection.displayName}: ${error}`)
      }
    }

    // Ask about media cleanup
    payload.logger.info(`\n📁 Media files were preserved.`)
    payload.logger.info(`💡 Run 'pnpm cleanup:media:dry-run' to see orphaned media files`)
    payload.logger.info(`💡 Run 'pnpm cleanup:media' to remove orphaned media files`)

    // Summary
    payload.logger.info(`\n📈 Content Cleanup Summary:`)
    payload.logger.info(`   Content items deleted: ${totalDeleted}`)
    payload.logger.info(`   Users preserved: ✅`)
    payload.logger.info(`   Media files preserved: ✅`)

    if (totalDeleted > 0) {
      payload.logger.info(`\n🎉 Content cleanup completed successfully!`)
      payload.logger.info(`💡 You can now run 'pnpm seed:nested' to create sample data`)
    } else {
      payload.logger.info(`\n✨ No content found to clean!`)
    }
  } catch (error) {
    payload.logger.error(`❌ Content cleanup failed: ${error}`)
  }

  process.exit(0)
}
