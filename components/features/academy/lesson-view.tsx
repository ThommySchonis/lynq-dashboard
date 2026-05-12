'use client'

import { motion } from 'framer-motion'
import { Check } from 'lucide-react'
import { EASE, readKey } from '@/lib/academy-constants'
import { QuizView } from './quiz-view'
import type { Module } from '@/types/academy'

interface LessonViewProps {
  mod: Module
  lessonIdx: number
  readMap: Record<string, boolean>
  passedTypes: string[]
  isAdmin: boolean
  onMarkRead: (idx: number) => void
  onBack: () => void
  onNext: () => void
  onPrev: () => void
  onStartQuiz: () => void
}

export function LessonView({
  mod,
  lessonIdx,
  readMap,
  passedTypes,
  isAdmin,
  onMarkRead,
  onBack,
  onNext,
  onPrev,
  onStartQuiz,
}: LessonViewProps) {
  const sec = mod.sections[lessonIdx]
  const isRead = !!readMap[readKey(mod.id, lessonIdx)]
  const isLast = lessonIdx === mod.sections.length - 1
  const allRead = mod.sections.every((_, i) => readMap[readKey(mod.id, i)]) || isAdmin
  const isDone = passedTypes.includes(mod.examType)

  // Quiz section -- render inline quiz instead of text content
  if (sec.type === 'quiz') {
    return (
      <div className="mx-auto max-w-[800px] px-6 py-8">
        <div className="mb-6">
          <div
            className="mb-1 text-xs font-semibold uppercase tracking-[0.08em]"
            style={{ color: mod.color }}
          >
            Knowledge Check
          </div>
          <h2 className="mb-2 text-2xl font-bold tracking-tight text-foreground">
            Test Your Knowledge
          </h2>
          <p className="text-sm text-muted-foreground">
            Answer all questions and score 70% or higher to complete this module.
          </p>
        </div>
        <QuizView mod={mod} onPass={() => onMarkRead(lessonIdx)} variant="inline" />
        <div className="mt-6">
          <button
            className="cursor-pointer rounded-[20px] border border-black/9 bg-black/4 px-5 py-2.5 font-[inherit] text-[13px] font-medium text-muted-foreground transition-all duration-150 hover:bg-black/7 hover:text-foreground-2"
            onClick={onBack}
          >
            &larr; Back to module
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[800px] px-6 py-8">
      {/* Progress bar */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
        <div className="mb-2.5 flex items-center justify-between">
          <span className="text-xs text-foreground-4">
            Lesson {lessonIdx + 1} of {mod.sections.length}
          </span>
          <span className="text-xs text-foreground-4">{mod.label}</span>
        </div>
        <div className="mb-7 h-[3px] overflow-hidden rounded-[10px] bg-black/8">
          <div
            className="h-full rounded-[10px] bg-gradient-to-r from-blue-500 to-indigo-500 transition-[width] duration-400 ease-out"
            style={{ width: `${((lessonIdx + 1) / mod.sections.length) * 100}%` }}
          />
        </div>
      </motion.div>

      {/* Title */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE }}
      >
        <h2 className="mb-6 text-[28px] font-bold leading-[1.25] tracking-tight text-foreground">
          {sec.title}
        </h2>
      </motion.div>

      {/* Content */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.5, ease: EASE }}
      >
        {sec.body?.split('\n').map(
          (para, pi) =>
            para.trim() &&
            (para.match(/^\d+\./) || para.match(/^P[1-3]/) ? (
              <div key={pi} className="mb-2.5 flex gap-2.5">
                <div className="mt-[9px] size-1.5 shrink-0 rounded-full bg-indigo-500" />
                <p className="text-base leading-[1.8] text-foreground-2">{para}</p>
              </div>
            ) : (
              <p key={pi} className="mb-4 text-base leading-[1.8] text-foreground-2">
                {para}
              </p>
            )),
        )}

        {/* Tips */}
        {sec.tips?.map((tip, ti) => (
          <div
            key={ti}
            className="mb-3 rounded-r-lg border-l-[3px] border-l-indigo-500 bg-indigo-500/5 px-[18px] py-3.5"
          >
            <span className="mr-2 text-[11px] font-bold uppercase tracking-[0.06em] text-indigo-500">
              TIP
            </span>
            <span className="text-[15px] text-foreground-2">{tip}</span>
          </div>
        ))}

        {/* Takeaways */}
        {sec.takeaways && (
          <div className="mb-5 rounded-[10px] border border-emerald-500/15 bg-emerald-500/6 px-5 py-[18px]">
            <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.07em] text-emerald-500">
              Key Takeaways
            </div>
            {sec.takeaways.map((t, ti) => (
              <div key={ti} className="mb-2 flex gap-2.5">
                <Check className="size-[13px] shrink-0 text-emerald-500" />
                <span className="text-sm leading-[1.55] text-foreground-2">{t}</span>
              </div>
            ))}
          </div>
        )}

        {/* Example */}
        {sec.example && (
          <div className="mb-5 rounded-[10px] border border-black/8 bg-black/3 p-[18px]">
            <div className="mb-2.5 text-[11px] font-bold uppercase tracking-[0.07em] text-foreground-4">
              Example
            </div>
            <pre className="whitespace-pre-wrap font-[inherit] text-[13px] leading-[1.7] text-foreground-2">
              {sec.example}
            </pre>
          </div>
        )}
      </motion.div>

      {/* Navigation */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.4 }}
        className="mt-8 flex flex-wrap items-center justify-between gap-3"
      >
        <button
          className="cursor-pointer rounded-[20px] border border-black/9 bg-black/4 px-5 py-2.5 font-[inherit] text-[13px] font-medium text-muted-foreground transition-all duration-150 hover:bg-black/7 hover:text-foreground-2 disabled:opacity-35"
          onClick={onPrev}
          disabled={lessonIdx === 0}
        >
          &larr; Previous
        </button>
        <div className="flex gap-2.5">
          {!isRead && (
            <button
              className="flex cursor-pointer items-center gap-[7px] rounded-[20px] border border-emerald-500/30 bg-emerald-500/12 px-5 py-2.5 font-[inherit] text-[13px] font-semibold text-emerald-500 transition-all duration-150 hover:bg-emerald-500/20"
              onClick={() => onMarkRead(lessonIdx)}
            >
              <Check className="size-[13px]" /> Mark as complete
            </button>
          )}
          {isLast && allRead && !isDone ? (
            <button
              className="cursor-pointer rounded-[20px] border-none bg-gradient-to-br from-violet-500 to-indigo-500 px-6 py-2.5 font-[inherit] text-[13px] font-semibold text-white shadow-[0_4px_16px_rgba(99,102,241,0.3)] transition-all duration-150 hover:-translate-y-px hover:brightness-110"
              onClick={onStartQuiz}
            >
              Take the quiz &rarr;
            </button>
          ) : isLast ? null : (
            <button
              className="cursor-pointer rounded-[20px] border-none bg-gradient-to-br from-violet-500 to-indigo-500 px-6 py-2.5 font-[inherit] text-[13px] font-semibold text-white shadow-[0_4px_16px_rgba(99,102,241,0.3)] transition-all duration-150 hover:-translate-y-px hover:brightness-110"
              onClick={onNext}
            >
              Next lesson &rarr;
            </button>
          )}
          {isLast && isDone && (
            <button
              className="cursor-pointer rounded-[20px] border border-black/9 bg-black/4 px-5 py-2.5 font-[inherit] text-[13px] font-medium text-muted-foreground transition-all duration-150 hover:bg-black/7 hover:text-foreground-2"
              onClick={onBack}
            >
              Back to module
            </button>
          )}
        </div>
      </motion.div>
    </div>
  )
}
