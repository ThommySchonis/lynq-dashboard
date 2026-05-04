import { supabaseAdmin } from '../../../../lib/supabaseAdmin'
import { getAuthContext } from '../../../../lib/auth'
import { NextResponse } from 'next/server'

const ALLOWED_FIELDS = [
  'parcelpanel_api_key',
]

function pickAllowedIntegrationFields(body) {
  return ALLOWED_FIELDS.reduce((fields, key) => {
    if (Object.prototype.hasOwnProperty.call(body, key)) fields[key] = body[key] || null
    return fields
  }, {})
}

export async function POST(request) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const updates = pickAllowedIntegrationFields(body)
  if (!Object.keys(updates).length) {
    return NextResponse.json({ error: 'No supported integration fields provided' }, { status: 400 })
  }

  // Transition: write both client_id (legacy) AND workspace_id. Keep
  // existing onConflict until Phase 4 swaps the unique key.
  const { error } = await supabaseAdmin
    .from('integrations')
    .upsert(
      { client_id: ctx.user.id, workspace_id: ctx.workspaceId, ...updates },
      { onConflict: 'client_id' }
    )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}

export async function GET(request) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await supabaseAdmin
    .from('integrations')
    .select('shopify_domain, shopify_connected_at, parcelpanel_api_key')
    .eq('workspace_id', ctx.workspaceId)
    .maybeSingle()

  return NextResponse.json({
    shopify: !!data?.shopify_domain,
    shopifyDomain: data?.shopify_domain || null,
    parcelpanel: !!data?.parcelpanel_api_key,
  })
}
