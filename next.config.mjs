import { withPayload } from '@payloadcms/next/withPayload'

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Disable automatic installation of SWC binaries
  experimental: {
    swcPlugins: [],
  },
  // Disable telemetry
  telemetry: {
    telemetryDisabled: true,
  },
  // Increase build memory limit
  env: {
    NODE_OPTIONS: '--max-old-space-size=4096',
  },
}

export default withPayload(nextConfig)
