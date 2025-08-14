import type { SanitizedConfig } from 'payload'
import payload from 'payload'

export const script = async (config: SanitizedConfig) => {
  payload.logger.info('🔧 Fixing database constraints and orphaned data...')

  try {
    // Initialize payload without schema validation to access the database
    await payload.init({
      config,
      disableDBConnect: false,
    })

    const db = payload.db

    if (db.name !== 'postgres') {
      payload.logger.error('❌ This script only works with PostgreSQL databases')
      process.exit(1)
    }

    payload.logger.info('🗃️  Connected to PostgreSQL database')

    // Step 1: Clean up orphaned session data
    payload.logger.info('\n🧹 Cleaning up orphaned session data...')

    try {
      // Delete sessions that reference non-existent users
      const deleteOrphanedSessions = `
        DELETE FROM users_sessions 
        WHERE _parent_id NOT IN (SELECT id FROM users)
      `

      const result = await db.drizzle.execute(deleteOrphanedSessions)
      payload.logger.info(`   ✅ Cleaned up orphaned sessions`)
    } catch (error) {
      payload.logger.warn(`   ⚠️  Could not clean sessions: ${error}`)
    }

    // Step 2: Drop problematic constraints temporarily
    payload.logger.info('\n🔗 Dropping problematic foreign key constraints...')

    const constraintsToCheck = [
      'users_sessions_parent_id_fk',
      'courses_modules_fk',
      'modules_slides_fk',
      'slides_parent_fk',
      'modules_parent_fk',
      'courses_parent_fk',
    ]

    for (const constraint of constraintsToCheck) {
      try {
        // Check if constraint exists and drop it
        const dropConstraint = `
          ALTER TABLE users_sessions 
          DROP CONSTRAINT IF EXISTS ${constraint}
        `
        await db.drizzle.execute(dropConstraint)
        payload.logger.info(`   ✅ Dropped constraint: ${constraint}`)
      } catch (error) {
        payload.logger.warn(`   ⚠️  Could not drop constraint ${constraint}`)
      }
    }

    // Step 3: Clean up any other orphaned data
    payload.logger.info('\n🗑️  Cleaning up other orphaned data...')

    const tablesToClean = [
      'courses_learning_objectives',
      'slides_urls',
      'courses_modules',
      'modules_slides',
    ]

    for (const table of tablesToClean) {
      try {
        await db.drizzle.execute(`DELETE FROM ${table}`)
        payload.logger.info(`   ✅ Cleaned table: ${table}`)
      } catch (error) {
        payload.logger.warn(`   ⚠️  Could not clean table ${table}: ${error}`)
      }
    }

    // Step 4: Reset sequences
    payload.logger.info('\n🔄 Resetting ID sequences...')

    const sequencesToReset = ['courses_id_seq', 'modules_id_seq', 'slides_id_seq', 'media_id_seq']

    for (const sequence of sequencesToReset) {
      try {
        await db.drizzle.execute(`ALTER SEQUENCE ${sequence} RESTART WITH 1`)
        payload.logger.info(`   ✅ Reset sequence: ${sequence}`)
      } catch (error) {
        payload.logger.warn(`   ⚠️  Could not reset sequence ${sequence}`)
      }
    }

    payload.logger.info('\n🎉 Database constraint fixes completed!')
    payload.logger.info('💡 You can now restart your application')
  } catch (error) {
    payload.logger.error(`❌ Database fix failed: ${error}`)
  }

  process.exit(0)
}
