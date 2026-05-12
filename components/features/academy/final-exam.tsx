'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import {
  EASE,
  ALL_MODULE_IDS,
  SECTION_META,
  ALL_EXAM_QUESTIONS,
} from '@/lib/academy-constants'
import { useSubmitExam } from '@/hooks/academy/use-academy-mutations'
import type { SectionMeta } from '@/types/academy'
import { ExamLockedView } from './exam-locked-view'
import { ExamIntroView } from './exam-intro-view'
import { ExamResultsView } from './exam-results-view'

// ── Helpers ──
function sectionScore(sIdx: number, answers: Record<number, number>): number {
  const start = sIdx * 10
  const end = start + 10
  let correct = 0
  for (let i = start; i < end; i++) {
    if (answers[i] === ALL_EXAM_QUESTIONS[i].correct) correct++
  }
  return Math.round((correct / 10) * 100)
}

export function FinalExam() {
  const [view, setView] = useState<'loading' | 'locked' | 'intro' | 'exam' | 'results'>('loading')
  const [session, setSession] = useState<Record<string, unknown> | null>(null)
  const [passedModules, setPassedModules] = useState<string[]>([])
  const [currentQ, setCurrentQ] = useState(0)
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const [scores, setScores] = useState<{ sections: number[]; total: number } | null>(null)
  const [saving, setSaving] = useState(false)

  const storeSession = useAuthStore((s) => s.session)
  const storeUser = useAuthStore((s) => s.user)
  const isAuthLoading = useAuthStore((s) => s.isLoading)

  const submitExam = useSubmitExam()

  useEffect(() => {
    if (isAuthLoading) return
    if (!storeSession || !storeUser) {
      window.location.href = '/login'
      return
    }

    // Set session for downstream use (double-cast is tech debt)
    setSession(storeSession as unknown as Record<string, unknown>)
    const isAdmin = storeUser.email === 'info@lynqagency.com'
    if (isAdmin) {
      setView('intro')
      return
    }
    ;(async () => {
      try {
        const { data } = await supabase
          .from('exam_submissions')
          .select('module_id, passed')
          .eq('user_id', storeUser.id)
          .eq('passed', true)
        const passed = (data || [])
          .map((r) => r.module_id as string)
          .filter((id) => ALL_MODULE_IDS.includes(id))
        setPassedModules(passed)
        setView(ALL_MODULE_IDS.every((id) => passed.includes(id)) ? 'intro' : 'locked')
      } catch {
        setView('locked')
      }
    })()
  }, [isAuthLoading, storeSession, storeUser])

  async function handleSubmit() {
    setSaving(true)
    const sectionScores = [0, 1, 2, 3, 4].map((s) => sectionScore(s, answers))
    const total = Math.round(sectionScores.reduce((a, b) => a + b, 0) / 5)
    setScores({ sections: sectionScores, total })
    const passed = total >= 80

    try {
      await submitExam.mutateAsync({ score: total, passed })
    } catch {
      // swallow
    }

    setSaving(false)
    setView('results')
  }

  const handleReturn = () => {
    window.location.href = '/academy'
  }

  const handleStart = () => {
    setCurrentQ(0)
    setAnswers({})
    setView('exam')
  }

  const handleRetake = () => {
    setAnswers({})
    setCurrentQ(0)
    setScores(null)
    setView('intro')
  }

  // ── Loading ──
  if (view === 'loading')
    return (
        <div className="flex h-screen items-center justify-center bg-[#F9F9FB]">
          <div className="text-center">
            <Loader2 className="mx-auto mb-3 size-9 animate-spin text-violet-500" />
            <div className="text-[13px] text-foreground-4">Loading...</div>
          </div>
        </div>
    )

  // ── Locked ──
  if (view === 'locked')
    return <ExamLockedView passedModules={passedModules} onReturn={handleReturn} />

  // ── Intro ──
  if (view === 'intro')
    return <ExamIntroView onStart={handleStart} onReturn={handleReturn} />

  // ── Results ──
  if (view === 'results' && scores)
    return (
      <ExamResultsView
        scores={scores}
        passed={scores.total >= 80}
        onRetake={handleRetake}
        onReturn={handleReturn}
      />
    )

  // ── Exam ──
  const q = ALL_EXAM_QUESTIONS[currentQ]
  const currentSection = Math.floor(currentQ / 10)
  const meta = SECTION_META[currentSection]
  const isLastQ = currentQ === 49
  const isFirstQ = currentQ === 0
  const prevQ = ALL_EXAM_QUESTIONS[currentQ - 1]
  const showContext = q?.showContext || (q?.caseTitle && prevQ?.caseTitle !== q?.caseTitle)
  const answeredTotal = Object.keys(answers).length
  const qInSection = currentQ % 10

  return (
      <div className="flex h-screen flex-col overflow-hidden bg-[#F9F9FB]">
        {/* Progress header */}
        <div className="flex h-[52px] shrink-0 items-center gap-4 border-b border-border bg-white px-6">
          <div className="flex flex-1 items-center gap-1.5">
            {SECTION_META.map(({ label, color }: SectionMeta, i: number) => (
              <div key={i} className="flex items-center gap-[5px]">
                <div
                  className="flex size-[22px] shrink-0 items-center justify-center rounded-full text-[9px] font-bold transition-all duration-300"
                  style={{
                    background:
                      currentSection === i
                        ? meta.color
                        : currentSection > i
                          ? '#10B981'
                          : 'rgba(0,0,0,0.08)',
                    color: currentSection >= i ? '#FFF' : '#9CA3AF',
                  }}
                >
                  {currentSection > i ? (
                    <Check className="size-2.5" />
                  ) : (
                    i + 1
                  )}
                </div>
                <span
                  className="whitespace-nowrap text-[11px]"
                  style={{
                    fontWeight: currentSection === i ? 600 : 400,
                    color: currentSection === i ? '#0F0F10' : '#C4C4C4',
                  }}
                >
                  {label}
                </span>
                {i < 4 && <div className="mx-0.5 h-px w-4 bg-black/10" />}
              </div>
            ))}
          </div>
          <span className="shrink-0 text-xs text-foreground-4">Q{currentQ + 1}/50</span>
          <button
            className="cursor-pointer rounded-[20px] border border-black/9 bg-black/4 px-3.5 py-1.5 font-[inherit] text-xs font-medium text-muted-foreground transition-all duration-150 hover:bg-black/7 hover:text-foreground-2"
            onClick={() => setView('intro')}
          >
            Exit
          </button>
        </div>

        {/* Total progress bar */}
        <div className="h-[3px] bg-black/6">
          <motion.div
            className="h-full"
            style={{ background: `linear-gradient(90deg,${meta.color},#8B5CF6)` }}
            animate={{ width: `${((currentQ + 1) / 50) * 100}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>

        <div className="thin-scrollbar flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[720px] px-6 py-8">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentQ}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.22, ease: EASE }}
              >
                {/* Section label + progress */}
                <div className="mb-5">
                  <div className="mb-2 flex items-center justify-between">
                    <span
                      className="text-[10px] font-bold uppercase tracking-[0.1em]"
                      style={{ color: meta.color }}
                    >
                      {meta.label} &mdash; Question {qInSection + 1} of 10
                    </span>
                    <span className="text-[11px] text-foreground-4">
                      {answeredTotal}/50 answered
                    </span>
                  </div>
                  <div className="h-[3px] overflow-hidden rounded-[10px] bg-black/7">
                    <div
                      className="h-full rounded-[10px] transition-[width] duration-300 ease-out"
                      style={{
                        background: meta.color,
                        width: `${((qInSection + 1) / 10) * 100}%`,
                      }}
                    />
                  </div>
                </div>

                {/* Case context */}
                {showContext && q.caseContext && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className="mb-5 rounded-lg border border-violet-500/12 border-l-[3px] border-l-violet-500 bg-background px-5 py-4"
                  >
                    <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.1em] text-violet-500">
                      Case Study: {q.caseTitle}
                    </div>
                    <p className="text-sm leading-[1.75] text-foreground-2">{q.caseContext}</p>
                  </motion.div>
                )}

                {/* Case badge (not first question) */}
                {q?.caseTitle && !showContext && (
                  <div className="mb-3.5 inline-block rounded-md border border-violet-500/12 bg-violet-500/5 px-3 py-1.5">
                    <span className="text-[11px] font-semibold text-violet-500">
                      {q.caseTitle}
                    </span>
                  </div>
                )}

                {/* Question */}
                <div className="mb-3.5 rounded-xl border border-border bg-white px-7 py-6">
                  <h3 className="text-lg font-semibold leading-[1.5] text-foreground">{q.q}</h3>
                </div>

                {/* Options */}
                {q.opts.map((opt, idx) => {
                  const sel = answers[currentQ] === idx
                  return (
                    <div
                      key={idx}
                      className={cn(
                        'mb-2 flex cursor-pointer items-center gap-3.5 rounded-[10px] border border-black/9 bg-white px-[18px] py-3.5 transition-all duration-150 hover:border-[rgba(139,92,246,0.35)] hover:bg-[rgba(139,92,246,0.02)]',
                        sel && 'border-[#8B5CF6] bg-[rgba(139,92,246,0.06)]',
                      )}
                      onClick={() => setAnswers((prev) => ({ ...prev, [currentQ]: idx }))}
                    >
                      <div
                        className={cn(
                          'flex size-[18px] shrink-0 items-center justify-center rounded-full border-2 border-black/20 transition-all duration-150',
                          sel && 'border-[#8B5CF6] bg-[#8B5CF6]',
                        )}
                      >
                        {sel && <div className="size-2 rounded-full bg-white" />}
                      </div>
                      <span className="flex-1 text-sm text-foreground">{opt}</span>
                    </div>
                  )
                })}

                {/* Navigation */}
                <div className="mt-5 flex items-center justify-between">
                  <button
                    className="cursor-pointer rounded-[20px] border border-black/9 bg-black/4 px-5 py-2.5 font-[inherit] text-[13px] font-medium text-muted-foreground transition-all duration-150 hover:bg-black/7 hover:text-foreground-2 disabled:opacity-35"
                    onClick={() => setCurrentQ((q) => q - 1)}
                    disabled={isFirstQ}
                  >
                    &larr; Previous
                  </button>
                  {!isLastQ ? (
                    <button
                      className="cursor-pointer rounded-[20px] border-none bg-gradient-to-br from-violet-500 to-indigo-500 px-6 py-2.5 font-[inherit] text-[13px] font-semibold text-white shadow-[0_4px_16px_rgba(99,102,241,0.3)] transition-all duration-150 hover:-translate-y-px hover:brightness-110"
                      onClick={() => setCurrentQ((q) => q + 1)}
                    >
                      Next &rarr;
                    </button>
                  ) : (
                    <button
                      className="cursor-pointer rounded-[20px] border-none bg-gradient-to-br from-violet-500 to-indigo-500 px-6 py-2.5 font-[inherit] text-[13px] font-semibold text-white shadow-[0_4px_16px_rgba(99,102,241,0.3)] transition-all duration-150 hover:-translate-y-px hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={answeredTotal < 50 || saving}
                      onClick={handleSubmit}
                    >
                      {saving ? 'Submitting...' : 'Submit Exam \u2192'}
                    </button>
                  )}
                </div>
                {isLastQ && answeredTotal < 50 && (
                  <p className="mt-2.5 text-center text-xs text-amber-500">
                    {50 - answeredTotal} question{50 - answeredTotal !== 1 ? 's' : ''} still
                    unanswered
                  </p>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
  )
}
