import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type { ZodType, ZodError } from 'zod'

interface ValidationDetail {
  field: string
  message: string
}

function formatZodError(error: ZodError): ValidationDetail[] {
  return error.issues.map((issue) => ({
    field: issue.path.join('.') || '_root',
    message: issue.message,
  }))
}

function validationErrorResponse(details: ValidationDetail[]): NextResponse {
  return NextResponse.json(
    { error: 'Validation failed', details },
    { status: 400 }
  )
}

export async function validateBody<T>(
  request: NextRequest,
  schema: ZodType<T>
): Promise<[T, null] | [null, NextResponse]> {
  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return [
      null,
      NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }),
    ]
  }

  const result = schema.safeParse(raw)
  if (!result.success) {
    return [null, validationErrorResponse(formatZodError(result.error))]
  }
  return [result.data, null]
}

export function validateQuery<T>(
  request: NextRequest,
  schema: ZodType<T>
): [T, null] | [null, NextResponse] {
  const { searchParams } = new URL(request.url)
  const raw: Record<string, string | string[]> = {}
  for (const key of searchParams.keys()) {
    const values = searchParams.getAll(key)
    raw[key] = values.length === 1 ? values[0] : values
  }

  const result = schema.safeParse(raw)
  if (!result.success) {
    return [null, validationErrorResponse(formatZodError(result.error))]
  }
  return [result.data, null]
}

export function validateParams<T>(
  params: Record<string, string | string[]>,
  schema: ZodType<T>
): [T, null] | [null, NextResponse] {
  const result = schema.safeParse(params)
  if (!result.success) {
    return [null, validationErrorResponse(formatZodError(result.error))]
  }
  return [result.data, null]
}
