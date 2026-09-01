import { NextRequest, NextResponse } from 'next/server'

// CORS para que Expo Web (localhost:8081), la app móvil en simulador y
// el binario de EAS puedan hablar con la API en dev/staging/prod.
// En prod, NEXT_PUBLIC_APP_URL debe apuntar al dominio real.
const ALLOWED_ORIGINS = [
  'http://localhost:8081',
  'http://localhost:19006',
  'http://localhost:3000',
  process.env.NEXT_PUBLIC_APP_URL,
].filter(Boolean) as string[]

const ALLOWED_HEADERS = 'Content-Type, Authorization'
const ALLOWED_METHODS = 'GET, POST, PATCH, DELETE, OPTIONS'

export function middleware(request: NextRequest) {
  const origin = request.headers.get('origin') ?? ''
  const isAllowed = ALLOWED_ORIGINS.includes(origin)

  // Preflight
  if (request.method === 'OPTIONS') {
    const res = new NextResponse(null, { status: 204 })
    if (isAllowed) {
      res.headers.set('Access-Control-Allow-Origin', origin)
      res.headers.set('Access-Control-Allow-Methods', ALLOWED_METHODS)
      res.headers.set('Access-Control-Allow-Headers', ALLOWED_HEADERS)
      res.headers.set('Access-Control-Max-Age', '86400')
      res.headers.set('Vary', 'Origin')
    }
    return res
  }

  const res = NextResponse.next()
  if (isAllowed) {
    res.headers.set('Access-Control-Allow-Origin', origin)
    res.headers.set('Access-Control-Allow-Credentials', 'true')
    res.headers.set('Vary', 'Origin')
  }
  return res
}

export const config = {
  matcher: '/api/:path*',
}
