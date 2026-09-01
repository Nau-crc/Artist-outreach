import { randomBytes, timingSafeEqual } from 'node:crypto'

/**
 * Genera un token opaco url-safe de 32 bytes (256 bits).
 * Suficiente para tokens de un solo uso con expiración.
 */
export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url')
}

/**
 * Compara dos tokens en tiempo constante. Retorna false si tienen
 * longitudes distintas (sin filtrar por early return).
 */
export function tokensEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a)
  const bBuf = Buffer.from(b)
  if (aBuf.length !== bBuf.length) return false
  return timingSafeEqual(aBuf, bBuf)
}
