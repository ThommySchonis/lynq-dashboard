import { getUserFromToken, supabaseAdmin } from '../../../../lib/supabaseAdmin'
import { NextResponse } from 'next/server'

const PP_BASE = 'https://open.parcelpanel.com'

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

  if (!apiKey || apiKey.length < 10) {
    return NextResponse.json({ error: 'Invalid API key format' }, { status: 400 })
  }

  // Verify key with Parcel Panel
  try {
    const res = await fetch(`${PP_BASE}/api/v2/tracking?page=1&limit=1`, {
      headers: { 'x-parcelpanel-api-key': apiKey },
    })
    if (res.status === 401 || res.status === 403) {
      return NextResponse.json({ error: 'Invalid API key — please check and try again' }, { status: 400 })
    }
  } catch {
    // If PP is unreachable, save anyway
  }

  const { error: dbError } = await supabaseAdmin
    .from('clients')
    .update({ parcel_panel_api_key: apiKey })
    .eq('email', user.email)

  if (dbError) return NextResponse.json({ error: 'Failed to save API key' }, { status: 500 })
  return NextResponse.json({ success: true })
}
