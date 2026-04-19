import { supabaseAdmin, getUserFromToken } from '../../../../../lib/supabaseAdmin'
import { NextResponse } from 'next/server'

export async function GET(request, { params }) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = authHeader.replace('Bearer ', '')
  const user = await getUserFromToken(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const { data, error } = await supabaseAdmin
    .from('talent_profiles')
    .select('id, display_code, role, exam_score, experience_years, previous_industries, skills, languages, hourly_rate, availability, tools_experience, about, verified_at')
    .eq('id', id)
    .eq('visible', true)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Candidate not found' }, { status: 404 })

  return NextResponse.json({ candidate: data })
}
