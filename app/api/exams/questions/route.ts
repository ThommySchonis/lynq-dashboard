import type { NextRequest } from 'next/server'
import { supabaseAdmin, getUserFromToken } from '@/lib/supabaseAdmin'
import { NextResponse } from 'next/server'
import { validateQuery } from '@/lib/validation'
import { examQuestionsQuery } from '@/lib/schemas/exams'

interface PassedSubmission {
  submitted_at?: string
  percentage?: number
}

const MAX_ATTEMPTS = 3
const PASSING_SCORE = 75

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = authHeader.replace('Bearer ', '')
  const user = await getUserFromToken(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [query, qErr] = validateQuery(request, examQuestionsQuery)
  if (qErr) return qErr

  const examType = query.type

  const [questionsRes, passRes, attemptRes] = await Promise.all([
    supabaseAdmin
      .from('exam_questions')
      .select('id, question_order, question_type, question, options, max_points')
      .eq('exam_type', examType)
      .order('question_order'),
    supabaseAdmin
      .from('exam_submissions')
      .select('id, percentage, submitted_at')
      .eq('user_id', user.id)
      .eq('exam_type', examType)
      .eq('passed', true)
      .maybeSingle(),
    supabaseAdmin
      .from('exam_submissions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('exam_type', examType),
  ])

  const attemptsUsed = attemptRes.count || 0

  return NextResponse.json({
    exam_type: examType,
    questions: questionsRes.data || [],
    total_questions: questionsRes.data?.length || 0,
    passing_score: PASSING_SCORE,
    already_passed: !!passRes.data,
    passed_at: (passRes.data as PassedSubmission | null)?.submitted_at || null,
    passed_score: (passRes.data as PassedSubmission | null)?.percentage || null,
    attempts_used: attemptsUsed,
    max_attempts: MAX_ATTEMPTS,
    can_attempt: !passRes.data && attemptsUsed < MAX_ATTEMPTS,
  })
}
