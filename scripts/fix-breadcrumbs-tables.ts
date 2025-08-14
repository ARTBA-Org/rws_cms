#!/usr/bin/env tsx

import { Client } from 'pg'
import * as dotenv from 'dotenv'

// Load environment variables
dotenv.config()

async function fixBreadcrumbsTables() {
  console.log('🔧 Fixing breadcrumbs tables...')

  const client = new Client({
    connectionString: process.env.DATABASE_URI,
  })

  try {
    await client.connect()
    console.log('✅ Connected to database')

    // Drop existing breadcrumbs tables with wrong constraints
    console.log('🗑️  Dropping existing breadcrumbs tables...')

    await client.query('DROP TABLE IF EXISTS modules_breadcrumbs CASCADE')
    console.log('✅ Dropped modules_breadcrumbs table')

    await client.query('DROP TABLE IF EXISTS slides_breadcrumbs CASCADE')
    console.log('✅ Dropped slides_breadcrumbs table')

    console.log('✅ Breadcrumbs tables dropped successfully!')
    console.log('ℹ️  The tables will be recreated automatically when you restart the application.')
  } catch (error) {
    console.error('❌ Error fixing breadcrumbs tables:', error)
  } finally {
    await client.end()
    process.exit(0)
  }
}

fixBreadcrumbsTables()
