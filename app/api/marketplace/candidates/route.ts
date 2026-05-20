import type { NextRequest } from 'next/server'
import { supabaseAdmin, getUserFromToken } from '@/lib/supabaseAdmin'
import { NextResponse } from 'next/server'
import { validateQuery } from '@/lib/validation'
import { getCandidatesQuery } from '@/lib/schemas/marketplace'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = authHeader.replace('Bearer ', '')
  const user = await getUserFromToken(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [query, qErr] = validateQuery(request, getCandidatesQuery)
  if (qErr) return qErr

  let q = supabaseAdmin
    .from('talent_profiles')
    .select('id, display_code, role, exam_score, experience_years, previous_industries, skills, languages, hourly_rate, availability, tools_experience, about, verified_at')
    .eq('visible', true)
    .order('exam_score', { ascending: false })

  if (query.role) q = q.eq('role', query.role)
  if (query.availability) q = q.eq('availability', query.availability)

  const { data, error } = await q

  if (error) return NextResponse.json({ error: 'Failed to load candidates' }, { status: 500 })

  return NextResponse.json({ candidates: data || [] })
}
