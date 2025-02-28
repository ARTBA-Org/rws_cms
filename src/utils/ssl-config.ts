/**
 * SSL Configuration for PostgreSQL
 *
 * This file provides SSL configuration options for PostgreSQL connections.
 * It handles self-signed certificates and other SSL-related settings.
 */

// Default SSL configuration for PostgreSQL
export const getSSLConfig = () => {
  // Check if SSL is enabled (default to true)
  const sslEnabled = process.env.PG_SSL_ENABLED !== 'false'

  // If SSL is disabled, return false
  if (!sslEnabled) {
    return false
  }

  // Get SSL reject unauthorized setting (default to false to accept self-signed certs)
  const rejectUnauthorized = process.env.PG_SSL_REJECT_UNAUTHORIZED === 'true'

  // Basic configuration
  const sslConfig: any = {
    rejectUnauthorized,
  }

  // Add CA file if provided
  if (process.env.PG_SSL_CA_FILE) {
    try {
      const fs = require('fs')
      sslConfig.ca = fs.readFileSync(process.env.PG_SSL_CA_FILE).toString()
    } catch (error) {
      console.warn(`Warning: Could not read SSL CA file: ${process.env.PG_SSL_CA_FILE}`)
    }
  }

  // Return the SSL configuration
  return sslConfig
}

// Export a function to get the full database connection options
export const getDBConnectionOptions = (connectionString: string | undefined) => {
  if (!connectionString) {
    throw new Error('Database connection string is required')
  }

  // Get SSL configuration
  const ssl = getSSLConfig()

  return {
    connectionString,
    ssl,
    max: 20, // Maximum number of clients in the pool
    min: 5, // Minimum number of idle clients maintained in the pool
    idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
    connectionTimeoutMillis: 10000, // Return an error after 10 seconds if connection could not be established
    statement_timeout: 60000, // Statement timeout in milliseconds (60 seconds)
  }
}
