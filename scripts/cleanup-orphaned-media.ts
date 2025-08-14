import type { SanitizedConfig } from 'payload'
import payload from 'payload'

export const script = async (config: SanitizedConfig) => {
  await payload.init({ config })

  payload.logger.info('🧹 Starting orphaned media cleanup...')

  try {
    // Get all media files
    const allMedia = await payload.find({
      collection: 'media',
      limit: 1000,
      pagination: false,
    })

    payload.logger.info(`📊 Found ${allMedia.docs.length} total media files`)

    let deletedCount = 0
    let totalSize = 0
    const orphanedFiles: any[] = []

    for (const mediaFile of allMedia.docs) {
      const isReferenced = await checkIfMediaIsReferenced(mediaFile.id)

      if (!isReferenced) {
        orphanedFiles.push(mediaFile)
        totalSize += mediaFile.filesize || 0

        // Delete the orphaned media file
        await payload.delete({
          collection: 'media',
          id: mediaFile.id,
        })

        payload.logger.info(
          `🗑️  Deleted orphaned file: ${mediaFile.filename} (${formatBytes(mediaFile.filesize || 0)})`,
        )
        deletedCount++
      } else {
        payload.logger.info(`✅ Keeping referenced file: ${mediaFile.filename}`)
      }
    }

    payload.logger.info(`\n📈 Cleanup Summary:`)
    payload.logger.info(`Total media files processed: ${allMedia.docs.length}`)
    payload.logger.info(`Orphaned files deleted: ${deletedCount}`)
    payload.logger.info(`Files kept (referenced): ${allMedia.docs.length - deletedCount}`)
    payload.logger.info(`Total space freed: ${formatBytes(totalSize)}`)

    if (deletedCount === 0) {
      payload.logger.info('🎉 No orphaned files found! Your media library is clean.')
    } else {
      payload.logger.info(`🎉 Successfully cleaned up ${deletedCount} orphaned media files!`)
    }
  } catch (error) {
    payload.logger.error(`❌ Cleanup failed: ${error}`)
  }

  process.exit(0)
}

async function checkIfMediaIsReferenced(mediaId: string): Promise<boolean> {
  try {
    // Check if media is referenced in slides
    const slidesWithMedia = await payload.find({
      collection: 'slides',
      where: {
        image: {
          equals: mediaId,
        },
      },
      limit: 1,
    })

    if (slidesWithMedia.totalDocs > 0) {
      return true
    }

    // Check if media is referenced in modules (thumbnail or PDF upload)
    const modulesWithMedia = await payload.find({
      collection: 'modules',
      where: {
        or: [
          {
            moduleThumbnail: {
              equals: mediaId,
            },
          },
          {
            pdfUpload: {
              equals: mediaId,
            },
          },
        ],
      },
      limit: 1,
    })

    if (modulesWithMedia.totalDocs > 0) {
      return true
    }

    // Check if media is referenced in courses (thumbnail)
    const coursesWithMedia = await payload.find({
      collection: 'courses',
      where: {
        Thumbnail: {
          equals: mediaId,
        },
      },
      limit: 1,
    })

    if (coursesWithMedia.totalDocs > 0) {
      return true
    }

    // If we get here, the media file is not referenced anywhere
    return false
  } catch (error) {
    payload.logger.warn(`⚠️  Could not check references for media ${mediaId}: ${error}`)
    // If we can't check, assume it's referenced to be safe
    return true
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}
