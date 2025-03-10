// This script helps with environment variable setup in Amplify
// It creates a proper .env.production file even if environment variables are missing

const fs = require('fs')
const path = require('path')

// Function to safely get an environment variable with a fallback
function getEnvVar(name, fallback = '') {
  const value = process.env[name]
  if (!value) {
    console.log(`WARNING: ${name} environment variable is not set. Using fallback value.`)
    return fallback
  }
  return value
}

// Database configuration
const dbConfig = {
  DATABASE_URI: getEnvVar(
    'DATABASE_URI',
    'postgresql://postgres:postgres@localhost:5432/payload?sslmode=no-verify',
  ),
  PAYLOAD_SECRET: getEnvVar('PAYLOAD_SECRET', 'a-default-secret-for-builds-only'),
  PGHOST: getEnvVar('PGHOST', 'localhost'),
  PGPORT: getEnvVar('PGPORT', '5432'),
  PGDATABASE: getEnvVar('PGDATABASE', 'payload'),
  PGUSER: getEnvVar('PGUSER', 'postgres'),
  PGPASSWORD: getEnvVar('PGPASSWORD', 'postgres'),
  PGSSLMODE: getEnvVar('PGSSLMODE', 'no-verify'),
}

// Algolia configuration
const algoliaConfig = {
  ALGOLIA_APP_ID: getEnvVar('ALGOLIA_APP_ID', 'HTODLVG92P'),
  ALGOLIA_ADMIN_API_KEY: getEnvVar('ALGOLIA_ADMIN_API_KEY', '8136653daed7fabb9332f53ec87481a4'),
  ALGOLIA_SEARCH_API_KEY: getEnvVar('ALGOLIA_SEARCH_API_KEY', ''),
  ALGOLIA_INDEX: getEnvVar('ALGOLIA_INDEX', 'rs_cms'),
}

// S3 configuration
const s3Config = {
  S3_ACCESS_KEY: getEnvVar('S3_ACCESS_KEY', 'c258920f1af99511a2d32bb082e999d2'),
  S3_SECRET_KEY: getEnvVar(
    'S3_SECRET_KEY',
    '726cf05f11d1f8200901c9b5ecb4c6b382332a85463d3c2f09405f16e2cdb540',
  ),
  S3_REGION: getEnvVar('S3_REGION', 'us-west-1'),
  S3_BUCKET: getEnvVar('S3_BUCKET', 'Media'),
  S3_ENDPOINT: getEnvVar('S3_ENDPOINT', 'https://nwquaemdrfuhafnugbgl.supabase.co/storage/v1/s3'),
}

// Next.js configuration
const nextConfig = {
  PAYLOAD_PUBLIC_SERVER_URL: getEnvVar(
    'PAYLOAD_PUBLIC_SERVER_URL',
    `https://${getEnvVar('AWS_APP_ID', 'localhost')}.amplifyapp.com`,
  ),
  PAYLOAD_PUBLIC_SITE_URL: getEnvVar(
    'PAYLOAD_PUBLIC_SITE_URL',
    `https://${getEnvVar('AWS_APP_ID', 'localhost')}.amplifyapp.com`,
  ),
  NEXT_BUILD_SKIP_DB: 'true', // Always true for Amplify builds
  NODE_ENV: 'production',
}

// Create the content of .env.production file
const envFileContent = Object.entries({
  ...dbConfig,
  ...algoliaConfig,
  ...s3Config,
  ...nextConfig,
})
  .map(([key, value]) => `${key}=${value}`)
  .join('\n')

// Write the .env.production file
const envFilePath = path.resolve(process.cwd(), '.env.production')
fs.writeFileSync(envFilePath, envFileContent)

console.log('=== Environment Setup Complete ===')
console.log(`Created ${envFilePath} with the following variables:`)
console.log('- Database variables')
console.log('- Algolia variables')
console.log('- S3 variables')
console.log('- Next.js variables')
console.log('\nIf any variables were missing, fallback values were used.')
console.log('\nPROCEEDING WITH BUILD...')
