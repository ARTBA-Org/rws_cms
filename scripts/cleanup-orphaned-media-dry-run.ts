import type { SanitizedConfig } from 'payload'
import payload from 'payload'

export const script = async (config: SanitizedConfig) => {
  await payload.init({ config })

  payload.logger.info('🔍 Starting orphaned media dry run (no files will be deleted)...')

  try {
    // Get all media files
    const allMedia = await payload.find({
      collection: 'media',
      limit: 1000,
      pagination: false,
    })

    payload.logger.info(`📊 Found ${allMedia.docs.length} total media files`)

    let orphanedCount = 0
    let totalSize = 0
    const orphanedFiles: any[] = []
    const referencedFiles: any[] = []

    for (const mediaFile of allMedia.docs) {
      const references = await checkMediaReferences(mediaFile.id)

      if (references.length === 0) {
        orphanedFiles.push(mediaFile)
        totalSize += mediaFile.filesize || 0
        orphanedCount++
        payload.logger.info(
          `🗑️  Would delete: ${mediaFile.filename} (${formatBytes(mediaFile.filesize || 0)})`,
        )
      } else {
        referencedFiles.push({ file: mediaFile, references })
        payload.logger.info(
          `✅ Keep: ${mediaFile.filename} - Referenced in: ${references.join(', ')}`,
        )
      }
    }

    payload.logger.info(`\n📈 Dry Run Summary:`)
    payload.logger.info(`Total media files: ${allMedia.docs.length}`)
    payload.logger.info(`Orphaned files (would be deleted): ${orphanedCount}`)
    payload.logger.info(`Referenced files (would be kept): ${allMedia.docs.length - orphanedCount}`)
    payload.logger.info(`Total space that would be freed: ${formatBytes(totalSize)}`)

    if (orphanedCount > 0) {
      payload.logger.info(`\n📋 Orphaned files list:`)
      orphanedFiles.forEach((file, index) => {
        payload.logger.info(
          `${index + 1}. ${file.filename} (${formatBytes(file.filesize || 0)}) - ID: ${file.id}`,
        )
      })

      payload.logger.info(`\n💡 To actually delete these files, run: pnpm payload cleanup-media`)
    } else {
      payload.logger.info('🎉 No orphaned files found! Your media library is clean.')
    }
  } catch (error) {
    payload.logger.error(`❌ Dry run failed: ${error}`)
  }

  process.exit(0)
}

async function checkMediaReferences(mediaId: string): Promise<string[]> {
  const references: string[] = []

  try {
    // Check slides
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
      references.push(`${slidesWithMedia.totalDocs} slide(s)`)
    }

    // Check modules (thumbnail)
    const modulesWithThumbnail = await payload.find({
      collection: 'modules',
      where: {
        moduleThumbnail: {
          equals: mediaId,
        },
      },
      limit: 1,
    })

    if (modulesWithThumbnail.totalDocs > 0) {
      references.push(`${modulesWithThumbnail.totalDocs} module thumbnail(s)`)
    }

    // Check modules (PDF upload)
    const modulesWithPdf = await payload.find({
      collection: 'modules',
      where: {
        pdfUpload: {
          equals: mediaId,
        },
      },
      limit: 1,
    })

    if (modulesWithPdf.totalDocs > 0) {
      references.push(`${modulesWithPdf.totalDocs} module PDF(s)`)
    }

    // Check courses
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
      references.push(`${coursesWithMedia.totalDocs} course thumbnail(s)`)
    }
  } catch (error) {
    payload.logger.warn(`⚠️  Could not check references for media ${mediaId}: ${error}`)
  }

  return references
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}
