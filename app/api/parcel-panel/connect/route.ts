import { randomUUID } from 'crypto'
import type { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getAuthContext, requireWriteAccess } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { validateBody } from '@/lib/validation'
import { connectBody } from '@/lib/schemas/parcel-panel'

const PP_BASE = 'https://open.parcelwill.com'

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const blocked = requireWriteAccess(ctx)
  if (blocked) return blocked

  const [body, err] = await validateBody(request, connectBody)
  if (err) return err
  const apiKey = body.apiKey.trim()

  // Verify key against ParcelPanel API
  try {
    const ppRes = await fetch(`${PP_BASE}/api/v2/tracking/order?order_number=%23000`, {
      method: 'GET',
      headers: { 'x-parcelpanel-api-key': apiKey },
    })
    console.log('[parcel-panel/connect] PP status:', ppRes.status)

    if (ppRes.status === 401 || ppRes.status === 403) {
      const text = await ppRes.text()
      console.error('[parcel-panel/connect] invalid key:', text.substring(0, 200))
      return NextResponse.json({ error: 'Invalid API key — please check and try again' }, { status: 400 })
    }
  } catch (fetchErr: unknown) {
    console.error('[parcel-panel/connect] fetch error', fetchErr)
    return NextResponse.json({ error: 'Could not reach Parcel Panel' }, { status: 503 })
  }

  // Generate webhook token and save to integrations
  const webhookToken = randomUUID()

  const { error: upsertError } = await supabaseAdmin
    .from('integrations')
    .upsert(
      {
        workspace_id: ctx.workspaceId,
        store_id: ctx.workspaceId, // TODO: pass actual store_id when multi-store is wired through the connect flow
        parcelpanel_api_key: apiKey,
        parcelpanel_webhook_token: webhookToken,
      },
      { onConflict: 'workspace_id,store_id' }
    )

  if (upsertError) {
    console.error('[parcel-panel/connect] upsert error', upsertError)
    return NextResponse.json({ error: 'Failed to save: ' + upsertError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, webhookToken })
}
