// Logger minimalista sobre console.
// Antes usábamos pino pero peta con Turbopack en Next 16 durante el build
// ('default level: must be included in custom levels'). Para el volumen
// de logs de este backend, console es suficiente y sin dependencias.

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
}

const REDACT_KEYS = new Set([
  'authorization',
  'password',
  'token',
  'apiKey',
  'api_key',
  'secret',
])

function currentLevel(): LogLevel {
  const raw = (process.env.LOG_LEVEL ?? '').toLowerCase()
  if (raw === 'debug' || raw === 'info' || raw === 'warn' || raw === 'error') return raw
  return process.env.NODE_ENV === 'production' ? 'info' : 'debug'
}

function shouldLog(level: LogLevel): boolean {
  return LEVEL_ORDER[level] >= LEVEL_ORDER[currentLevel()]
}

function redact(value: unknown): unknown {
  if (value === null || value === undefined) return value
  if (typeof value !== 'object') return value
  if (Array.isArray(value)) return value.map(redact)
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(value)) {
    if (REDACT_KEYS.has(k.toLowerCase())) {
      out[k] = '[REDACTED]'
    } else {
      out[k] = redact(v)
    }
  }
  return out
}

function emit(level: LogLevel, contextOrMsg: unknown, msg?: string): void {
  if (!shouldLog(level)) return
  const payload =
    typeof contextOrMsg === 'string' && msg === undefined
      ? { level, msg: contextOrMsg, time: new Date().toISOString() }
      : {
          level,
          time: new Date().toISOString(),
          ...(redact(contextOrMsg) as Record<string, unknown>),
          ...(msg !== undefined ? { msg } : {}),
        }
  const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log
  fn(JSON.stringify(payload))
}

export const logger = {
  debug: (contextOrMsg: unknown, msg?: string) => emit('debug', contextOrMsg, msg),
  info: (contextOrMsg: unknown, msg?: string) => emit('info', contextOrMsg, msg),
  warn: (contextOrMsg: unknown, msg?: string) => emit('warn', contextOrMsg, msg),
  error: (contextOrMsg: unknown, msg?: string) => emit('error', contextOrMsg, msg),
}
