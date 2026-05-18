import { supabaseAdmin } from '../../../../lib/supabaseAdmin'
import { getAuthContext } from '../../../../lib/auth'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const ALLOWED_FIELDS = [
  'parcelpanel_api_key',
]

function pickAllowedIntegrationFields(body: Record<string, unknown>): Record<string, unknown> {
  return ALLOWED_FIELDS.reduce<Record<string, unknown>>((fields, key) => {
    if (Object.prototype.hasOwnProperty.call(body, key)) fields[key] = body[key] || null
    return fields
  }, {})
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const storeId = searchParams.get('store_id')
  if (!storeId) {
    return NextResponse.json({ error: 'store_id is required' }, { status: 400 })
  }

  const body = await request.json() as Record<string, unknown>
  const updates = pickAllowedIntegrationFields(body)
  if (!Object.keys(updates).length) {
    return NextResponse.json({ error: 'No supported integration fields provided' }, { status: 400 })
  }

  const { error } = await supabaseAdmin
    .from('integrations')
    .update({ ...updates })
    .eq('store_id', storeId)
    .eq('workspace_id', ctx.workspaceId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}

export async function GET(request: NextRequest) {
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
