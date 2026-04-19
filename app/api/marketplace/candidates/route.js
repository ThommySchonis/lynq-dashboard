import { supabaseAdmin, getUserFromToken } from '../../../../lib/supabaseAdmin'
import { NextResponse } from 'next/server'

export async function GET(request) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = authHeader.replace('Bearer ', '')
  const user = await getUserFromToken(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const role = searchParams.get('role')
  const availability = searchParams.get('availability')

  let query = supabaseAdmin
    .from('talent_profiles')
    .select('id, display_code, role, exam_score, experience_years, previous_industries, skills, languages, hourly_rate, availability, tools_experience, about, verified_at')
    .eq('visible', true)
    .order('exam_score', { ascending: false })

  if (role) query = query.eq('role', role)
  if (availability) query = query.eq('availability', availability)

  const { data, error } = await query

  if (error) return NextResponse.json({ error: 'Failed to load candidates' }, { status: 500 })

  return NextResponse.json({ candidates: data || [] })
}
