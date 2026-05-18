'use client'

import { motion } from 'framer-motion'
import { CONFETTI, EASE, SECTION_META } from '@/lib/academy-constants'
import type { SectionMeta } from '@/types/academy'

interface ExamResultsViewProps {
  scores: { sections: number[]; total: number }
  passed: boolean
  onRetake: () => void
  onReturn: () => void
}

export function ExamResultsView({ scores, passed, onRetake, onReturn }: ExamResultsViewProps) {
  const ringR = 70
  const rStroke = 8
  const rCirc = 2 * Math.PI * ringR

  return (
      <div className="relative h-screen overflow-hidden bg-[#F9F9FB]">
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
      <div className="thin-scrollbar flex h-full items-center justify-center overflow-y-auto px-6 py-10">
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
              <div className="text-4xl font-extrabold text-foreground">{scores.total}%</div>
              <div className="text-[11px] text-foreground-4">total score</div>
            </div>
          </div>

          <h2 className="mb-2.5 text-[26px] font-extrabold tracking-tight text-foreground">
            {passed ? 'Congratulations!' : 'Almost there!'}
          </h2>
          <p className="mx-auto mb-8 max-w-[440px] text-[15px] leading-[1.65] text-muted-foreground">
            {passed
              ? "You've earned your Lynq Academy certificate. Outstanding work!"
              : `You scored ${scores.total}%. You need 80% to pass. Review sections below 80% and retake when ready.`}
          </p>

          <div className="mb-7 rounded-[14px] border border-border bg-white px-6 py-5 text-left">
            <div className="mb-4 text-xs font-bold uppercase tracking-[0.08em] text-foreground-4">
              Section Scores
            </div>
            {SECTION_META.map(({ label, color }: SectionMeta, i: number) => {
              const s = scores.sections[i]
              return (
                <div key={i} className="mb-3.5 last:mb-0">
                  <div className="mb-[5px] flex justify-between">
                    <span className="text-[13px] font-medium text-foreground-2">{label}</span>
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
                  className="cursor-pointer rounded-[20px] border border-black/9 bg-black/4 px-5 py-2.5 font-[inherit] text-[13px] font-medium text-muted-foreground transition-all duration-150 hover:bg-black/7 hover:text-foreground-2"
                  onClick={onReturn}
                >
                  Back to Academy
                </button>
              </>
            ) : (
              <>
                <button
                  className="cursor-pointer rounded-[20px] border border-black/9 bg-black/4 px-5 py-2.5 font-[inherit] text-[13px] font-medium text-muted-foreground transition-all duration-150 hover:bg-black/7 hover:text-foreground-2"
                  onClick={onReturn}
                >
                  Back to Academy
                </button>
                <button
                  className="cursor-pointer rounded-[20px] border-none bg-gradient-to-br from-violet-500 to-indigo-500 px-6 py-2.5 font-[inherit] text-[13px] font-semibold text-white shadow-[0_4px_16px_rgba(99,102,241,0.3)] transition-all duration-150 hover:-translate-y-px hover:brightness-110"
                  onClick={onRetake}
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
