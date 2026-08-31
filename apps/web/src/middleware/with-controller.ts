import { NextResponse } from 'next/server'
import { z, ZodError } from 'zod'
import { logger } from '@/lib/logger'

interface ControllerOptions<TInput> {
  schema?: z.ZodType<TInput>
}

export function withController<TInput, TOutput>(
  handler: (input: TInput) => Promise<TOutput>,
  options: ControllerOptions<TInput> = {},
) {
  return async (request: Request): Promise<Response> => {
    try {
      let input: TInput = undefined as TInput
      if (options.schema) {
        const raw = request.method === 'GET' ? Object.fromEntries(new URL(request.url).searchParams) : await request.json()
        input = options.schema.parse(raw)
      }
      const result = await handler(input)
      return NextResponse.json(result)
    } catch (err) {
      if (err instanceof ZodError) {
        return NextResponse.json(
          { error: 'ValidationError', issues: err.issues },
          { status: 400 },
        )
      }
      logger.error({ err }, 'Controller error')
      return NextResponse.json({ error: 'InternalServerError' }, { status: 500 })
    }
  }
}
