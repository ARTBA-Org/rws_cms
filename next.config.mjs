import { withPayload } from '@payloadcms/next/withPayload'

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Disable automatic installation of SWC binaries
  experimental: {
    swcPlugins: [],
  },
  // Disable telemetry
  distDir: process.env.NODE_ENV === 'production' ? '.next' : '.next',
}

// Increase memory limit via environment variable (not in next.config)
if (typeof process !== 'undefined') {
  process.env.NODE_OPTIONS = process.env.NODE_OPTIONS || '--max-old-space-size=4096'
}

// Disable telemetry programmatically
if (typeof process !== 'undefined') {
  try {
    const { setGlobal } = require('next/dist/telemetry/storage')
    setGlobal('telemetry', { disabled: true })
  } catch (e) {
    // Ignore if not available
  }
}

export default withPayload(nextConfig)
