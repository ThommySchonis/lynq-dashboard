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

  // ── STAP 1: diagnose auth user ───────────────────────────────────────────
  const { data: { user: authUser }, error: authError } = await supabaseAdmin.auth.getUser(token)
  console.log('[parcel-panel/connect] getUserFromToken email:', user.email)
  console.log('[parcel-panel/connect] auth.getUser email:', authUser?.email, 'id:', authUser?.id)
  console.log('[parcel-panel/connect] auth error:', authError?.message)

  // ── STAP 2: check clients table ──────────────────────────────────────────
  const { data: allClients } = await supabaseAdmin.from('clients').select('id, email').limit(5)
  console.log('[parcel-panel/connect] clients in DB:', JSON.stringify(allClients))

  // ── Save verified key ────────────────────────────────────────────────────
  const { data: updated, error: dbError } = await supabaseAdmin
    .from('clients')
    .update({ parcel_panel_api_key: apiKey })
    .eq('email', user.email)
    .select('id')

  console.log('[parcel-panel/connect] update result:', JSON.stringify(updated), 'error:', dbError?.message)

  if (dbError) {
    console.error('[parcel-panel/connect] db error', dbError)
    return NextResponse.json({ error: 'Failed to save API key' }, { status: 500 })
  }
  if (!updated || updated.length === 0) {
    console.error('[parcel-panel/connect] no client row for email:', user.email)
    return NextResponse.json({
      error: 'Client account not found. Please contact support.',
      debug: { userEmail: user.email, clientsInDB: allClients?.map(c => c.email) }
    }, { status: 404 })
  }
  return NextResponse.json({ success: true })
}
