import { getUserFromToken, supabaseAdmin } from '../../../../lib/supabaseAdmin'
import { NextResponse } from 'next/server'

const PP_BASE = 'https://open.parcelwill.com'

export async function POST(request) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = authHeader.replace('Bearer ', '')
  const user = await getUserFromToken(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let apiKey
  try {
    const body = await request.json()
    apiKey = body.apiKey?.trim()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (!apiKey) return NextResponse.json({ error: 'API key is required' }, { status: 400 })

  // Verify key — a 401 means invalid key, anything else means the key is accepted
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
  } catch (err) {
    console.error('[parcel-panel/connect] fetch error', err)
    return NextResponse.json({ error: 'Could not reach Parcel Panel' }, { status: 503 })
  }

  // Save verified key — upsert so the row is created if it doesn't exist yet
  const { error: upsertError } = await supabaseAdmin
    .from('clients')
    .upsert({ email: user.email, parcel_panel_api_key: apiKey }, { onConflict: 'email' })

  if (upsertError) {
    console.error('[parcel-panel/connect] upsert error', upsertError)
    return NextResponse.json({ error: 'Failed to save: ' + upsertError.message }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
