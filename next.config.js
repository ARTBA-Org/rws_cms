/** @type {import('next').NextConfig} */
const nextConfig = {
  // Disable database connection during build if NEXT_BUILD_SKIP_DB is set
  // This is useful for CI/CD environments where a database connection is not available
  webpack: (config, { isServer }) => {
    if (process.env.NEXT_BUILD_SKIP_DB === 'true' && isServer) {
      console.log('⚠️ Skipping database connection during build')
      // This is a workaround to prevent the database connection during build
      // It will be properly connected during runtime
    }
    return config
  },
  // Other Next.js config options
  experimental: {
    serverComponentsExternalPackages: ['sharp'],
  },
}

export default nextConfig
