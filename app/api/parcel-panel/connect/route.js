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
  try {
    const ppRes = await fetch('https://api.parcelpanel.com/api/open/v1/auth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ app_key: apiKey }),
    })
    const ppData = await ppRes.json()
    if (!ppRes.ok) {
      console.error('[parcel-panel/connect] verification failed', ppRes.status, ppData)
      return NextResponse.json(
        { error: ppData.message || 'Invalid Parcel Panel API key — check and try again' },
        { status: 400 }
      )
    }
  } catch (err) {
    console.error('[parcel-panel/connect] fetch error', err)
    return NextResponse.json(
      { error: 'Could not reach Parcel Panel. Check your internet connection and try again.' },
      { status: 503 }
    )
  }

  // Save verified key to clients table
  const { error: dbError } = await supabaseAdmin
    .from('clients')
    .update({ parcel_panel_api_key: apiKey })
    .eq('email', user.email)

  if (dbError) {
    console.error('[parcel-panel/connect] db error', dbError)
    return NextResponse.json({ error: 'Failed to save API key' }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
