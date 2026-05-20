import type { NextRequest } from 'next/server'
import type { RouteContext } from '@/types/api'
import { supabaseAdmin, getUserFromToken } from '@/lib/supabaseAdmin'
import { NextResponse } from 'next/server'
import { validateParams } from '@/lib/validation'
import { candidateParams } from '@/lib/schemas/marketplace'

export async function GET(request: NextRequest, { params }: RouteContext<{ id: string }>) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = authHeader.replace('Bearer ', '')
  const user = await getUserFromToken(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [p, pErr] = validateParams(await params, candidateParams)
  if (pErr) return pErr

  const { data, error } = await supabaseAdmin
    .from('talent_profiles')
    .select('id, display_code, role, exam_score, experience_years, previous_industries, skills, languages, hourly_rate, availability, tools_experience, about, verified_at')
    .eq('id', p.id)
    .eq('visible', true)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Candidate not found' }, { status: 404 })

  return NextResponse.json({ candidate: data })
}
