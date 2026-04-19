import { generateText } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { supabaseAdmin, getUserFromToken } from '../../../../lib/supabaseAdmin'
import { NextResponse } from 'next/server'

const PASSING_SCORE = 75
const MAX_ATTEMPTS = 3

async function gradeOpenQuestion(question, answer) {
  if (!answer?.trim()) return { score: 0, feedback: 'No answer provided.' }

  try {
    const { text } = await generateText({
      model: anthropic('claude-haiku-4-5-20251001'),
      prompt: `You are grading an e-commerce operations exam. Be strict but fair.

Question: ${question.question}

Grading Rubric: ${question.grading_rubric}

Candidate's Answer: ${answer}

Return ONLY this JSON (no markdown, no other text):
{"score":${question.max_points <= 10 ? '<number 0 to ' + question.max_points + '>' : '<number>'},"feedback":"<1-2 sentence feedback explaining the score>"}`,
      maxTokens: 200,
    })

    const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
    const parsed = JSON.parse(cleaned)
    return {
      score: Math.min(Math.max(Number(parsed.score) || 0, 0), question.max_points),
      feedback: parsed.feedback || '',
    }
  } catch {
    return { score: 0, feedback: 'Grading error — manual review required.' }
  }
}

export async function POST(request) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = authHeader.replace('Bearer ', '')
  const user = await getUserFromToken(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { exam_type, answers } = await request.json()

  const VALID_TYPES = ['customer_service', 'supply_chain', 'dispute_management', 'overall_manager']
  if (!VALID_TYPES.includes(exam_type)) {
    return NextResponse.json({ error: 'Invalid exam type' }, { status: 400 })
  }
  if (!answers || typeof answers !== 'object') {
    return NextResponse.json({ error: 'answers object required' }, { status: 400 })
  }

  // Check if already passed
  const { data: existing } = await supabaseAdmin
    .from('exam_submissions')
    .select('id')
    .eq('user_id', user.id)
    .eq('exam_type', exam_type)
    .eq('passed', true)
    .maybeSingle()

  if (existing) return NextResponse.json({ error: 'You have already passed this exam.' }, { status: 409 })

  // Check attempt limit
  const { count } = await supabaseAdmin
    .from('exam_submissions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('exam_type', exam_type)

  if ((count || 0) >= MAX_ATTEMPTS) {
    return NextResponse.json({ error: 'Maximum attempts reached for this exam.' }, { status: 429 })
  }

  // Load questions with correct answers (server-side only)
  const { data: questions } = await supabaseAdmin
    .from('exam_questions')
    .select('*')
    .eq('exam_type', exam_type)
    .order('question_order')

  if (!questions?.length) {
    return NextResponse.json({ error: 'Exam not found' }, { status: 404 })
  }

  // Grade each question
  const questionScores = {}
  let totalEarned = 0
  let totalPossible = 0

  for (const q of questions) {
    const answer = answers[q.id]
    totalPossible += q.max_points

    if (q.question_type === 'multiple_choice') {
      const isCorrect = String(answer) === String(q.correct_answer)
      const score = isCorrect ? q.max_points : 0
      questionScores[q.id] = {
        type: 'multiple_choice',
        score,
        max: q.max_points,
        correct: isCorrect,
        correct_answer: q.correct_answer,
        submitted_answer: answer,
        feedback: isCorrect ? 'Correct.' : `Incorrect. The correct answer was option ${q.correct_answer}.`,
      }
      totalEarned += score
    } else {
      // open or case_study — grade with Claude
      const { score, feedback } = await gradeOpenQuestion(q, answer)
      questionScores[q.id] = {
        type: q.question_type,
        score,
        max: q.max_points,
        submitted_answer: answer,
        feedback,
      }
      totalEarned += score
    }
  }

  const percentage = totalPossible > 0 ? Math.round((totalEarned / totalPossible) * 100 * 10) / 10 : 0
  const passed = percentage >= PASSING_SCORE

  // Save submission
  const { data: submission } = await supabaseAdmin
    .from('exam_submissions')
    .insert({
      user_id: user.id,
      exam_type,
      answers,
      total_score: totalEarned,
      max_possible_score: totalPossible,
      percentage,
      passed,
      question_scores: questionScores,
      attempt_number: (count || 0) + 1,
      status: 'graded',
      graded_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  // Update profile status if passed
  if (passed) {
    await supabaseAdmin
      .from('profiles')
      .update({
        exam_status: 'exam_passed',
        exam_type_taken: exam_type,
        exam_score: percentage,
      })
      .eq('id', user.id)

    // Create talent profile placeholder if not exists
    await supabaseAdmin
      .from('talent_profiles')
      .upsert({
        user_id: user.id,
        role: exam_type,
        exam_score: percentage,
        exam_type: exam_type,
        visible: false,
      }, { onConflict: 'user_id' })

    // Log AI usage for grading
    const openCount = questions.filter(q => q.question_type !== 'multiple_choice').length
    if (openCount > 0) {
      await supabaseAdmin.from('ai_usage').insert({
        route: 'exam_grading',
        model: 'claude-haiku-4-5-20251001',
        input_tokens: openCount * 300,
        output_tokens: openCount * 80,
        cost_usd: openCount * ((300 * 0.0000008) + (80 * 0.000004)),
        user_email: user.email,
      })
    }
  }

  return NextResponse.json({
    submission_id: submission?.id,
    exam_type,
    total_score: totalEarned,
    max_possible: totalPossible,
    percentage,
    passed,
    passing_score: PASSING_SCORE,
    question_scores: questionScores,
    message: passed
      ? `Gefeliciteerd! Je hebt het examen gehaald met ${percentage}%. Je wordt binnenkort uitgenodigd voor een call met het Lynq team.`
      : `Je score is ${percentage}%. De minimale score is ${PASSING_SCORE}%. Je kunt het examen opnieuw proberen. Resterende pogingen: ${MAX_ATTEMPTS - (count || 0) - 1}.`,
  })
}
