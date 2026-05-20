import type { NextRequest } from 'next/server'
import { supabaseAdmin, getUserFromToken } from '@/lib/supabaseAdmin'
import { NextResponse } from 'next/server'
import { validateQuery } from '@/lib/validation'
import { examResultQuery } from '@/lib/schemas/exams'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = authHeader.replace('Bearer ', '')
  const user = await getUserFromToken(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [query, qErr] = validateQuery(request, examResultQuery)
  if (qErr) return qErr

  const q = supabaseAdmin
    .from('exam_submissions')
    .select('id, exam_type, total_score, max_possible_score, percentage, passed, question_scores, attempt_number, submitted_at, graded_at')
    .eq('user_id', user.id)
    .order('submitted_at', { ascending: false })

  if (query.type) q.eq('exam_type', query.type)

  const { data } = await q.limit(10)

  return NextResponse.json({ submissions: data || [] })
}
