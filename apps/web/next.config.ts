import type { NextConfig } from 'next'

const config: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@artist-outreach/ui', '@artist-outreach/shared', '@artist-outreach/config'],
  experimental: {
    typedRoutes: true,
  },
}

export default config
