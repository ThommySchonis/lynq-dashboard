import { getUserFromToken, supabaseAdmin } from '../../../../lib/supabaseAdmin'
import { NextResponse } from 'next/server'

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

  // ── TEMP: endpoint discovery ─────────────────────────────────────────────
  const tests = [
    {
      name: 'A',
      url: 'https://www.parcelpanel.com/api/open/v1/auth',
      options: { method: 'GET', headers: { 'x-pp-app-key': apiKey } },
    },
    {
      name: 'B',
      url: 'https://open.parcelpanel.com/api/v1/auth',
      options: {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': apiKey },
        body: JSON.stringify({ key: apiKey }),
      },
    },
    {
      name: 'C',
      url: 'https://open.parcelpanel.com/tracking',
      options: { method: 'GET', headers: { 'Authorization': 'Bearer ' + apiKey } },
    },
  ]

  const results = {}
  for (const test of tests) {
    try {
      const res = await fetch(test.url, test.options)
      const text = await res.text()
      results[test.name] = { status: res.status, contentType: res.headers.get('content-type'), body: text.substring(0, 200) }
      console.log(`[parcel-panel/connect] Test ${test.name}:`, res.status, text.substring(0, 100))
    } catch (e) {
      results[test.name] = { error: e.message }
      console.log(`[parcel-panel/connect] Test ${test.name} error:`, e.message)
    }
  }

  return NextResponse.json(results)
  // ── END TEMP ──────────────────────────────────────────────────────────────

  // Save verified key to clients table
  const { data: updated, error: dbError } = await supabaseAdmin
    .from('clients')
    .update({ parcel_panel_api_key: apiKey })
    .eq('email', user.email)
    .select('id')

  if (dbError) {
    console.error('[parcel-panel/connect] db error', dbError)
    return NextResponse.json({ error: 'Failed to save API key' }, { status: 500 })
  }
  if (!updated || updated.length === 0) {
    console.error('[parcel-panel/connect] no client row for email:', user.email)
    return NextResponse.json({ error: 'Client account not found. Please contact support.' }, { status: 404 })
  }
  return NextResponse.json({ success: true })
}
