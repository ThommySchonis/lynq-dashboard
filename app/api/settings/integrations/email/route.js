import { NextResponse } from 'next/server'
import { getAuthContext } from '../../../../../lib/auth'
import { supabaseAdmin }  from '../../../../../lib/supabaseAdmin'

// Per ONBOARDING_SPEC v1.1 §6.2: pure UI / intent-saving endpoint voor
// /settings/integrations/email. Bewaart alleen welke provider de user
// heeft geklikt (gmail | outlook). Echte OAuth + forwarding flow volgt
// later via aparte routes.
//
// GET  → { provider, status, real_email, connected_at }
// POST → upsert { provider }; zet status='pending', wist eventuele
//        eerdere connection-fields zodat een nieuwe connect-flow volgt.

const VALID_PROVIDERS = ['gmail', 'outlook']

export async function GET(request) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await supabaseAdmin
    .from('email_accounts')
    .select('provider, status, real_email, connected_at')
    .eq('workspace_id', ctx.workspaceId)
    .maybeSingle()

  return NextResponse.json({
    provider:     data?.provider ?? null,
    status:       data?.status ?? 'not_connected',
    real_email:   data?.real_email ?? null,
    connected_at: data?.connected_at ?? null,
  })
}

export async function POST(request) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body     = await request.json().catch(() => ({}))
  const provider = String(body?.provider || '').trim().toLowerCase()

  if (!VALID_PROVIDERS.includes(provider)) {
    return NextResponse.json(
      { error: `Invalid provider. Must be one of: ${VALID_PROVIDERS.join(', ')}` },
      { status: 400 }
    )
  }

  // Intent-only upsert. real_email + display_name + forwarding_address +
  // connected_at worden expliciet null gezet — pre-existing real connect
  // (oude /api/email/connect flow) wordt overschreven door deze intent.
  // Dual-write client_id (Block C transitiepatroon).
  const { error } = await supabaseAdmin
    .from('email_accounts')
    .upsert({
      client_id:          ctx.user.id,
      workspace_id:       ctx.workspaceId,
      provider,
      status:             'pending',
      real_email:         null,
      display_name:       null,
      forwarding_address: null,
      connected_at:       null,
    }, { onConflict: 'client_id' })

  if (error) {
    console.error('[settings/integrations/email POST] upsert failed:', error.message)
    return NextResponse.json({ error: error.message, code: 'save_failed' }, { status: 500 })
  }

  return NextResponse.json({
    ok:       true,
    provider,
    status:   'pending',
    message:  'Settings saved. Connection will activate when integration is live.',
  })
}
