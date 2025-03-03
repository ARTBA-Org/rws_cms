/**
 * SSL Configuration for PostgreSQL
 *
 * This file provides SSL configuration options for PostgreSQL connections.
 * It handles self-signed certificates and other SSL-related settings.
 */

// Default SSL configuration for PostgreSQL
export const getSSLConfig = () => {
  // Always disable SSL certificate validation for self-signed certificates
  return {
    rejectUnauthorized: false,
  }
}

// Export a function to get the full database connection options
export const getDBConnectionOptions = (connectionString: string | undefined) => {
  // Skip database connection during build if NEXT_BUILD_SKIP_DB is set
  if (process.env.NEXT_BUILD_SKIP_DB === 'true') {
    console.log('⚠️ Skipping database connection during build')
    // Return hardcoded parameters that won't actually try to connect
    return {
      // Don't use connectionString at all when skipping
      host: 'localhost',
      port: 5432,
      database: 'postgres',
      user: 'postgres',
      password: 'postgres',
      ssl: false,
      // Set a very short connection timeout to fail fast
      connectionTimeoutMillis: 1,
      // Set to 0 to prevent connection pool from being created
      max: 0,
      min: 0,
    }
  }

  // For AWS Amplify runtime, use the environment variables directly
  if (
    process.env.PGHOST &&
    process.env.PGUSER &&
    process.env.PGPASSWORD &&
    process.env.PGDATABASE
  ) {
    console.log(`Using PostgreSQL connection parameters from environment variables`)
    const host = process.env.PGHOST
    const port = process.env.PGPORT || '5432'
    const database = process.env.PGDATABASE
    const user = process.env.PGUSER
    const password = process.env.PGPASSWORD
    const sslmode = process.env.PGSSLMODE || 'no-verify'

    // Construct a new connection string from environment variables
    const constructedConnectionString = `postgresql://${user}:${password}@${host}:${port}/${database}?sslmode=${sslmode}`

    // Log the connection string (with password masked)
    const maskedConnectionString = constructedConnectionString.replace(/:[^:@]*@/, ':***@')
    console.log('Database connection string (from env vars):', maskedConnectionString)

    // Get SSL configuration
    const ssl = getSSLConfig()

    return {
      connectionString: constructedConnectionString,
      ssl,
      max: 20, // Maximum number of clients in the pool
      min: 5, // Minimum number of idle clients maintained in the pool
      idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
      connectionTimeoutMillis: 10000, // Return an error after 10 seconds if connection could not be established
      statement_timeout: 60000, // Statement timeout in milliseconds (60 seconds)
    }
  }

  if (!connectionString) {
    console.error('Database connection string is required and not provided')
    // Return hardcoded parameters that won't actually try to connect
    return {
      // Don't use connectionString at all when no connection string is provided
      host: 'localhost',
      port: 5432,
      database: 'postgres',
      user: 'postgres',
      password: 'postgres',
      ssl: false,
      // Set a very short connection timeout to fail fast
      connectionTimeoutMillis: 1,
      // Set to 0 to prevent connection pool from being created
      max: 0,
      min: 0,
    }
  }

  console.log('Setting up database connection with SSL configuration')

  // Modify the connection string to use sslmode=no-verify
  let modifiedConnectionString = connectionString
  if (modifiedConnectionString.includes('?')) {
    // Add sslmode=no-verify if it doesn't already have it
    if (!modifiedConnectionString.includes('sslmode=no-verify')) {
      modifiedConnectionString = modifiedConnectionString.replace(
        'sslmode=require',
        'sslmode=no-verify',
      )
      if (!modifiedConnectionString.includes('sslmode=')) {
        modifiedConnectionString += '&sslmode=no-verify'
      }
    }
  } else {
    // Add sslmode=no-verify as a new query parameter
    modifiedConnectionString += '?sslmode=no-verify'
  }

  // Log the connection string (with password masked)
  const maskedConnectionString = modifiedConnectionString.replace(/:[^:@]*@/, ':***@')
  console.log('Database connection string:', maskedConnectionString)

  // Get SSL configuration
  const ssl = getSSLConfig()

  // Try to parse the connection string to extract host, port, etc.
  try {
    const url = new URL(modifiedConnectionString.replace('postgresql://', 'http://'))
    console.log(
      `Connecting to database at ${url.hostname}:${url.port || '5432'}/${url.pathname.substring(1)}`,
    )
  } catch (err: unknown) {
    console.error(
      'Failed to parse connection string:',
      err instanceof Error ? err.message : String(err),
    )
  }

  return {
    connectionString: modifiedConnectionString,
    ssl,
    max: 20, // Maximum number of clients in the pool
    min: 5, // Minimum number of idle clients maintained in the pool
    idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
    connectionTimeoutMillis: 10000, // Return an error after 10 seconds if connection could not be established
    statement_timeout: 60000, // Statement timeout in milliseconds (60 seconds)
  }
}
