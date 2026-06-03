import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth.ts'
import { getAdminClient } from '../lib/supabase.ts'
import type { AuthContext } from '../lib/types.ts'

const PASSING_SCORE = 75
const MAX_ATTEMPTS = 3

const app = new Hono()

app.use('*', authMiddleware)

// ── GET questions ───────────────────────────────────────────────────

app.get('/questions', async (c) => {
  const ctx = c.get('authContext') as AuthContext
  const sb = getAdminClient()
  const examType = c.req.query('type')

  if (!examType) return c.json({ error: 'type is required' }, 400)

  const [questionsRes, passRes, attemptRes] = await Promise.all([
    sb.from('exam_questions')
      .select('id, question_order, question_type, question, options, max_points')
      .eq('exam_type', examType)
      .order('question_order'),
    sb.from('exam_submissions')
      .select('id, percentage, submitted_at')
      .eq('user_id', ctx.user.id)
      .eq('exam_type', examType)
      .eq('passed', true)
      .maybeSingle(),
    sb.from('exam_submissions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', ctx.user.id)
      .eq('exam_type', examType),
  ])

  const attemptsUsed = attemptRes.count || 0
  const passed = passRes.data as { submitted_at?: string; percentage?: number } | null

  return c.json({
    exam_type: examType,
    questions: questionsRes.data || [],
    total_questions: questionsRes.data?.length || 0,
    passing_score: PASSING_SCORE,
    already_passed: !!passed,
    passed_at: passed?.submitted_at || null,
    passed_score: passed?.percentage || null,
    attempts_used: attemptsUsed,
    max_attempts: MAX_ATTEMPTS,
    can_attempt: !passed && attemptsUsed < MAX_ATTEMPTS,
  })
})

// ── GET results ─────────────────────────────────────────────────────

app.get('/result', async (c) => {
  const ctx = c.get('authContext') as AuthContext
  const sb = getAdminClient()
  const examType = c.req.query('type')

  let q = sb
    .from('exam_submissions')
    .select('id, exam_type, total_score, max_possible_score, percentage, passed, question_scores, attempt_number, submitted_at, graded_at')
    .eq('user_id', ctx.user.id)
    .order('submitted_at', { ascending: false })

  if (examType) q = q.eq('exam_type', examType)

  const { data } = await q.limit(10)

  return c.json({ submissions: data || [] })
})

export { app as examRoutes }
