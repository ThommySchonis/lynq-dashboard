import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getAuthContext, requireWriteAccess } from '@/lib/auth'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { validateBody, validateQuery } from '@/lib/validation'
import { saveIntegrationQuery, saveIntegrationBody } from '@/lib/schemas/settings'

interface IntegrationRow {
  shopify_domain?: string
  shopify_connected_at?: string
  parcelpanel_api_key?: string
}

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
  const blocked = requireWriteAccess(ctx)
  if (blocked) return blocked

  const [query, qErr] = validateQuery(request, saveIntegrationQuery)
  if (qErr) return qErr

  const [body, bErr] = await validateBody(request, saveIntegrationBody)
  if (bErr) return bErr

  const updates = pickAllowedIntegrationFields(body as Record<string, unknown>)
  if (!Object.keys(updates).length) {
    return NextResponse.json({ error: 'No supported integration fields provided' }, { status: 400 })
  }

  const { error } = await supabaseAdmin
    .from('integrations')
    .update({ ...updates })
    .eq('store_id', query.store_id)
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

  const integration = data as IntegrationRow | null
  return NextResponse.json({
    shopify: !!integration?.shopify_domain,
    shopifyDomain: integration?.shopify_domain || null,
    parcelpanel: !!integration?.parcelpanel_api_key,
  })
}
