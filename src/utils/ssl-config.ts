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
  if (process.env.NEXT_BUILD_SKIP_DB === 'true' && process.env.NODE_ENV === 'production') {
    console.log('⚠️ Skipping database connection during build')
    // Return a minimal configuration that won't be used during build
    return {
      connectionString: 'postgresql://skip:skip@localhost:5432/skip',
      ssl: { rejectUnauthorized: false },
    }
  }

  if (!connectionString) {
    throw new Error('Database connection string is required')
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
