import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { revokeByRawToken } from '@/lib/services/oauth-tokens'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

async function readToken(request: NextRequest): Promise<string | null> {
  const ct = request.headers.get('content-type') ?? ''
  if (ct.includes('application/json')) {
    const body = (await request.json().catch(() => ({}))) as { token?: unknown }
    return typeof body.token === 'string' ? body.token : null
  }
  const form = await request.formData().catch(() => null)
  const t = form?.get('token')
  return typeof t === 'string' ? t : null
}

export async function POST(request: NextRequest) {
  const token = await readToken(request)
  if (token) {
    try { await revokeByRawToken(supabaseAdmin as never, token) } catch { /* RFC 7009: never error on revoke */ }
  }
  return new NextResponse(null, { status: 200 })
}
