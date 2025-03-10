import { withPayload } from '@payloadcms/next/withPayload'

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Disable automatic installation of SWC binaries
  experimental: {
    swcPlugins: [],
  },
  // Added proper server external packages config
  serverExternalPackages: ['sharp', 'payload-plugin-algolia'],
  // Disable image optimization to avoid Sharp-related issues
  images: {
    unoptimized: true,
  },
  // Disable telemetry
  distDir: process.env.NODE_ENV === 'production' ? '.next' : '.next',
  // Suppress the "serverComponentsExternalPackages" warning
  eslint: {
    ignoreDuringBuilds: true, // Ignore ESLint errors during builds
  },
  typescript: {
    ignoreBuildErrors: true, // Ignore TypeScript errors during builds for Amplify deployment
  },
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
