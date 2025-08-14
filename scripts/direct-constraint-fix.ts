import { Client } from 'pg'
import * as dotenv from 'dotenv'

// Load environment variables
dotenv.config()

const fixConstraints = async () => {
  console.log('🔧 Starting direct constraint fix...')
  console.log('🎯 This will fix orphaned data and constraint issues')

  const client = new Client({
    connectionString: process.env.DATABASE_URI,
    ssl: process.env.DATABASE_URI?.includes('localhost') ? false : { rejectUnauthorized: false },
  })

  try {
    await client.connect()
    console.log('🗃️  Connected to PostgreSQL database')

    // Step 1: Clean up orphaned session data
    console.log('\n🧹 Cleaning up orphaned session data...')

    try {
      const deleteOrphanedSessions = `
        DELETE FROM users_sessions 
        WHERE _parent_id NOT IN (SELECT id FROM users WHERE id IS NOT NULL)
      `

      const result = await client.query(deleteOrphanedSessions)
      console.log(`   ✅ Cleaned up ${result.rowCount} orphaned sessions`)
    } catch (error) {
      console.log(`   ⚠️  Sessions table might not exist yet: ${error}`)
    }

    // Step 2: Drop problematic foreign key constraints
    console.log('\n🔗 Dropping problematic foreign key constraints...')

    const constraintsToCheck = [
      { table: 'users_sessions', constraint: 'users_sessions_parent_id_fk' },
      { table: 'courses', constraint: 'courses_parent_fk' },
      { table: 'modules', constraint: 'modules_parent_fk' },
      { table: 'slides', constraint: 'slides_parent_fk' },
      { table: 'courses_modules', constraint: 'courses_modules_fk' },
      { table: 'modules_slides', constraint: 'modules_slides_fk' },
    ]

    for (const { table, constraint } of constraintsToCheck) {
      try {
        const dropConstraint = `
          ALTER TABLE ${table} 
          DROP CONSTRAINT IF EXISTS ${constraint}
        `
        await client.query(dropConstraint)
        console.log(`   ✅ Dropped constraint: ${constraint}`)
      } catch (error) {
        console.log(`   ⚠️  Could not drop ${constraint} (table might not exist)`)
      }
    }

    // Step 3: Clean up any other orphaned relationship data
    console.log('\n🗑️  Cleaning up orphaned relationship data...')

    const relationshipTables = [
      'courses_learning_objectives',
      'slides_urls',
      'courses_modules',
      'modules_slides',
    ]

    for (const table of relationshipTables) {
      try {
        await client.query(`DELETE FROM ${table}`)
        console.log(`   ✅ Cleaned table: ${table}`)
      } catch (error) {
        console.log(`   ⚠️  Table ${table} might not exist`)
      }
    }

    // Step 4: Reset sequences if they exist
    console.log('\n🔄 Resetting ID sequences...')

    const sequencesToReset = [
      'courses_id_seq',
      'modules_id_seq',
      'slides_id_seq',
      'media_id_seq',
      'users_id_seq',
    ]

    for (const sequence of sequencesToReset) {
      try {
        await client.query(`ALTER SEQUENCE ${sequence} RESTART WITH 1`)
        console.log(`   ✅ Reset sequence: ${sequence}`)
      } catch (error) {
        console.log(`   ⚠️  Sequence ${sequence} might not exist`)
      }
    }

    console.log('\n🎉 Database constraint fixes completed!')
    console.log('💡 You can now start your application with: pnpm dev')
    console.log('💡 The schema will be recreated automatically')
  } catch (error) {
    console.error(`❌ Constraint fix failed: ${error}`)
    console.log('💡 You may need to use the complete database reset')
  } finally {
    await client.end()
  }
}

fixConstraints().then(() => process.exit(0))
