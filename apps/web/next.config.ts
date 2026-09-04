import type { NextConfig } from 'next'

const config: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@artist-outreach/ui', '@artist-outreach/shared', '@artist-outreach/config'],
  typedRoutes: true,

  // El admin (Expo Web SPA) vive bajo /admin/*. Su bundle se copia a
  // public/admin/ en el build (ver script "build"). Cada ruta interna
  // del admin (/admin/dashboard, /admin/contacts, etc.) debe servir el
  // index.html de la SPA para que expo-router hidrate y renderice.
  // Los assets del bundle ya llevan /admin/_expo/* (experiments.baseUrl
  // en app.json), así que no hacen falta rewrites para ellos.
  async rewrites() {
    return [
      {
        source: '/admin/:path((?!_expo|assets|favicon).*)',
        destination: '/admin/index.html',
      },
    ]
  },
}

export default config
