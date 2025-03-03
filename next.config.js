/** @type {import('next').NextConfig} */
const nextConfig = {
  // Other Next.js config options
  experimental: {
    serverComponentsExternalPackages: ['sharp'],
  },
  // Add React compatibility settings
  reactStrictMode: false,
  transpilePackages: ['payload', '@payloadcms/ui'],
}

export default nextConfig
