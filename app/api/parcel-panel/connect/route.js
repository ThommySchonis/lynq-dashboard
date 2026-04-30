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

  // ── TEMP: endpoint diagnostics ───────────────────────────────────────────
  console.log('[parcel-panel/connect] running endpoint tests for key:', apiKey.slice(0, 8) + '…')

  const [t1, t2, t3] = await Promise.allSettled([
    fetch('https://open.parcelpanel.com/api/v2/tracking', {
      headers: { 'x-parcelpanel-api-key': apiKey },
    }),
    fetch('https://open.parcelpanel.com/api/open/v1/auth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ app_key: apiKey }),
    }),
    fetch('https://api.parcelpanel.com/api/open/v1/auth', {
      method: 'GET',
      headers: { 'x-pp-app-key': apiKey },
    }),
  ])

  const s1 = t1.status === 'fulfilled' ? t1.value.status : `ERR:${t1.reason?.message}`
  const s2 = t2.status === 'fulfilled' ? t2.value.status : `ERR:${t2.reason?.message}`
  const s3 = t3.status === 'fulfilled' ? t3.value.status : `ERR:${t3.reason?.message}`

  console.log('Test 1 (open.parcelpanel.com v2 GET):', s1)
  console.log('Test 2 (open.parcelpanel.com v1 auth POST):', s2)
  console.log('Test 3 (api.parcelpanel.com v1 auth GET):', s3)

  return NextResponse.json({ test1: s1, test2: s2, test3: s3 })
  // ── END TEMP ──────────────────────────────────────────────────────────────
}
