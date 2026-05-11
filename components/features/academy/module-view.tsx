'use client'

import { motion } from 'framer-motion'
import { Check, ChevronRight, Lock, Play, Zap } from 'lucide-react'
import { EASE, readKey } from '@/lib/academy-constants'
import type { Module } from '@/types/academy'

interface ModuleViewProps {
  mod: Module
  passedTypes: string[]
  readMap: Record<string, boolean>
  onSelectLesson: (idx: number) => void
  onStartQuiz: () => void
  onBack: () => void
  isAdmin: boolean
}

export function ModuleView({
  mod,
  passedTypes,
  readMap,
  onSelectLesson,
  onStartQuiz,
  onBack,
  isAdmin,
}: ModuleViewProps) {
  const isDone = passedTypes.includes(mod.examType)
  const readCount = mod.sections.filter((_, i) => readMap[readKey(mod.id, i)]).length
  const allRead = readCount === mod.sections.length || isAdmin
  const pct = Math.round((readCount / mod.sections.length) * 100)
  const r = 36
  const stroke = 5
  const circ = 2 * Math.PI * r
  const offset = circ - (pct / 100) * circ

  return (
    <div className="mx-auto max-w-[800px] px-6 py-8">
      {/* Module header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE }}
        className="mb-6 flex items-center justify-between gap-5 rounded-xl border border-violet-500/12 bg-violet-500/5 p-6"
      >
        <div>
          <div
            className="mb-2.5 text-[10px] font-bold uppercase tracking-[0.1em]"
            style={{ color: mod.color }}
          >
            Module {mod.num}
          </div>
          <h2 className="mb-2 text-2xl font-bold tracking-tight text-(--text-1)">{mod.label}</h2>
          <p className="text-sm leading-relaxed text-(--text-3)">{mod.description}</p>
          <div className="mt-3.5 flex gap-4">
            <span className="text-xs text-(--text-4)">{mod.sections.length} lessons</span>
            {isDone && (
              <span className="text-xs font-semibold text-emerald-500">
                <Check className="mr-1 inline size-3" />
                Completed
              </span>
            )}
          </div>
        </div>
        {/* Progress ring */}
        <div className="relative shrink-0">
          <svg
            width={82}
            height={82}
            viewBox={`0 0 ${r * 2 + stroke} ${r * 2 + stroke}`}
            style={{ transform: 'rotate(-90deg)' }}
          >
            <circle
              cx={r + stroke / 2}
              cy={r + stroke / 2}
              r={r}
              fill="none"
              stroke="rgba(0,0,0,0.08)"
              strokeWidth={stroke}
            />
            <circle
              cx={r + stroke / 2}
              cy={r + stroke / 2}
              r={r}
              fill="none"
              stroke={isDone ? '#10B981' : mod.color}
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={circ}
              strokeDashoffset={offset}
              style={{ transition: 'stroke-dashoffset 0.8s ease' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-lg font-bold text-(--text-1)">
              {isDone ? <Check className="size-5 text-emerald-500" /> : `${pct}%`}
            </span>
          </div>
        </div>
      </motion.div>

      {/* Lessons list */}
      <div>
        {mod.sections.map((sec, i) => {
          const isRead = !!readMap[readKey(mod.id, i)]
          return (
            <motion.div
              key={i}
              className="ac-lesson-row"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.06, duration: 0.4, ease: EASE }}
              onClick={() => onSelectLesson(i)}
            >
              <div
                className="flex size-[34px] shrink-0 items-center justify-center rounded-full border"
                style={{
                  background: isRead ? 'rgba(16,185,129,0.15)' : 'rgba(99,102,241,0.12)',
                  borderColor: isRead ? 'rgba(16,185,129,0.3)' : 'rgba(99,102,241,0.25)',
                }}
              >
                {isRead ? (
                  <Check className="size-3.5 text-emerald-500" />
                ) : (
                  <Play className="size-3 fill-indigo-500 text-indigo-500" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="mb-[3px] text-sm font-medium text-(--text-1)">{sec.title}</div>
                <div className="flex gap-2">
                  <span className="rounded border border-blue-500/20 bg-blue-500/10 px-1.5 py-px text-[11px] font-semibold text-blue-400">
                    TEXT
                  </span>
                  {isRead && <span className="text-[11px] text-(--text-4)">Completed</span>}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-xs text-(--text-4)">{sec.mins} min</span>
                <ChevronRight className="size-3.5 text-black/20" />
              </div>
            </motion.div>
          )
        })}

        {/* Quiz row */}
        <motion.div
          className="ac-lesson-row"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            delay: 0.1 + mod.sections.length * 0.06,
            duration: 0.4,
            ease: EASE,
          }}
          onClick={allRead && !isDone ? onStartQuiz : undefined}
          style={{
            opacity: allRead || isDone ? 1 : 0.4,
            cursor: allRead || isDone ? 'pointer' : 'default',
          }}
        >
          <div
            className="flex size-[34px] shrink-0 items-center justify-center rounded-full border"
            style={{
              background: isDone ? 'rgba(16,185,129,0.15)' : 'rgba(139,92,246,0.15)',
              borderColor: isDone ? 'rgba(16,185,129,0.3)' : 'rgba(139,92,246,0.3)',
            }}
          >
            {isDone ? (
              <Check className="size-3.5 text-emerald-500" />
            ) : (
              <Zap className="size-[13px] text-violet-500" strokeWidth={2.2} />
            )}
          </div>
          <div className="flex-1">
            <div className="mb-[3px] text-sm font-medium text-(--text-1)">Module Quiz</div>
            <div className="flex gap-2">
              <span className="rounded border border-violet-500/20 bg-violet-500/10 px-1.5 py-px text-[11px] font-semibold text-[#A175FC]">
                QUIZ
              </span>
              {!allRead && !isDone && (
                <span className="text-[11px] text-(--text-4)">Read all lessons to unlock</span>
              )}
              {isDone && <span className="text-[11px] text-emerald-500">Passed</span>}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {!allRead && !isDone && <Lock className="size-[13px] text-black/30" />}
            {(allRead || isDone) && <ChevronRight className="size-3.5 text-black/20" />}
          </div>
        </motion.div>
      </div>
    </div>
  )
}
