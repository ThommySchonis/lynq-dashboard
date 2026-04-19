import { supabaseAdmin, getUserFromToken } from '../../../../lib/supabaseAdmin'
import { NextResponse } from 'next/server'

export async function GET(request) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = authHeader.replace('Bearer ', '')
  const user = await getUserFromToken(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const examType = searchParams.get('type')

  const query = supabaseAdmin
    .from('exam_submissions')
    .select('id, exam_type, total_score, max_possible_score, percentage, passed, question_scores, attempt_number, submitted_at, graded_at')
    .eq('user_id', user.id)
    .order('submitted_at', { ascending: false })

  if (examType) query.eq('exam_type', examType)

  const { data } = await query.limit(10)

  return NextResponse.json({ submissions: data || [] })
}
