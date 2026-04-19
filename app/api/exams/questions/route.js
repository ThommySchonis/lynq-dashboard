import { supabaseAdmin, getUserFromToken } from '../../../../lib/supabaseAdmin'
import { NextResponse } from 'next/server'

const VALID_TYPES = ['customer_service', 'supply_chain', 'dispute_management', 'overall_manager']
const MAX_ATTEMPTS = 3
const PASSING_SCORE = 75

export async function GET(request) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = authHeader.replace('Bearer ', '')
  const user = await getUserFromToken(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const examType = searchParams.get('type')

  if (!VALID_TYPES.includes(examType)) {
    return NextResponse.json({ error: 'Invalid exam type. Use: ' + VALID_TYPES.join(', ') }, { status: 400 })
  }

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
    passed_at: passRes.data?.submitted_at || null,
    passed_score: passRes.data?.percentage || null,
    attempts_used: attemptsUsed,
    max_attempts: MAX_ATTEMPTS,
    can_attempt: !passRes.data && attemptsUsed < MAX_ATTEMPTS,
  })
}
