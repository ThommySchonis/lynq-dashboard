'use client'

import { MODULES } from '@/lib/academy-constants'
import type { AcademyView, Module } from '@/types/academy'

interface AcademyTopbarProps {
  view: AcademyView
  selectedModule: Module | null
  selectedLesson: number
  passedTypes: string[]
  userName: string
  onGoWelcome: () => void
  onGoModule: () => void
}

export function AcademyTopbar({
  view,
  selectedModule,
  selectedLesson,
  passedTypes,
  userName,
  onGoWelcome,
  onGoModule,
}: AcademyTopbarProps) {
  const completed = MODULES.filter((m) => passedTypes.includes(m.examType)).length
  const pct = Math.round((completed / MODULES.length) * 100)

  const breadcrumb = () => {
    if (view === 'welcome') return null
    if (view === 'module')
      return (
        <>
          <span
            onClick={onGoWelcome}
            className="cursor-pointer text-(--text-3) transition-colors duration-100 hover:text-(--text-2)"
          >
            Academy
          </span>
          <span className="mx-1.5 text-black/20">&rsaquo;</span>
          <span className="font-medium text-(--text-1)">{selectedModule?.label}</span>
        </>
      )
    if (view === 'lesson')
      return (
        <>
          <span onClick={onGoWelcome} className="cursor-pointer text-(--text-3) hover:text-(--text-2)">
            Academy
          </span>
          <span className="mx-1.5 text-black/20">&rsaquo;</span>
          <span onClick={onGoModule} className="cursor-pointer text-(--text-3) hover:text-(--text-2)">
            {selectedModule?.label}
          </span>
          <span className="mx-1.5 text-black/20">&rsaquo;</span>
          <span className="font-medium text-(--text-1)">
            {selectedModule?.sections[selectedLesson]?.title}
          </span>
        </>
      )
    if (view === 'quiz')
      return (
        <>
          <span onClick={onGoWelcome} className="cursor-pointer text-(--text-3) hover:text-(--text-2)">
            Academy
          </span>
          <span className="mx-1.5 text-black/20">&rsaquo;</span>
          <span onClick={onGoModule} className="cursor-pointer text-(--text-3) hover:text-(--text-2)">
            {selectedModule?.label}
          </span>
          <span className="mx-1.5 text-black/20">&rsaquo;</span>
          <span className="font-medium text-(--text-1)">Quiz</span>
        </>
      )
    if (view === 'certificate')
      return (
        <>
          <span onClick={onGoWelcome} className="cursor-pointer text-(--text-3) hover:text-(--text-2)">
            Academy
          </span>
          <span className="mx-1.5 text-black/20">&rsaquo;</span>
          <span className="font-medium text-(--text-1)">Certificate</span>
        </>
      )
    return null
  }

  return (
    <div className="flex h-[52px] shrink-0 items-center gap-4 border-b border-(--border) bg-white px-6">
      <div className="flex flex-1 items-center text-[13px]">{breadcrumb()}</div>
      <div className="flex items-center gap-2.5">
        <div className="rounded-[20px] border border-violet-500/30 bg-violet-500/15 px-3 py-1 text-xs font-semibold text-[#A175FC]">
          {pct}% complete
        </div>
        {userName && (
          <div className="flex size-[30px] shrink-0 items-center justify-center rounded-full border border-black/10 bg-gradient-to-br from-violet-500 to-indigo-500 text-xs font-bold text-white">
            {userName.charAt(0).toUpperCase()}
          </div>
        )}
      </div>
    </div>
  )
}
