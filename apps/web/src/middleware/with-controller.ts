import { NextResponse } from 'next/server'
import { z, ZodError } from 'zod'
import { logger } from '@/lib/logger'
import {
  AuthClaims,
  ConfigurationError,
  ForbiddenError,
  UnauthorizedError,
  requireAdmin,
} from './auth'

export interface RouteContext<TParams = unknown> {
  auth?: AuthClaims
  params: TParams
}

export interface ControllerInput<TBody = unknown, TParams = unknown> {
  body: TBody
  ctx: RouteContext<TParams>
}

export type ControllerHandler<TBody, TParams, TOutput> = (
  input: ControllerInput<TBody, TParams>,
) => Promise<TOutput>

export interface ControllerOptions<TBody, TParams> {
  bodySchema?: z.ZodType<TBody>
  paramsSchema?: z.ZodType<TParams>
  requireAdmin?: boolean
  status?: number
}

export class ValidationError extends Error {
  readonly issues: z.core.$ZodIssue[]
  constructor(issues: z.core.$ZodIssue[]) {
    super('ValidationError')
    this.name = 'ValidationError'
    this.issues = issues
  }
}

export class NotFoundError extends Error {
  constructor(message = 'Not found') {
    super(message)
    this.name = 'NotFoundError'
  }
}

export class ConflictError extends Error {
  constructor(message = 'Conflict') {
    super(message)
    this.name = 'ConflictError'
  }
}

interface NextRouteArg<TParams> {
  params: Promise<TParams>
}

export function withController<TBody = void, TParams = unknown, TOutput = unknown>(
  handler: ControllerHandler<TBody, TParams, TOutput>,
  options: ControllerOptions<TBody, TParams> = {},
) {
  return async (request: Request, routeArg?: NextRouteArg<TParams>): Promise<Response> => {
    try {
      const rawParams = routeArg ? await routeArg.params : ({} as TParams)
      const params: TParams = options.paramsSchema ? options.paramsSchema.parse(rawParams) : rawParams

      const ctx: RouteContext<TParams> = { params }

      if (options.requireAdmin) {
        ctx.auth = requireAdmin(request)
      }

      let body: TBody = undefined as unknown as TBody
      if (options.bodySchema) {
        const raw = await readBody(request)
        body = options.bodySchema.parse(raw)
      }

      const result = await handler({ body, ctx })
      return NextResponse.json(result, { status: options.status ?? 200 })
    } catch (err) {
      return errorResponse(err)
    }
  }
}

async function readBody(request: Request): Promise<unknown> {
  if (request.method === 'GET' || request.method === 'DELETE') {
    return Object.fromEntries(new URL(request.url).searchParams)
  }
  const text = await request.text()
  if (!text) return {}
  try {
    return JSON.parse(text)
  } catch {
    throw new ValidationError([
      { code: 'invalid_type', expected: 'object', input: text, message: 'Invalid JSON body', path: [] },
    ] as unknown as z.core.$ZodIssue[])
  }
}

function errorResponse(err: unknown): Response {
  if (err instanceof ZodError) {
    return NextResponse.json({ error: 'ValidationError', issues: err.issues }, { status: 400 })
  }
  if (err instanceof ValidationError) {
    return NextResponse.json({ error: 'ValidationError', issues: err.issues }, { status: 400 })
  }
  if (err instanceof UnauthorizedError) {
    return NextResponse.json({ error: 'Unauthorized', message: err.message }, { status: 401 })
  }
  if (err instanceof ForbiddenError) {
    return NextResponse.json({ error: 'Forbidden', message: err.message }, { status: 403 })
  }
  if (err instanceof NotFoundError) {
    return NextResponse.json({ error: 'NotFound', message: err.message }, { status: 404 })
  }
  if (err instanceof ConflictError) {
    return NextResponse.json({ error: 'Conflict', message: err.message }, { status: 409 })
  }
  if (err instanceof ConfigurationError) {
    logger.error({ err }, 'Configuration error')
    return NextResponse.json({ error: 'InternalServerError' }, { status: 500 })
  }
  logger.error({ err }, 'Unhandled controller error')
  return NextResponse.json({ error: 'InternalServerError' }, { status: 500 })
}
