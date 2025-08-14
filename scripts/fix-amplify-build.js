#!/usr/bin/env node

/**
 * This script fixes common issues in the codebase that prevent successful Amplify builds.
 * It should be run as part of the build process in Amplify.
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

// Get current directory from ES module
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

console.log('🔧 Starting build fixes for Amplify deployment...')

// Fix payload.config.ts require() issue
function fixPayloadConfig() {
  const configPath = path.resolve(process.cwd(), 'src/payload.config.ts')
  console.log(`Fixing payload.config.ts at ${configPath}...`)

  if (!fs.existsSync(configPath)) {
    console.error('❌ Could not find src/payload.config.ts file!')
    return false
  }

  let content = fs.readFileSync(configPath, 'utf8')

  // 1. Replace require() with proper imports
  if (content.includes('require(')) {
    console.log('- Replacing require() statements with imports')

    // First, add imports at the top if they don't exist
    if (!content.includes('import createClient from')) {
      const importPos = content.indexOf('import')
      const importBlock = `import createClient from 'payload-plugin-algolia/dist/algolia'
import { getObjectID } from 'payload-plugin-algolia/dist/hooks/syncWithSearch'
`
      content = content.slice(0, importPos) + importBlock + content.slice(importPos)
    }

    // Replace require pattern in the delete function
    content = content.replace(
      /const searchClient = require\(['"]payload-plugin-algolia\/dist\/algolia['"]\)\.default\(([^)]+)\)/g,
      'const searchClient = createClient($1)',
    )
  }

  // 2. Comment out unused imports
  if (content.includes('import { payloadCloudPlugin }')) {
    console.log('- Commenting out unused imports')
    content = content.replace(
      /import { payloadCloudPlugin } from ['"]@payloadcms\/payload-cloud['"]/g,
      "// import { payloadCloudPlugin } from '@payloadcms/payload-cloud'",
    )
  }

  if (content.includes('import { AlgoliaSearchPlugin }')) {
    content = content.replace(
      /import { AlgoliaSearchPlugin } from ['"]payload-plugin-algolia['"]/g,
      "// import { AlgoliaSearchPlugin } from 'payload-plugin-algolia'",
    )
  }

  // 3. Fix any types
  if (content.includes(': any')) {
    console.log('- Fixing any types')
    // Add types for SearchAttributesArgs if they don't exist
    if (!content.includes('type SearchAttributesArgs')) {
      const pos = content.indexOf('const generateSearchAttributes')
      const typeCode = `type SearchAttributesArgs = {
  doc: Record<string, unknown>;
  collection: { slug: string };
}

`
      content = content.slice(0, pos) + typeCode + content.slice(pos)
    }

    // Replace any with proper types
    content = content.replace(/args: any/g, 'args: SearchAttributesArgs')
    content = content.replace(/obj: any/g, 'obj: Record<string, unknown>')
    content = content.replace(
      /args: any/g,
      'args: { collection: { slug: string }, doc: Record<string, unknown> }',
    )
    content = content.replace(/Record<string, any>/g, 'Record<string, unknown>')
  }

  // Write the fixed content back
  fs.writeFileSync(configPath, content, 'utf8')
  console.log('✅ Successfully fixed payload.config.ts')
  return true
}

// Setup environment variables for the build
function setupEnvironmentVariables() {
  console.log('Setting up environment variables for build...')

  // Create .env.production file with sensible defaults
  const envPath = path.resolve(process.cwd(), '.env.production')

  // Also set runtime environment variables
  process.env.NODE_ENV = 'production'
  process.env.NEXT_TELEMETRY_DISABLED = '1'
  process.env.NEXT_BUILD_SKIP_DB = 'true'

  // Function to safely get an environment variable with a fallback
  function getEnvVar(name, fallback = '') {
    const value = process.env[name]
    if (!value) {
      console.log(`- ${name} not set, using fallback value`)
      return fallback
    }
    return value
  }

  // Create environment variable content
  const envContent = `
# Database Configuration
DATABASE_URI=${getEnvVar('DATABASE_URI', 'postgresql://postgres:postgres@localhost:5432/payload?sslmode=no-verify')}
PAYLOAD_SECRET=${getEnvVar('PAYLOAD_SECRET', 'a-default-secret-for-builds-only')}
PGHOST=${getEnvVar('PGHOST', 'localhost')}
PGPORT=${getEnvVar('PGPORT', '5432')}
PGDATABASE=${getEnvVar('PGDATABASE', 'payload')}
PGUSER=${getEnvVar('PGUSER', 'postgres')}
PGPASSWORD=${getEnvVar('PGPASSWORD', 'postgres')}
PGSSLMODE=no-verify

# Public URLs
PAYLOAD_PUBLIC_SERVER_URL=${getEnvVar('PAYLOAD_PUBLIC_SERVER_URL', `https://${getEnvVar('AWS_APP_ID', 'localhost')}.amplifyapp.com`)}
PAYLOAD_PUBLIC_SITE_URL=${getEnvVar('PAYLOAD_PUBLIC_SITE_URL', `https://${getEnvVar('AWS_APP_ID', 'localhost')}.amplifyapp.com`)}

# Algolia Configuration
ALGOLIA_APP_ID=${getEnvVar('ALGOLIA_APP_ID', 'HTODLVG92P')}
ALGOLIA_ADMIN_API_KEY=${getEnvVar('ALGOLIA_ADMIN_API_KEY', '8136653daed7fabb9332f53ec87481a4')}
ALGOLIA_SEARCH_API_KEY=${getEnvVar('ALGOLIA_SEARCH_API_KEY', '')}
ALGOLIA_INDEX=${getEnvVar('ALGOLIA_INDEX', 'rs_cms')}

# AWS S3 Configuration
AWS_ACCESS_KEY=${getEnvVar('S3_ACCESS_KEY', 'c258920f1af99511a2d32bb082e999d2')}
AWS_SECRET_KEY=${getEnvVar('S3_SECRET_KEY', '726cf05f11d1f8200901c9b5ecb4c6b382332a85463d3c2f09405f16e2cdb540')}
AWS_REGION=${getEnvVar('S3_REGION', 'us-west-1')}
AWS_ENDPOINT=${getEnvVar('S3_ENDPOINT', 'https://nwquaemdrfuhafnugbgl.supabase.co/storage/v1/s3')}

# Next.js Configuration
NEXT_TELEMETRY_DISABLED=1
NEXT_BUILD_SKIP_DB=true
NODE_ENV=production
`.trim()

  fs.writeFileSync(envPath, envContent, 'utf8')
  console.log(`✅ Created environment file at ${envPath}`)
  return true
}

// Run all fixes
function runAllFixes() {
  let success = true

  try {
    success = setupEnvironmentVariables() && success
    success = fixPayloadConfig() && success

    if (success) {
      console.log('🎉 All fixes completed successfully!')
    } else {
      console.error('⚠️ Some fixes failed. Check the logs above for details.')
      process.exit(1)
    }
  } catch (error) {
    console.error('❌ Error running fixes:', error)
    process.exit(1)
  }
}

runAllFixes()
