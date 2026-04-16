import { supabaseAdmin, getUserFromToken } from '../../../../lib/supabaseAdmin'
import { NextResponse } from 'next/server'

export async function POST(request) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = authHeader.replace('Bearer ', '')
  const user = await getUserFromToken(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { brandName, language, tone } = await request.json()

  await supabaseAdmin
    .from('ai_settings')
    .upsert({
      user_id: user.id,
      brand_name: brandName,
      language,
      tone,
    }, { onConflict: 'user_id' })

  return NextResponse.json({ success: true })
}

export async function GET(request) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = authHeader.replace('Bearer ', '')
  const user = await getUserFromToken(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await supabaseAdmin
    .from('ai_settings')
    .select('brand_name, language, tone, system_prompt')
    .eq('user_id', user.id)
    .single()

  return NextResponse.json({ settings: data || {} })
}
