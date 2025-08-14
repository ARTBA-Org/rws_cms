import { Client } from 'pg'
import * as dotenv from 'dotenv'

// Load environment variables
dotenv.config()

const resetDatabase = async () => {
  console.log('🔄 Starting direct database reset...')
  console.warn('⚠️  This will completely reset your PostgreSQL database!')

  const client = new Client({
    connectionString: process.env.DATABASE_URI,
    ssl: process.env.DATABASE_URI?.includes('localhost') ? false : { rejectUnauthorized: false },
  })

  try {
    await client.connect()
    console.log('🗃️  Connected to PostgreSQL database')

    // Step 1: Drop all foreign key constraints
    console.log('\n🔗 Dropping all foreign key constraints...')

    const dropConstraintsQuery = `
      DO $$ 
      DECLARE 
          r RECORD;
      BEGIN
          FOR r IN (
            SELECT constraint_name, table_name 
            FROM information_schema.table_constraints 
            WHERE constraint_type = 'FOREIGN KEY' 
            AND table_schema = 'public'
          ) 
          LOOP
              EXECUTE 'ALTER TABLE ' || quote_ident(r.table_name) || 
                     ' DROP CONSTRAINT IF EXISTS ' || quote_ident(r.constraint_name);
          END LOOP;
      END $$;
    `

    await client.query(dropConstraintsQuery)
    console.log('   ✅ Dropped all foreign key constraints')

    // Step 2: Drop all tables
    console.log('\n🗑️  Dropping all tables...')

    const dropTablesQuery = `
      DO $$ 
      DECLARE 
          r RECORD;
      BEGIN
          FOR r IN (
            SELECT tablename 
            FROM pg_tables 
            WHERE schemaname = 'public'
          ) 
          LOOP
              EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(r.tablename) || ' CASCADE';
          END LOOP;
      END $$;
    `

    await client.query(dropTablesQuery)
    console.log('   ✅ Dropped all tables')

    // Step 3: Drop all sequences
    console.log('\n🔢 Dropping all sequences...')

    const dropSequencesQuery = `
      DO $$ 
      DECLARE 
          r RECORD;
      BEGIN
          FOR r IN (
            SELECT sequence_name 
            FROM information_schema.sequences 
            WHERE sequence_schema = 'public'
          ) 
          LOOP
              EXECUTE 'DROP SEQUENCE IF EXISTS ' || quote_ident(r.sequence_name) || ' CASCADE';
          END LOOP;
      END $$;
    `

    await client.query(dropSequencesQuery)
    console.log('   ✅ Dropped all sequences')

    // Step 4: Drop all functions (if any)
    console.log('\n⚙️  Dropping all functions...')

    const dropFunctionsQuery = `
      DO $$ 
      DECLARE 
          r RECORD;
      BEGIN
          FOR r IN (
            SELECT routine_name, routine_type
            FROM information_schema.routines 
            WHERE routine_schema = 'public'
            AND routine_type = 'FUNCTION'
          ) 
          LOOP
              EXECUTE 'DROP FUNCTION IF EXISTS ' || quote_ident(r.routine_name) || ' CASCADE';
          END LOOP;
      END $$;
    `

    await client.query(dropFunctionsQuery)
    console.log('   ✅ Dropped all functions')

    // Step 5: Drop all types (if any)
    console.log('\n📝 Dropping all custom types...')

    const dropTypesQuery = `
      DO $$ 
      DECLARE 
          r RECORD;
      BEGIN
          FOR r IN (
            SELECT typname
            FROM pg_type 
            WHERE typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
            AND typtype = 'e'  -- enum types
          ) 
          LOOP
              EXECUTE 'DROP TYPE IF EXISTS ' || quote_ident(r.typname) || ' CASCADE';
          END LOOP;
      END $$;
    `

    await client.query(dropTypesQuery)
    console.log('   ✅ Dropped all custom types')

    console.log('\n🎉 Database completely reset!')
    console.log('💡 Your database is now completely clean')
    console.log('💡 Start your application with: pnpm dev')
    console.log('💡 Then seed data with: pnpm seed:nested')
  } catch (error) {
    console.error(`❌ Database reset failed: ${error}`)
    console.log('💡 Check your DATABASE_URI environment variable')
    console.log('💡 Make sure PostgreSQL is running and accessible')
  } finally {
    await client.end()
  }
}

resetDatabase().then(() => process.exit(0))
