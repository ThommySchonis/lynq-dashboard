import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getUserFromToken, supabaseAdmin } from '../../../../lib/supabaseAdmin'
import crypto from 'crypto'

interface RecoveryCodesRow {
  recovery_codes?: string[]
}

interface RecoveryCodesBody {
  clear?: boolean
}

function generateCodes(count = 10): string[] {
  return Array.from({ length: count }, () => {
    const h = crypto.randomBytes(4).toString('hex').toUpperCase()
    return `${h.slice(0, 4)}-${h.slice(4)}` // e.g. A1B2-C3D4
  })
}

function bearer(request: NextRequest): string {
  return request.headers.get('authorization')?.replace('Bearer ', '') ?? ''
}

// GET — fetch existing codes (empty array if none set)
export async function GET(request: NextRequest) {
  const user = await getUserFromToken(bearer(request))
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabaseAdmin
    .from('user_profiles')
    .select('recovery_codes')
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ recovery_codes: (data as RecoveryCodesRow | null)?.recovery_codes ?? [] })
}

// POST — generate fresh codes (or clear them when body contains { clear: true })
export async function POST(request: NextRequest) {
  const user = await getUserFromToken(bearer(request))
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({})) as RecoveryCodesBody
  const codes = body.clear ? [] : generateCodes(10)

  const update: Record<string, unknown> = { user_id: user.id, recovery_codes: codes }
  if (!body.clear) update.mfa_enabled_at = new Date().toISOString()

  const { error } = await supabaseAdmin
    .from('user_profiles')
    .upsert(update, { onConflict: 'user_id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ recovery_codes: codes })
}
