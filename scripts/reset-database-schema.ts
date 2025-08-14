import type { SanitizedConfig } from 'payload'

export const script = async (config: SanitizedConfig) => {
  console.log('🔄 Starting database schema reset...')
  console.warn('⚠️  This will reset the database schema and all data!')

  try {
    // Import payload dynamically to avoid initialization issues
    const { default: payload } = await import('payload')

    // Initialize with minimal config to access database
    await payload.init({
      config,
      disableDBConnect: false,
    })

    const db = payload.db

    if (db.name !== 'postgres') {
      console.error('❌ This script only works with PostgreSQL databases')
      process.exit(1)
    }

    console.log('🗃️  Connected to PostgreSQL database')

    // Step 1: Drop all constraints first
    console.log('\n🔗 Dropping all foreign key constraints...')

    const dropConstraintsQuery = `
      DO $$ 
      DECLARE 
          r RECORD;
      BEGIN
          FOR r IN (SELECT constraint_name, table_name 
                    FROM information_schema.table_constraints 
                    WHERE constraint_type = 'FOREIGN KEY' 
                    AND table_schema = 'public') 
          LOOP
              EXECUTE 'ALTER TABLE ' || quote_ident(r.table_name) || ' DROP CONSTRAINT IF EXISTS ' || quote_ident(r.constraint_name);
          END LOOP;
      END $$;
    `

    try {
      await db.drizzle.execute(dropConstraintsQuery)
      console.log('   ✅ Dropped all foreign key constraints')
    } catch (error) {
      console.warn(`   ⚠️  Could not drop constraints: ${error}`)
    }

    // Step 2: Drop all tables
    console.log('\n🗑️  Dropping all tables...')

    const dropTablesQuery = `
      DO $$ 
      DECLARE 
          r RECORD;
      BEGIN
          FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') 
          LOOP
              EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(r.tablename) || ' CASCADE';
          END LOOP;
      END $$;
    `

    try {
      await db.drizzle.execute(dropTablesQuery)
      console.log('   ✅ Dropped all tables')
    } catch (error) {
      console.warn(`   ⚠️  Could not drop all tables: ${error}`)
    }

    // Step 3: Drop all sequences
    console.log('\n🔢 Dropping all sequences...')

    const dropSequencesQuery = `
      DO $$ 
      DECLARE 
          r RECORD;
      BEGIN
          FOR r IN (SELECT sequence_name FROM information_schema.sequences WHERE sequence_schema = 'public') 
          LOOP
              EXECUTE 'DROP SEQUENCE IF EXISTS ' || quote_ident(r.sequence_name) || ' CASCADE';
          END LOOP;
      END $$;
    `

    try {
      await db.drizzle.execute(dropSequencesQuery)
      console.log('   ✅ Dropped all sequences')
    } catch (error) {
      console.warn(`   ⚠️  Could not drop sequences: ${error}`)
    }

    console.log('\n🎉 Database schema reset completed!')
    console.log('💡 Restart your application to create fresh schema')
    console.log('💡 Run "pnpm seed:nested" to create sample data')
  } catch (error) {
    console.error(`❌ Database reset failed: ${error}`)
    console.log('💡 You may need to manually reset your database')
  }

  process.exit(0)
}
