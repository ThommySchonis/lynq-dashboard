import type { NextRequest } from 'next/server'
import { supabaseAdmin, getUserFromToken } from '@/lib/supabaseAdmin'
import { NextResponse } from 'next/server'
import { validateBody } from '@/lib/validation'
import { updateProfileBody } from '@/lib/schemas/marketplace'

interface ExamProfile {
  exam_status?: string
  exam_type_taken?: string
  exam_score?: number
}

interface IdRow {
  id: string
}

// GET — candidate gets their own profile
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = authHeader.replace('Bearer ', '')
  const user = await getUserFromToken(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const profileResult = await supabaseAdmin
    .from('talent_profiles')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  return NextResponse.json({ profile: (profileResult.data as Record<string, unknown> | null) || null })
}

// POST — candidate saves/updates their profile after passing exam
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = authHeader.replace('Bearer ', '')
  const user = await getUserFromToken(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Must have passed an exam to set up profile
  const profileResult2 = await supabaseAdmin
    .from('profiles')
    .select('exam_status, exam_type_taken, exam_score')
    .eq('id', user.id)
    .single()

  const profile = profileResult2.data as ExamProfile | null

  if (!profile?.exam_status || profile.exam_status === 'not_started') {
    return NextResponse.json({ error: 'You must pass an exam before creating a profile.' }, { status: 403 })
  }

  const [body, bErr] = await validateBody(request, updateProfileBody)
  if (bErr) return bErr

  const { photo_url, experience_years, previous_industries, skills, languages, hourly_rate, availability, tools_experience, about } = body

  const { data, error } = await supabaseAdmin
    .from('talent_profiles')
    .upsert({
      user_id: user.id,
      role: profile.exam_type_taken,
      exam_score: profile.exam_score,
      exam_type: profile.exam_type_taken,
      photo_url,
      experience_years,
      previous_industries,
      skills,
      languages,
      hourly_rate,
      availability,
      tools_experience,
      about,
      visible: false,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: 'Failed to save profile' }, { status: 500 })

  return NextResponse.json({ success: true, profile_id: (data as IdRow).id })
}
