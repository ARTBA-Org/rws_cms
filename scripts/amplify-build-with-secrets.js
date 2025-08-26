#!/usr/bin/env node

/**
 * Amplify Build Script - Environment Setup
 * This script ensures all required environment variables are properly set
 */

import fs from 'node:fs'
import path from 'node:path'

console.log('🔧 Setting up environment for Amplify build...')

// Verify critical environment variables are set
const requiredEnvVars = ['DATABASE_URI', 'PAYLOAD_SECRET', 'PDF_EXTRACTOR_URL']

let hasAllRequired = true
requiredEnvVars.forEach((envVar) => {
  if (!process.env[envVar]) {
    console.error(`❌ Missing required environment variable: ${envVar}`)
    hasAllRequired = false
  } else {
    console.log(`✅ ${envVar} is set`)
  }
})

if (!hasAllRequired) {
  console.error(
    '❌ Some required environment variables are missing. Please check your AWS Amplify environment configuration.',
  )
  process.exit(1)
}

// Create a simple .env.production file to ensure Next.js can read the environment
const envContent = `
NODE_ENV=production
NEXT_TELEMETRY_DISABLED=1
`.trim()

const envProdPath = path.join(process.cwd(), '.env.production')
fs.writeFileSync(envProdPath, envContent, 'utf8')
console.log(`✅ Created .env.production file`)

console.log('🎉 Environment setup complete!')
