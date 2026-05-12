'use client'

import { motion } from 'framer-motion'
import { Award } from 'lucide-react'
import { EASE, SECTION_META } from '@/lib/academy-constants'
import type { SectionMeta } from '@/types/academy'

interface ExamIntroViewProps {
  onStart: () => void
  onReturn: () => void
}

export function ExamIntroView({ onStart, onReturn }: ExamIntroViewProps) {
  return (
      <div className="thin-scrollbar flex h-screen items-center justify-center overflow-y-auto bg-[#F9F9FB] px-6 py-10">
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
            <h1 className="mb-3 text-[32px] font-extrabold tracking-tight text-foreground">
              Final Certification Exam
            </h1>
            <p className="mx-auto max-w-[460px] text-[15px] leading-[1.65] text-muted-foreground">
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
                className="flex items-center gap-3.5 rounded-[10px] border border-border bg-white px-[18px] py-3.5 transition-colors duration-150 hover:bg-background"
              >
                <div className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-black/8 bg-[#F5F5F5]">
                  <span className="text-xs font-bold text-[#555555]">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                </div>
                <div>
                  <div className="mb-[3px] text-[10px] font-bold uppercase tracking-[0.08em] text-foreground-4">
                    Section {i + 1}
                  </div>
                  <div className="text-sm font-semibold text-foreground">{label}</div>
                </div>
                <div className="ml-auto text-[11px] text-[#C4C4C4]">10 questions</div>
              </div>
            ))}
          </div>

          <div className="flex justify-center gap-3">
            <button
              className="cursor-pointer rounded-[20px] border border-black/9 bg-black/4 px-5 py-2.5 font-[inherit] text-[13px] font-medium text-muted-foreground transition-all duration-150 hover:bg-black/7 hover:text-foreground-2"
              onClick={onReturn}
            >
              &larr; Back to Academy
            </button>
            <button
              onClick={onStart}
              className="cursor-pointer rounded-lg border-none bg-foreground px-7 py-[11px] font-[inherit] text-[13px] font-semibold text-white transition-opacity duration-150 hover:opacity-85"
            >
              Start Exam &rarr;
            </button>
          </div>
        </motion.div>
      </div>
  )
}
