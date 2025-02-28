/**
 * Test PostgreSQL Connection
 *
 * This script tests the connection to PostgreSQL with SSL settings.
 * Run with: node scripts/test-db-connection.js
 */

// Load environment variables
import dotenv from 'dotenv'
import pg from 'pg'

dotenv.config()

const { Pool } = pg

// Get database connection details from environment variables
let connectionString = process.env.DATABASE_URI

// Parse the connection string and ensure it has sslmode=no-verify
if (connectionString) {
  // If the connection string already has query parameters
  if (connectionString.includes('?')) {
    // Add sslmode=no-verify if it doesn't already have it
    if (!connectionString.includes('sslmode=no-verify')) {
      connectionString = connectionString.replace(/sslmode=[^&]+/, 'sslmode=no-verify')
      if (!connectionString.includes('sslmode=')) {
        connectionString += '&sslmode=no-verify'
      }
    }
  } else {
    // Add sslmode=no-verify as a new query parameter
    connectionString += '?sslmode=no-verify'
  }
}

console.log('Testing PostgreSQL connection with the following configuration:')
console.log('Connection String (masked):', connectionString?.replace(/:[^:@]*@/, ':***@'))
console.log('PGSSLMODE:', process.env.PGSSLMODE || 'not set')

// Create a connection pool with SSL settings
const pool = new Pool({
  connectionString,
  // Additional SSL settings to handle self-signed certificates
  ssl: {
    rejectUnauthorized: false,
  },
})

// Test the connection
async function testConnection() {
  let client
  try {
    console.log('Connecting to PostgreSQL...')
    client = await pool.connect()
    console.log('✅ Connection successful!')

    // Query the database version
    const result = await client.query('SELECT version()')
    console.log('✅ PostgreSQL Version:', result.rows[0].version)

    // Test a simple query
    console.log('Testing a simple query...')
    const testResult = await client.query('SELECT NOW() as current_time')
    console.log('✅ Current time from database:', testResult.rows[0].current_time)

    // Test database permissions
    console.log('Testing database permissions...')
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      LIMIT 5
    `)

    if (tablesResult.rows.length > 0) {
      console.log('✅ Tables found in database:')
      tablesResult.rows.forEach((row) => {
        console.log(`  - ${row.table_name}`)
      })
    } else {
      console.log(
        '⚠️ No tables found in the public schema. This might be expected for a new database.',
      )
    }

    console.log('\n✅ All tests passed successfully!')
  } catch (error) {
    console.error('❌ Error connecting to PostgreSQL:')
    console.error(error)
    process.exit(1)
  } finally {
    if (client) {
      client.release()
    }
    // Close the pool
    await pool.end()
  }
}

// Run the test
testConnection()
