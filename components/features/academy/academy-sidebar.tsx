'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { Check, Lock, GraduationCap, Award } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MODULES, EASE, readKey } from '@/lib/academy-constants'
import { useAcademyUI } from '@/stores/academy-ui'
import type { Module } from '@/types/academy'

interface AcademySidebarProps {
  passedTypes: string[]
  readMap: Record<string, boolean>
  isAdmin: boolean
}

export function AcademySidebar({ passedTypes, readMap, isAdmin }: AcademySidebarProps) {
  const { view, selectedModuleId, selectedLesson, setView, selectModule, selectLesson } = useAcademyUI()

  const allDone = MODULES.every((m) => passedTypes.includes(m.examType))
  const completedCnt = MODULES.filter((m) => passedTypes.includes(m.examType)).length
  const progressPct = Math.round((completedCnt / MODULES.length) * 100)

  function handleSelectModule(mod: Module) {
    selectModule(mod.id)
  }

  function handleSelectLesson(idx: number) {
    selectLesson(idx)
  }

  return (
    <div className="flex h-screen w-[280px] min-w-[280px] shrink-0 flex-col overflow-hidden border-r border-border bg-white">
      {/* Header */}
      <div className="shrink-0 border-b border-border px-4 pb-3.5 pt-[18px]">
        <div
          onClick={() => setView('welcome')}
          className="mb-3.5 flex cursor-pointer items-center gap-2.5"
        >
          <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-indigo-500 shadow-[0_2px_8px_rgba(139,92,246,0.4)]">
            <GraduationCap className="size-3.5 text-white" />
          </div>
          <span className="text-sm font-semibold text-foreground">Lynq Academy</span>
        </div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[11px] text-foreground-4">
            {completedCnt} of {MODULES.length} modules complete
          </span>
          <span className="text-xs font-semibold text-violet-500">{progressPct}%</span>
        </div>
        <div className="h-[3px] overflow-hidden rounded-[10px] bg-black/8">
          <div
            className="h-full rounded-[10px] bg-gradient-to-r from-violet-500 to-indigo-500 transition-[width] duration-600 ease-out"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Module nav */}
      <div className="thin-scrollbar flex-1 overflow-y-auto p-2">
        {MODULES.map((mod, mi) => {
          const isDone = passedTypes.includes(mod.examType)
          const isActive = selectedModuleId === mod.id
          const readCount = mod.sections.filter((_, si) => readMap[readKey(mod.id, si)]).length
          return (
            <motion.div
              key={mod.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: mi * 0.04, duration: 0.3, ease: EASE }}
            >
              <div
                className={cn(
                  'relative flex cursor-pointer items-center gap-2.5 rounded-lg border-l-2 border-l-transparent px-3.5 py-[9px] transition-all duration-150 hover:bg-black/[0.03]',
                  isActive && 'border-l-[#8B5CF6] bg-[rgba(139,92,246,0.08)]',
                  isDone && 'opacity-55',
                )}
                onClick={() => handleSelectModule(mod)}
              >
                {isDone ? (
                  <Check className="size-4 text-emerald-500" />
                ) : (
                  <div
                    className="flex size-[22px] shrink-0 items-center justify-center rounded-md"
                    style={{
                      background: isActive
                        ? 'linear-gradient(135deg,#8B5CF6,#6366F1)'
                        : 'rgba(0,0,0,0.06)',
                    }}
                  >
                    <span
                      className="text-[10px] font-bold"
                      style={{ color: isActive ? '#FFF' : '#9CA3AF' }}
                    >
                      {mod.num}
                    </span>
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div
                    className="overflow-hidden text-ellipsis whitespace-nowrap text-[13px]"
                    style={{
                      fontWeight: isActive ? 600 : 400,
                      color: isDone ? '#9CA3AF' : isActive ? '#0F0F10' : '#6B7280',
                      textDecoration: isDone ? 'line-through' : 'none',
                    }}
                  >
                    {mod.label}
                  </div>
                  <div className="mt-px text-[11px] text-foreground-4">
                    {readCount}/{mod.sections.length} lessons
                  </div>
                </div>
              </div>
              <AnimatePresence>
                {isActive && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: EASE }}
                    className="overflow-hidden"
                  >
                    {mod.sections.map((sec, si) => {
                      const isRead = !!readMap[readKey(mod.id, si)]
                      const isLessonActive = selectedLesson === si && view === 'lesson'
                      return (
                        <div
                          key={si}
                          className={cn(
                            'flex cursor-pointer items-center gap-2 rounded-md py-1.5 pl-[42px] pr-3.5 text-xs text-[#9CA3AF] transition-all duration-[120ms] hover:bg-black/[0.03] hover:text-[#374151]',
                            isLessonActive && 'text-[#0F0F10]',
                            isRead && 'text-[#6B7280]',
                          )}
                          onClick={() => handleSelectLesson(si)}
                        >
                          <div
                            className="size-1.5 shrink-0 rounded-full"
                            style={{
                              background: isRead
                                ? '#10B981'
                                : isLessonActive
                                  ? '#6366F1'
                                  : 'rgba(0,0,0,0.15)',
                            }}
                          />
                          <span className="overflow-hidden text-ellipsis whitespace-nowrap">
                            {sec.title}
                          </span>
                        </div>
                      )
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )
        })}
      </div>

      {/* Final Exam CTA */}
      <div className="shrink-0 border-t border-border px-2 pb-3.5 pt-3">
        {allDone || isAdmin ? (
          <button
            onClick={() => (window.location.href = '/academy/final-exam')}
            className="flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-[10px] border-none bg-gradient-to-br from-violet-500 to-indigo-500 font-[inherit] text-[13px] font-semibold text-white shadow-[0_4px_12px_rgba(139,92,246,0.3)] transition-[filter] duration-150 hover:brightness-110"
          >
            <Award className="size-[15px]" />
            Take Final Exam
          </button>
        ) : (
          <div>
            <button
              disabled
              className="flex h-11 w-full cursor-not-allowed items-center justify-center gap-2 rounded-[10px] border border-black/8 bg-black/5 font-[inherit] text-[13px] font-semibold text-foreground-4"
            >
              <Lock className="size-3.5" />
              Complete all modules first
            </button>
            <div className="mt-2">
              {MODULES.filter((m) => !passedTypes.includes(m.examType)).map((m) => (
                <div
                  key={m.id}
                  className="flex items-center gap-[5px] px-1 py-0.5 text-[10px] text-foreground-4"
                >
                  <div className="size-1 shrink-0 rounded-full bg-black/18" />
                  {m.label}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
