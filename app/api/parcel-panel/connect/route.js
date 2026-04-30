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

  // ── TEMP: full endpoint scan ─────────────────────────────────────────────
  const endpoints = [
    { name: 'PP1', url: `https://open.parcelpanel.com/api/v2/auth?app_key=${apiKey}`, method: 'GET', headers: {} },
    { name: 'PP2', url: 'https://open.parcelpanel.com/api/v2/tracking',               method: 'GET', headers: { 'x-parcelpanel-api-key': apiKey } },
    { name: 'PP3', url: `https://open.parcelpanel.com/api/v2/orders?app_key=${apiKey}`, method: 'GET', headers: {} },
    { name: 'PP4', url: 'https://parcelpanel.com/api/open/v1/auth/token',             method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ app_key: apiKey }) },
  ]

  const results = {}
  for (const ep of endpoints) {
    try {
      const res = await fetch(ep.url, { method: ep.method, headers: ep.headers, body: ep.body })
      const text = await res.text()
      results[ep.name] = { status: res.status, body: text.substring(0, 150) }
      console.log(`[parcel-panel/connect] ${ep.name}: ${res.status} — ${text.substring(0, 100)}`)
    } catch (e) {
      results[ep.name] = { error: e.message }
      console.log(`[parcel-panel/connect] ${ep.name} error:`, e.message)
    }
  }

  return NextResponse.json(results)
  // ── END TEMP ──────────────────────────────────────────────────────────────
}
