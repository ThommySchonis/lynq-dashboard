'use client'

import { motion } from 'framer-motion'
import { Lock, Check, X } from 'lucide-react'
import { EASE, ALL_MODULE_IDS, MODULE_LABELS } from '@/lib/academy-constants'

interface ExamLockedViewProps {
  passedModules: string[]
  onReturn: () => void
}

export function ExamLockedView({ passedModules, onReturn }: ExamLockedViewProps) {
  return (
      <div className="ac-scroll flex h-screen items-center justify-center overflow-y-auto bg-[#F9F9FB] px-6 py-10">
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
              onClick={onReturn}
            >
              &larr; Return to Academy
            </button>
          </div>
        </motion.div>
      </div>
  )
}
