import type { NextConfig } from 'next'

const config: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@artist-outreach/ui', '@artist-outreach/shared', '@artist-outreach/config'],
  typedRoutes: true,
}

export default config
