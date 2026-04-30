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

  // Verify key with Parcel Panel
  let ppData
  try {
    const ppRes = await fetch('https://open.parcelpanel.com/api/open/v1/auth/token', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json', 'x-pp-app-key': apiKey },
    })
    console.log('[parcel-panel/connect] PP status:', ppRes.status)
    ppData = await ppRes.json()
    console.log('[parcel-panel/connect] PP response:', JSON.stringify(ppData))
    if (ppRes.status !== 200) {
      return NextResponse.json(
        { error: ppData?.message || 'Invalid API key' },
        { status: 400 }
      )
    }
  } catch (err) {
    console.error('[parcel-panel/connect] fetch error', err)
    return NextResponse.json({ error: 'Could not reach Parcel Panel' }, { status: 503 })
  }

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
