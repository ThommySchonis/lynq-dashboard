'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, X, Lock, Award, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Sidebar } from '@/components/layout/sidebar'
import {
  EASE,
  ALL_MODULE_IDS,
  MODULE_LABELS,
  SECTION_META,
  ALL_EXAM_QUESTIONS,
} from '@/lib/academy-constants'
import { useSubmitExam } from '@/hooks/academy/use-academy-mutations'
import type { ExamQuestion, SectionMeta } from '@/types/academy'

// ── Confetti pieces (pre-computed, stable) ──
const CONFETTI_COLORS = ['#8B5CF6', '#6366F1', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#EC4899']
const CONFETTI = Array.from({ length: 30 }, (_, i) => ({
  left: `${(i * 37 + 11) % 100}%`,
  delay: `${((i * 7) % 30) * 0.1}s`,
  color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
  size: 6 + (i % 5),
  duration: `${2.5 + (i % 8) * 0.2}s`,
}))

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

function totalScore(answers: Record<number, number>): number {
  const scores = [0, 1, 2, 3, 4].map((s) => sectionScore(s, answers))
  return Math.round(scores.reduce((a, b) => a + b, 0) / 5)
}

export function FinalExam() {
  const [view, setView] = useState<'loading' | 'locked' | 'intro' | 'exam' | 'results'>('loading')
  const [session, setSession] = useState<Record<string, unknown> | null>(null)
  const [passedModules, setPassedModules] = useState<string[]>([])
  const [currentQ, setCurrentQ] = useState(0)
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const [scores, setScores] = useState<{ sections: number[]; total: number } | null>(null)
  const [saving, setSaving] = useState(false)

  const submitExam = useSubmitExam()

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
      if (!s) {
        window.location.href = '/login'
        return
      }
      setSession(s as unknown as Record<string, unknown>)
      const isAdmin = s.user.email === 'info@lynqagency.com'
      if (isAdmin) {
        setView('intro')
        return
      }
      try {
        const { data } = await supabase
          .from('exam_submissions')
          .select('module_id, passed')
          .eq('user_id', s.user.id)
          .eq('passed', true)
        const passed = (data || [])
          .map((r) => r.module_id as string)
          .filter((id) => ALL_MODULE_IDS.includes(id))
        setPassedModules(passed)
        setView(ALL_MODULE_IDS.every((id) => passed.includes(id)) ? 'intro' : 'locked')
      } catch {
        setView('locked')
      }
    })
  }, [])

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

  // ── Loading ──
  if (view === 'loading')
    return (
      <div className="flex h-screen bg-[#F9F9FB]">
        <Sidebar />
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <Loader2 className="mx-auto mb-3 size-9 animate-spin text-violet-500" />
            <div className="text-[13px] text-(--text-4)">Loading...</div>
          </div>
        </div>
      </div>
    )

  // ── Locked ──
  if (view === 'locked')
    return (
      <div className="flex h-screen bg-[#F9F9FB]">
        <Sidebar />
        <div className="ac-scroll flex flex-1 items-center justify-center overflow-y-auto px-6 py-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: EASE }}
            className="w-full max-w-[560px]"
          >
            <div className="mb-8 text-center">
              <div className="mx-auto mb-5 flex size-16 items-center justify-center rounded-full border border-red-500/20 bg-red-500/10">
                <Lock className="size-7 text-red-500" />
              </div>
              <h1 className="mb-2.5 text-[28px] font-extrabold tracking-tight text-(--text-1)">
                Final Exam Locked
              </h1>
              <p className="mx-auto max-w-[420px] text-[15px] leading-[1.65] text-(--text-3)">
                Complete all 6 module quizzes with 70%+ before taking the final exam.
              </p>
            </div>
            <div className="mb-6 rounded-[14px] border border-(--border) bg-white px-6 py-5">
              {ALL_MODULE_IDS.map((id) => {
                const done = passedModules.includes(id)
                return (
                  <div
                    key={id}
                    className="flex items-center gap-3 border-b border-black/5 py-2.5 last:border-b-0"
                  >
                    <div
                      className="flex size-7 shrink-0 items-center justify-center rounded-full border"
                      style={{
                        background: done ? 'rgba(16,185,129,0.12)' : 'rgba(0,0,0,0.05)',
                        borderColor: done ? 'rgba(16,185,129,0.3)' : 'rgba(0,0,0,0.1)',
                      }}
                    >
                      {done ? (
                        <Check className="size-[13px] text-emerald-500" />
                      ) : (
                        <X className="size-[13px] text-gray-300" />
                      )}
                    </div>
                    <span
                      className="text-sm"
                      style={{
                        color: done ? '#374151' : '#9CA3AF',
                        fontWeight: done ? 500 : 400,
                      }}
                    >
                      {MODULE_LABELS[id]}
                    </span>
                    <span
                      className="ml-auto text-[11px] font-semibold"
                      style={{ color: done ? '#10B981' : '#D1D5DB' }}
                    >
                      {done ? 'Passed' : 'Not yet'}
                    </span>
                  </div>
                )
              })}
            </div>
            <div className="text-center">
              <button
                className="cursor-pointer rounded-[20px] border border-black/9 bg-black/4 px-5 py-2.5 font-[inherit] text-[13px] font-medium text-(--text-3) transition-all duration-150 hover:bg-black/7 hover:text-(--text-2)"
                onClick={() => (window.location.href = '/academy')}
              >
                &larr; Return to Academy
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    )

  // ── Intro ──
  if (view === 'intro')
    return (
      <div className="flex h-screen bg-[#F9F9FB]">
        <Sidebar />
        <div className="ac-scroll flex flex-1 items-center justify-center overflow-y-auto px-6 py-10">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: EASE }}
            className="w-full max-w-[640px]"
          >
            <div className="mb-10 text-center">
              <div className="mx-auto mb-5 flex size-[72px] items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-500 shadow-[0_8px_32px_rgba(139,92,246,0.4)]">
                <Award className="size-[30px] text-white" />
              </div>
              <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.12em] text-violet-500">
                Lynq Academy
              </div>
              <h1 className="mb-3 text-[32px] font-extrabold tracking-tight text-(--text-1)">
                Final Certification Exam
              </h1>
              <p className="mx-auto max-w-[460px] text-[15px] leading-[1.65] text-(--text-3)">
                Complete all 50 questions to earn your certificate.
              </p>
            </div>

            <div className="mb-9 flex flex-wrap justify-center gap-2">
              {(
                [
                  ['50 Questions', false],
                  ['5 Sections', false],
                  ['~45 minutes', false],
                  ['80% to pass', true],
                ] as const
              ).map(([text, isGreen], i) => (
                <div
                  key={i}
                  className="flex items-center gap-1.5 rounded-[20px] border px-4 py-[7px]"
                  style={{
                    background: isGreen ? 'rgba(16,185,129,0.07)' : '#F5F5F5',
                    borderColor: isGreen ? 'rgba(16,185,129,0.18)' : 'rgba(0,0,0,0.08)',
                  }}
                >
                  <span
                    className="text-[13px] font-medium"
                    style={{ color: isGreen ? '#10B981' : '#555555' }}
                  >
                    {text}
                  </span>
                </div>
              ))}
            </div>

            <div className="mb-9 flex flex-col gap-2">
              {SECTION_META.map(({ label }: SectionMeta, i: number) => (
                <div
                  key={i}
                  className="flex items-center gap-3.5 rounded-[10px] border border-(--border) bg-white px-[18px] py-3.5 transition-colors duration-150 hover:bg-[#F9F8FF]"
                >
                  <div className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-black/8 bg-[#F5F5F5]">
                    <span className="text-xs font-bold text-[#555555]">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                  </div>
                  <div>
                    <div className="mb-[3px] text-[10px] font-bold uppercase tracking-[0.08em] text-(--text-4)">
                      Section {i + 1}
                    </div>
                    <div className="text-sm font-semibold text-(--text-1)">{label}</div>
                  </div>
                  <div className="ml-auto text-[11px] text-[#C4C4C4]">10 questions</div>
                </div>
              ))}
            </div>

            <div className="flex justify-center gap-3">
              <button
                className="cursor-pointer rounded-[20px] border border-black/9 bg-black/4 px-5 py-2.5 font-[inherit] text-[13px] font-medium text-(--text-3) transition-all duration-150 hover:bg-black/7 hover:text-(--text-2)"
                onClick={() => (window.location.href = '/academy')}
              >
                &larr; Back to Academy
              </button>
              <button
                onClick={() => {
                  setCurrentQ(0)
                  setAnswers({})
                  setView('exam')
                }}
                className="cursor-pointer rounded-lg border-none bg-(--text-1) px-7 py-[11px] font-[inherit] text-[13px] font-semibold text-white transition-opacity duration-150 hover:opacity-85"
              >
                Start Exam &rarr;
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    )

  // ── Results ──
  if (view === 'results' && scores) {
    const passed = scores.total >= 80
    const ringR = 70
    const rStroke = 8
    const rCirc = 2 * Math.PI * ringR

    return (
      <div className="relative flex h-screen overflow-hidden bg-[#F9F9FB]">
        <Sidebar />
        {passed &&
          CONFETTI.map((p, i) => (
            <div
              key={i}
              className="pointer-events-none fixed top-0"
              style={{
                left: p.left,
                width: p.size,
                height: p.size * 1.5,
                background: p.color,
                borderRadius: 2,
                animation: `confettiFall ${p.duration} ${p.delay} ease-in forwards`,
                zIndex: 999,
              }}
            />
          ))}
        <div className="ac-scroll flex flex-1 items-center justify-center overflow-y-auto px-6 py-10">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, ease: EASE }}
            className="w-full max-w-[600px] text-center"
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
                  animate={{ strokeDashoffset: rCirc - (scores.total / 100) * rCirc }}
                  transition={{ duration: 1.5, ease: 'easeOut', delay: 0.3 }}
                />
              </svg>
              <div className="absolute text-center">
                <div className="text-4xl font-extrabold text-(--text-1)">{scores.total}%</div>
                <div className="text-[11px] text-(--text-4)">total score</div>
              </div>
            </div>

            <h2 className="mb-2.5 text-[26px] font-extrabold tracking-tight text-(--text-1)">
              {passed ? 'Congratulations!' : 'Almost there!'}
            </h2>
            <p className="mx-auto mb-8 max-w-[440px] text-[15px] leading-[1.65] text-(--text-3)">
              {passed
                ? "You've earned your Lynq Academy certificate. Outstanding work!"
                : `You scored ${scores.total}%. You need 80% to pass. Review sections below 80% and retake when ready.`}
            </p>

            <div className="mb-7 rounded-[14px] border border-(--border) bg-white px-6 py-5 text-left">
              <div className="mb-4 text-xs font-bold uppercase tracking-[0.08em] text-(--text-4)">
                Section Scores
              </div>
              {SECTION_META.map(({ label, color }: SectionMeta, i: number) => {
                const s = scores.sections[i]
                return (
                  <div key={i} className="mb-3.5 last:mb-0">
                    <div className="mb-[5px] flex justify-between">
                      <span className="text-[13px] font-medium text-(--text-2)">{label}</span>
                      <span
                        className="text-[13px] font-bold"
                        style={{
                          color: s >= 80 ? '#10B981' : s >= 60 ? '#F59E0B' : '#EF4444',
                        }}
                      >
                        {s}%
                      </span>
                    </div>
                    <div className="h-1 overflow-hidden rounded-[10px] bg-black/7">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${s}%` }}
                        transition={{ duration: 1, ease: 'easeOut', delay: 0.5 + i * 0.1 }}
                        className="h-full rounded-[10px]"
                        style={{ background: color }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="flex flex-wrap justify-center gap-2.5">
              {passed ? (
                <>
                  <button
                    className="cursor-pointer rounded-[20px] border-none bg-gradient-to-br from-emerald-500 to-emerald-600 px-6 py-2.5 font-[inherit] text-[13px] font-semibold text-white shadow-[0_4px_16px_rgba(16,185,129,0.3)] transition-all duration-150 hover:-translate-y-px hover:brightness-110"
                    onClick={() => (window.location.href = '/academy/certificate')}
                  >
                    Claim Your Certificate &rarr;
                  </button>
                  <button
                    className="cursor-pointer rounded-[20px] border border-black/9 bg-black/4 px-5 py-2.5 font-[inherit] text-[13px] font-medium text-(--text-3) transition-all duration-150 hover:bg-black/7 hover:text-(--text-2)"
                    onClick={() => (window.location.href = '/academy')}
                  >
                    Back to Academy
                  </button>
                </>
              ) : (
                <>
                  <button
                    className="cursor-pointer rounded-[20px] border border-black/9 bg-black/4 px-5 py-2.5 font-[inherit] text-[13px] font-medium text-(--text-3) transition-all duration-150 hover:bg-black/7 hover:text-(--text-2)"
                    onClick={() => (window.location.href = '/academy')}
                  >
                    Back to Academy
                  </button>
                  <button
                    className="cursor-pointer rounded-[20px] border-none bg-gradient-to-br from-violet-500 to-indigo-500 px-6 py-2.5 font-[inherit] text-[13px] font-semibold text-white shadow-[0_4px_16px_rgba(99,102,241,0.3)] transition-all duration-150 hover:-translate-y-px hover:brightness-110"
                    onClick={() => {
                      setAnswers({})
                      setCurrentQ(0)
                      setScores(null)
                      setView('intro')
                    }}
                  >
                    Retake Exam
                  </button>
                </>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    )
  }

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
    <div className="flex h-screen bg-[#F9F9FB]">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Progress header */}
        <div className="flex h-[52px] shrink-0 items-center gap-4 border-b border-(--border) bg-white px-6">
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
          <span className="shrink-0 text-xs text-(--text-4)">Q{currentQ + 1}/50</span>
          <button
            className="cursor-pointer rounded-[20px] border border-black/9 bg-black/4 px-3.5 py-1.5 font-[inherit] text-xs font-medium text-(--text-3) transition-all duration-150 hover:bg-black/7 hover:text-(--text-2)"
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

        <div className="ac-scroll flex-1 overflow-y-auto">
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
                    <span className="text-[11px] text-(--text-4)">
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
                    className="mb-5 rounded-lg border border-violet-500/12 border-l-[3px] border-l-violet-500 bg-[#F9F8FF] px-5 py-4"
                  >
                    <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.1em] text-violet-500">
                      Case Study: {q.caseTitle}
                    </div>
                    <p className="text-sm leading-[1.75] text-(--text-2)">{q.caseContext}</p>
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
                <div className="mb-3.5 rounded-xl border border-(--border) bg-white px-7 py-6">
                  <h3 className="text-lg font-semibold leading-[1.5] text-(--text-1)">{q.q}</h3>
                </div>

                {/* Options */}
                {q.opts.map((opt, idx) => {
                  const sel = answers[currentQ] === idx
                  return (
                    <div
                      key={idx}
                      className={`fe-option ${sel ? 'selected' : ''}`}
                      onClick={() => setAnswers((prev) => ({ ...prev, [currentQ]: idx }))}
                    >
                      <div className="fe-radio">
                        {sel && <div className="size-2 rounded-full bg-white" />}
                      </div>
                      <span className="flex-1 text-sm text-(--text-1)">{opt}</span>
                    </div>
                  )
                })}

                {/* Navigation */}
                <div className="mt-5 flex items-center justify-between">
                  <button
                    className="cursor-pointer rounded-[20px] border border-black/9 bg-black/4 px-5 py-2.5 font-[inherit] text-[13px] font-medium text-(--text-3) transition-all duration-150 hover:bg-black/7 hover:text-(--text-2) disabled:opacity-35"
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
    </div>
  )
}
