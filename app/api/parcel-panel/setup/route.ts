import type { NextRequest } from 'next/server'
import { getUserFromToken, supabaseAdmin } from '@/lib/supabaseAdmin'
import { NextResponse } from 'next/server'
import { validateBody } from '@/lib/validation'
import { setupBody } from '@/lib/schemas/parcel-panel'

const PP_BASE = 'https://open.parcelpanel.com'

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = authHeader.replace('Bearer ', '')
  const user = await getUserFromToken(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [body, err] = await validateBody(request, setupBody)
  if (err) return err
  const apiKey = body.apiKey.trim()

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
