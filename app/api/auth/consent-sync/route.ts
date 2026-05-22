import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getUserFromToken, supabaseAdmin } from '@/lib/supabaseAdmin'
import { validateBody } from '@/lib/validation'
import { consentSyncBody } from '@/lib/schemas/consent'

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await getUserFromToken(authHeader.replace('Bearer ', ''))
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [body, validationError] = await validateBody(request, consentSyncBody)
  if (validationError) return validationError

  const { error } = await supabaseAdmin
    .from('user_profiles')
    .update({
      consent_level: body.level,
      consented_at: new Date().toISOString(),
    })
    .eq('user_id', user.id)

  if (error) {
    console.error('[consent-sync] update failed:', error.message)
    return NextResponse.json({ error: 'Failed to sync consent' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
