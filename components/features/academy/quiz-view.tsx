'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, X, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { EASE, PASS_THRESHOLD } from '@/lib/academy-constants'
import { useAuthStore } from '@/stores/auth'
import { useSubmitQuiz } from '@/hooks/academy/use-academy-mutations'
import type { Module } from '@/types/academy'

interface QuizViewProps {
  mod: Module
  onPass?: () => void
  onBack?: () => void
  onComplete?: () => void
  /** 'inline' = Knowledge Check inside lesson; 'standalone' = separate quiz view */
  variant?: 'inline' | 'standalone'
}

export function QuizView({
  mod,
  onPass,
  onBack,
  onComplete,
  variant = 'standalone',
}: QuizViewProps) {
  const session = useAuthStore((s) => s.session)
  const submitQuiz = useSubmitQuiz()

  // For standalone quiz: fetch from API
  const [apiQuestions, setApiQuestions] = useState<Array<Record<string, unknown>>>([])
  const [loading, setLoading] = useState(variant === 'standalone')
  const [error, setError] = useState<string | null>(null)
  const [canAttempt, setCanAttempt] = useState(true)

  const [current, setCurrent] = useState(0)
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const [submitted, setSubmitted] = useState(false)
  const [score, setScore] = useState(0)
  const [result, setResult] = useState<Record<string, unknown> | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Inline quiz uses mod.quiz, standalone fetches from API
  const inlineQuestions = mod.quiz || []
  const isInline = variant === 'inline'

  useEffect(() => {
    if (variant !== 'standalone' || !session) return
    async function load() {
      try {
        const res = await fetch(`/api/exams/questions?type=${mod.examType}`, {
          headers: { Authorization: `Bearer ${session!.access_token}` },
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Failed to load questions')
        setCanAttempt(data.canAttempt ?? true)
        setApiQuestions(data.questions || [])
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [mod.examType, session, variant])

  // ── Inline quiz submit ──
  async function submitInline() {
    let correct = 0
    inlineQuestions.forEach((q, i) => {
      if (answers[i] === q.correct) correct++
    })
    const pct = Math.round((correct / inlineQuestions.length) * 100)
    setScore(pct)
    setSubmitted(true)
    if (pct >= 70) {
      setSubmitting(true)
      try {
        await submitQuiz.mutateAsync({
          moduleId: mod.id,
          score: pct,
          passed: true,
          allModulesPassed: false, // parent will handle
        })
      } catch {
        // swallow
      }
      setSubmitting(false)
      onPass?.()
    }
  }

  // ── Standalone quiz submit ──
  async function submitStandalone() {
    setSubmitting(true)
    try {
      const formattedAnswers = apiQuestions.map((q) => ({
        question_id: q.id,
        selected_index: answers[q.id as number] ?? null,
      }))
      const res = await fetch('/api/exams/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session!.access_token}`,
        },
        body: JSON.stringify({ exam_type: mod.examType, answers: formattedAnswers }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Submission failed')
      setResult(data)
      setSubmitted(true)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setSubmitting(false)
    }
  }

  // ── INLINE QUIZ RENDERING ──
  if (isInline) {
    if (inlineQuestions.length === 0) {
      return (
        <div className="py-8 text-center text-foreground-4">
          No quiz questions available for this module yet.
        </div>
      )
    }

    if (submitted) {
      const passed = score >= 70
      const ringR = 54
      const rStroke = 6
      const rCirc = 2 * Math.PI * ringR
      return (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: EASE }}
          className="mx-auto max-w-[600px] py-5 text-center"
        >
          <div className="relative mb-5 inline-flex items-center justify-center">
            <svg
              width="120"
              height="120"
              viewBox="0 0 120 120"
              style={{ transform: 'rotate(-90deg)' }}
            >
              <circle
                cx="60"
                cy="60"
                r={ringR}
                fill="none"
                stroke="rgba(0,0,0,0.07)"
                strokeWidth={rStroke}
              />
              <motion.circle
                cx="60"
                cy="60"
                r={ringR}
                fill="none"
                stroke={passed ? '#10B981' : '#EF4444'}
                strokeWidth={rStroke}
                strokeLinecap="round"
                strokeDasharray={rCirc}
                initial={{ strokeDashoffset: rCirc }}
                animate={{ strokeDashoffset: rCirc - (score / 100) * rCirc }}
                transition={{ duration: 1.2, ease: 'easeOut', delay: 0.2 }}
              />
            </svg>
            <div className="absolute text-center">
              <div className="text-[28px] font-extrabold text-foreground">{score}%</div>
              <div className="text-[11px] text-foreground-4">score</div>
            </div>
          </div>
          <h3 className="mb-1.5 text-xl font-bold text-foreground">
            {passed ? 'Knowledge Check Passed!' : 'Not quite yet'}
          </h3>
          <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
            {passed
              ? `You scored ${score}% \u2014 module complete.`
              : `You scored ${score}%. You need 70% to pass. Review the lessons and try again.`}
          </p>
          {!passed && (
            <button
              className="cursor-pointer rounded-[20px] border-none bg-gradient-to-br from-violet-500 to-indigo-500 px-6 py-2.5 font-[inherit] text-[13px] font-semibold text-white shadow-[0_4px_16px_rgba(99,102,241,0.3)] transition-all duration-150 hover:-translate-y-px hover:brightness-110"
              onClick={() => {
                setSubmitted(false)
                setAnswers({})
                setCurrent(0)
              }}
            >
              Try Again
            </button>
          )}
          {submitting && (
            <p className="mt-3 text-xs text-foreground-4">Saving result...</p>
          )}
        </motion.div>
      )
    }

    const q = inlineQuestions[current]
    const total = inlineQuestions.length
    const allAnswered = Object.keys(answers).length === total

    return (
      <div className="mx-auto max-w-[640px]">
        {/* Progress */}
        <div className="mb-6">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-foreground-4">
              Question {current + 1} of {total}
            </span>
            <span className="text-[11px] text-foreground-4">
              {Object.keys(answers).length}/{total} answered
            </span>
          </div>
          <div className="h-[3px] overflow-hidden rounded-[10px] bg-black/8">
            <motion.div
              className="h-full rounded-[10px] bg-gradient-to-r from-violet-500 to-indigo-500"
              animate={{ width: `${((current + 1) / total) * 100}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>

        {/* Question */}
        <AnimatePresence mode="wait">
          <motion.div
            key={current}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2, ease: EASE }}
          >
            <div className="mb-4 rounded-xl border border-border bg-white p-7">
              <h3 className="text-lg font-semibold leading-[1.45] text-foreground">{q.q}</h3>
            </div>
            <div className="flex flex-col gap-2">
              {q.opts.map((opt, idx) => {
                const sel = answers[current] === idx
                return (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.06, duration: 0.25, ease: EASE }}
                    onClick={() => setAnswers((prev) => ({ ...prev, [current]: idx }))}
                    className={cn(
                      'mb-2.5 flex cursor-pointer items-center gap-4 rounded-xl border border-black/9 bg-white px-5 py-4 transition-all duration-150 hover:border-[rgba(139,92,246,0.3)] hover:bg-[#F9F9FB]',
                      sel && 'border-[#8B5CF6] bg-[rgba(139,92,246,0.06)]',
                    )}
                  >
                    <div
                      className={cn(
                        'flex size-5 shrink-0 items-center justify-center rounded-full border-2 border-black/20 transition-all duration-150',
                        sel && 'border-[#8B5CF6] bg-[#8B5CF6]',
                      )}
                    >
                      {sel && <div className="size-2 rounded-full bg-white" />}
                    </div>
                    <span className="flex-1 text-[15px] text-foreground">{opt}</span>
                  </motion.div>
                )
              })}
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Navigation */}
        <div className="mt-5 flex items-center justify-between">
          <button
            className="cursor-pointer rounded-[20px] border border-black/9 bg-black/4 px-5 py-2.5 font-[inherit] text-[13px] font-medium text-muted-foreground transition-all duration-150 hover:bg-black/7 hover:text-foreground-2 disabled:opacity-35"
            onClick={() => setCurrent((c) => Math.max(0, c - 1))}
            disabled={current === 0}
          >
            &larr; Previous
          </button>
          {current < total - 1 ? (
            <button
              className="cursor-pointer rounded-[20px] border-none bg-gradient-to-br from-violet-500 to-indigo-500 px-6 py-2.5 font-[inherit] text-[13px] font-semibold text-white shadow-[0_4px_16px_rgba(99,102,241,0.3)] transition-all duration-150 hover:-translate-y-px hover:brightness-110"
              onClick={() => setCurrent((c) => c + 1)}
            >
              Next &rarr;
            </button>
          ) : (
            <button
              className="cursor-pointer rounded-[20px] border-none bg-gradient-to-br from-violet-500 to-indigo-500 px-6 py-2.5 font-[inherit] text-[13px] font-semibold text-white shadow-[0_4px_16px_rgba(99,102,241,0.3)] transition-all duration-150 hover:-translate-y-px hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={submitInline}
              disabled={!allAnswered || submitting}
            >
              {submitting ? 'Saving...' : 'Submit Quiz'}
            </button>
          )}
        </div>
      </div>
    )
  }

  // ── STANDALONE QUIZ RENDERING ──

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto mb-3 size-8 animate-spin text-violet-500" />
          <div className="text-[13px] text-foreground-4">Loading questions...</div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-10 text-center">
        <div className="mb-4 text-sm text-red-500">{error}</div>
        <button
          className="cursor-pointer rounded-[20px] border border-black/9 bg-black/4 px-5 py-2.5 font-[inherit] text-[13px] font-medium text-muted-foreground transition-all duration-150 hover:bg-black/7 hover:text-foreground-2"
          onClick={onBack}
        >
          &larr; Back
        </button>
      </div>
    )
  }

  if (!canAttempt) {
    return (
      <div className="mx-auto max-w-[500px] p-10 text-center" style={{ marginTop: 80 }}>
        <div className="mb-4 text-4xl">&#9940;</div>
        <div className="mb-2 text-xl font-bold text-foreground">Maximum attempts reached</div>
        <div className="mb-6 text-sm text-muted-foreground">
          You have used all 3 attempts for this module&apos;s exam.
        </div>
        <button
          className="cursor-pointer rounded-[20px] border border-black/9 bg-black/4 px-5 py-2.5 font-[inherit] text-[13px] font-medium text-muted-foreground transition-all duration-150 hover:bg-black/7 hover:text-foreground-2"
          onClick={onBack}
        >
          &larr; Back to module
        </button>
      </div>
    )
  }

  if (apiQuestions.length === 0) {
    return (
      <div className="mx-auto max-w-[500px] p-10 text-center" style={{ marginTop: 80 }}>
        <div className="mb-4 text-sm text-muted-foreground">
          No questions available for this module yet.
        </div>
        <button
          className="cursor-pointer rounded-[20px] border border-black/9 bg-black/4 px-5 py-2.5 font-[inherit] text-[13px] font-medium text-muted-foreground transition-all duration-150 hover:bg-black/7 hover:text-foreground-2"
          onClick={onBack}
        >
          &larr; Back
        </button>
      </div>
    )
  }

  // Results screen (standalone)
  if (submitted && result) {
    const pct = (result.score as number) ?? 0
    const passed = (result.passed as boolean) ?? pct >= PASS_THRESHOLD
    const ringR = 70
    const rStroke = 8
    const rCirc = 2 * Math.PI * ringR
    const rOffset = rCirc - (pct / 100) * rCirc

    return (
      <div className="mx-auto max-w-[680px] px-6 py-12 text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: EASE }}
        >
          <div className="relative mb-6 inline-flex items-center justify-center">
            <svg
              width="158"
              height="158"
              viewBox="0 0 158 158"
              style={{ transform: 'rotate(-90deg)' }}
            >
              <circle
                cx="79"
                cy="79"
                r={ringR}
                fill="none"
                stroke="rgba(0,0,0,0.08)"
                strokeWidth={rStroke}
              />
              <motion.circle
                cx="79"
                cy="79"
                r={ringR}
                fill="none"
                stroke={passed ? '#10B981' : '#EF4444'}
                strokeWidth={rStroke}
                strokeLinecap="round"
                strokeDasharray={rCirc}
                initial={{ strokeDashoffset: rCirc }}
                animate={{ strokeDashoffset: rOffset }}
                transition={{ duration: 1.5, ease: 'easeOut', delay: 0.3 }}
              />
            </svg>
            <div className="absolute text-center">
              <div className="text-4xl font-extrabold text-foreground">{Math.round(pct)}%</div>
              <div className="text-[11px] text-foreground-4">score</div>
            </div>
          </div>

          <h2 className="mb-2 text-2xl font-bold tracking-tight text-foreground">
            {passed ? 'Excellent work!' : 'Keep practicing'}
          </h2>
          <p className="mb-7 text-[15px] leading-relaxed text-muted-foreground">
            {passed
              ? `You passed with ${Math.round(pct)}%. ${mod.label} is now complete!`
              : `You scored ${Math.round(pct)}%. You need ${PASS_THRESHOLD}% to pass. Review the lessons and try again.`}
          </p>

          {/* Answer breakdown */}
          <div className="mb-7 text-left">
            {apiQuestions.map((q, qi) => {
              const userIdx = answers[q.id as number] ?? null
              const correctIdx =
                typeof q.correct_answer_index === 'number' ? q.correct_answer_index : null
              const isCorrect = userIdx !== null && userIdx === correctIdx
              return (
                <div
                  key={q.id as string}
                  className="mb-1.5 flex items-center gap-3 rounded-lg border border-black/6 bg-black/2 px-4 py-3"
                >
                  <div
                    className="flex size-5 shrink-0 items-center justify-center rounded-full border"
                    style={{
                      background: isCorrect ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)',
                      borderColor: isCorrect ? 'rgba(16,185,129,0.4)' : 'rgba(239,68,68,0.4)',
                    }}
                  >
                    {isCorrect ? (
                      <Check className="size-2.5 text-emerald-500" />
                    ) : (
                      <X className="size-2.5 text-red-500" strokeWidth={3} />
                    )}
                  </div>
                  <span className="flex-1 text-[13px] text-foreground-2">
                    Q{qi + 1}: {(q.question || q.text) as string}
                  </span>
                  <span
                    className="text-[11px] font-semibold"
                    style={{ color: isCorrect ? '#10B981' : '#EF4444' }}
                  >
                    {isCorrect ? 'Correct' : 'Wrong'}
                  </span>
                </div>
              )
            })}
          </div>

          <div className="flex justify-center gap-2.5">
            {passed ? (
              <button
                className="cursor-pointer rounded-[20px] border-none bg-gradient-to-br from-emerald-500 to-emerald-600 px-[22px] py-2.5 font-[inherit] text-[13px] font-semibold text-white shadow-[0_4px_16px_rgba(16,185,129,0.3)] transition-all duration-150 hover:-translate-y-px hover:brightness-110"
                onClick={onComplete}
              >
                Continue &rarr;
              </button>
            ) : (
              <>
                <button
                  className="cursor-pointer rounded-[20px] border border-black/9 bg-black/4 px-5 py-2.5 font-[inherit] text-[13px] font-medium text-muted-foreground transition-all duration-150 hover:bg-black/7 hover:text-foreground-2"
                  onClick={onBack}
                >
                  &larr; Back to lessons
                </button>
                <button
                  className="cursor-pointer rounded-[20px] border-none bg-gradient-to-br from-violet-500 to-indigo-500 px-6 py-2.5 font-[inherit] text-[13px] font-semibold text-white shadow-[0_4px_16px_rgba(99,102,241,0.3)] transition-all duration-150 hover:-translate-y-px hover:brightness-110"
                  onClick={() => {
                    setSubmitted(false)
                    setResult(null)
                    setAnswers({})
                    setCurrent(0)
                  }}
                >
                  Retake quiz
                </button>
              </>
            )}
          </div>
        </motion.div>
      </div>
    )
  }

  // Standalone question screen
  const q = apiQuestions[current]
  const opts = (q?.options || q?.answer_options || []) as string[]

  return (
    <div className="mx-auto max-w-[680px] px-6 py-10">
      <div className="mb-7">
        <div className="mb-2.5 text-[11px] font-bold uppercase tracking-[0.1em] text-foreground-4">
          Question {current + 1} of {apiQuestions.length}
        </div>
        <div className="h-[3px] overflow-hidden rounded-[10px] bg-black/8">
          <motion.div
            className="h-full rounded-[10px] bg-gradient-to-r from-violet-500 to-indigo-500"
            animate={{ width: `${((current + 1) / apiQuestions.length) * 100}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={current}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.25, ease: EASE }}
        >
          <h3 className="mb-6 text-[22px] font-bold leading-[1.4] tracking-tight text-foreground">
            {(q?.question || q?.text) as string}
          </h3>

          {opts.map((opt, idx) => {
            const sel = answers[q.id as number] === idx
            return (
            <motion.div
              key={idx}
              className={cn(
                'mb-2.5 flex cursor-pointer items-center gap-4 rounded-xl border border-black/9 bg-white px-5 py-4 transition-all duration-150 hover:border-[rgba(139,92,246,0.3)] hover:bg-[#F9F9FB]',
                sel && 'border-[#8B5CF6] bg-[rgba(139,92,246,0.06)]',
              )}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.07, duration: 0.3, ease: EASE }}
              onClick={() => setAnswers((prev) => ({ ...prev, [q.id as number]: idx }))}
            >
              <div
                className={cn(
                  'flex size-5 shrink-0 items-center justify-center rounded-full border-2 border-black/20 transition-all duration-150',
                  sel && 'border-[#8B5CF6] bg-[#8B5CF6]',
                )}
              >
                {sel && (
                  <div className="size-2 rounded-full bg-white" />
                )}
              </div>
              <span className="flex-1 text-[15px] text-foreground">{opt}</span>
            </motion.div>
            )
          })}
        </motion.div>
      </AnimatePresence>

      <div className="mt-6 flex justify-between">
        <button
          className="cursor-pointer rounded-[20px] border border-black/9 bg-black/4 px-5 py-2.5 font-[inherit] text-[13px] font-medium text-muted-foreground transition-all duration-150 hover:bg-black/7 hover:text-foreground-2 disabled:opacity-35"
          onClick={() => setCurrent((c) => Math.max(0, c - 1))}
          disabled={current === 0}
        >
          &larr; Previous
        </button>
        {current < apiQuestions.length - 1 ? (
          <button
            className="cursor-pointer rounded-[20px] border-none bg-gradient-to-br from-violet-500 to-indigo-500 px-6 py-2.5 font-[inherit] text-[13px] font-semibold text-white shadow-[0_4px_16px_rgba(99,102,241,0.3)] transition-all duration-150 hover:-translate-y-px hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => setCurrent((c) => c + 1)}
            disabled={answers[q.id as number] === undefined}
          >
            Next &rarr;
          </button>
        ) : (
          <button
            className="cursor-pointer rounded-[20px] border-none bg-gradient-to-br from-violet-500 to-indigo-500 px-6 py-2.5 font-[inherit] text-[13px] font-semibold text-white shadow-[0_4px_16px_rgba(99,102,241,0.3)] transition-all duration-150 hover:-translate-y-px hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={submitStandalone}
            disabled={submitting || Object.keys(answers).length < apiQuestions.length}
          >
            {submitting ? 'Submitting...' : 'Submit Quiz'}
          </button>
        )}
      </div>
    </div>
  )
}
