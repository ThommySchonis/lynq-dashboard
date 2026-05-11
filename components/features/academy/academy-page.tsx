'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronRight, Award } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Sidebar } from '@/components/layout/sidebar'
import { MODULES, EASE, readKey } from '@/lib/academy-constants'
import { useAcademyUI } from '@/stores/academy-ui'
import { AcademySidebar } from './academy-sidebar'
import { AcademyTopbar } from './academy-topbar'
import { WelcomeView } from './welcome-view'
import { ModuleView } from './module-view'
import { LessonView } from './lesson-view'
import { QuizView } from './quiz-view'
import { CertificateView } from './certificate-view'
import type { Module } from '@/types/academy'

export function AcademyPage() {
  const [session, setSession] = useState<Record<string, unknown> | null>(null)
  const [userName, setUserName] = useState('')
  const [mounted, setMounted] = useState(false)
  const isAdmin = (session?.user as Record<string, unknown> | undefined)?.email === 'info@lynqagency.com'
  const [passedTypes, setPassedTypes] = useState<string[]>([])
  const [readMap, setReadMap] = useState<Record<string, boolean>>({})

  const { view, selectedModuleId, selectedLesson, setView, selectModule, selectLesson, reset } =
    useAcademyUI()

  const selectedModule = MODULES.find((m) => m.id === selectedModuleId) ?? null

  useEffect(() => {
    setMounted(true)
    // Load localStorage read state
    const map: Record<string, boolean> = {}
    MODULES.forEach((mod) =>
      mod.sections.forEach((_, i) => {
        const k = readKey(mod.id, i)
        if (localStorage.getItem(k) === '1') map[k] = true
      }),
    )
    setReadMap(map)

    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
      if (!s) {
        window.location.href = '/login'
        return
      }
      setSession(s as unknown as Record<string, unknown>)
      const meta = (s.user.user_metadata || {}) as Record<string, string>
      const raw = (s.user.email || '').split('@')[0]
      setUserName(meta.full_name || meta.name || raw.charAt(0).toUpperCase() + raw.slice(1))

      const resultRes = await fetch('/api/exams/result', {
        headers: { Authorization: `Bearer ${s.access_token}` },
      })
      const resultData = await resultRes.json()
      const submissions = (resultData.submissions || resultData || []) as Array<{
        passed: boolean
        exam_type: string
      }>
      const passed = [...new Set(submissions.filter((s) => s.passed).map((s) => s.exam_type))]
      setPassedTypes(passed)
    })
  }, [])

  const markRead = useCallback(
    (moduleId: string, lessonIdx: number) => {
      const k = readKey(moduleId, lessonIdx)
      localStorage.setItem(k, '1')
      setReadMap((prev) => ({ ...prev, [k]: true }))
      // If this was the Knowledge Check (last section = quiz), add module's examType to passedTypes
      const mod = MODULES.find((m) => m.id === moduleId)
      if (mod && lessonIdx === mod.sections.length - 1 && mod.sections[lessonIdx]?.type === 'quiz') {
        setPassedTypes((prev) => (prev.includes(mod.examType) ? prev : [...prev, mod.examType]))
      }
    },
    [],
  )

  function handleSelectModule(mod: Module) {
    selectModule(mod.id)
  }

  function handleSelectLesson(idx: number) {
    selectLesson(idx)
  }

  const handleQuizComplete = useCallback(() => {
    if (session) {
      const s = session as unknown as { access_token: string }
      fetch('/api/exams/result', { headers: { Authorization: `Bearer ${s.access_token}` } })
        .then((r) => r.json())
        .then((data) => {
          const submissions = (data.submissions || data || []) as Array<{
            passed: boolean
            exam_type: string
          }>
          const passed = [...new Set(submissions.filter((s) => s.passed).map((s) => s.exam_type))]
          setPassedTypes(passed)
        })
    }
    const allPassed = MODULES.every((m) =>
      [...passedTypes, selectedModule?.examType].includes(m.examType),
    )
    setView(allPassed ? 'certificate' : 'module')
  }, [session, passedTypes, selectedModule, setView])

  if (!mounted) return null

  const allDone = MODULES.every((m) => passedTypes.includes(m.examType))

  return (
    <div className="flex h-screen overflow-hidden bg-[#F9F9FB]">
      <Sidebar />

      <AcademySidebar passedTypes={passedTypes} readMap={readMap} isAdmin={isAdmin} />

      {/* Main area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <AcademyTopbar
          view={view}
          selectedModule={selectedModule}
          selectedLesson={selectedLesson}
          passedTypes={passedTypes}
          userName={userName}
          onGoWelcome={() => setView('welcome')}
          onGoModule={() => setView('module')}
        />

        <div className="ac-scroll flex-1 overflow-y-auto">
          <AnimatePresence mode="wait">
            {view === 'welcome' && (
              <motion.div
                key="welcome"
                className="flex h-full flex-1"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
              >
                <WelcomeView
                  passedTypes={passedTypes}
                  onSelectModule={handleSelectModule}
                  onViewCertificate={() => setView('certificate')}
                />
              </motion.div>
            )}
            {view === 'module' && selectedModule && (
              <motion.div
                key="module"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3, ease: EASE }}
              >
                <ModuleView
                  mod={selectedModule}
                  passedTypes={passedTypes}
                  readMap={readMap}
                  onSelectLesson={handleSelectLesson}
                  onStartQuiz={() => setView('quiz')}
                  onBack={() => setView('welcome')}
                  isAdmin={isAdmin}
                />
              </motion.div>
            )}
            {view === 'lesson' && selectedModule && (
              <motion.div
                key={`lesson-${selectedLesson}`}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3, ease: EASE }}
              >
                <LessonView
                  mod={selectedModule}
                  lessonIdx={selectedLesson}
                  readMap={readMap}
                  passedTypes={passedTypes}
                  isAdmin={isAdmin}
                  onMarkRead={(idx) => markRead(selectedModule.id, idx)}
                  onBack={() => setView('module')}
                  onNext={() => {
                    const next = selectedLesson + 1
                    if (next < selectedModule.sections.length) {
                      selectLesson(next)
                    } else {
                      setView('module')
                    }
                  }}
                  onPrev={() => {
                    if (selectedLesson > 0) selectLesson(selectedLesson - 1)
                  }}
                  onStartQuiz={() => setView('quiz')}
                />
              </motion.div>
            )}
            {view === 'quiz' && selectedModule && session && (
              <motion.div
                key="quiz"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3, ease: EASE }}
              >
                <QuizView
                  mod={selectedModule}
                  onBack={() => setView('module')}
                  onComplete={handleQuizComplete}
                  variant="standalone"
                />
              </motion.div>
            )}
            {view === 'certificate' && (
              <motion.div
                key="certificate"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4 }}
              >
                <CertificateView
                  userName={userName}
                  passedTypes={passedTypes}
                  onBack={() => setView('welcome')}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Certificate banner when all done */}
        {allDone && view === 'welcome' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8, duration: 0.4 }}
            onClick={() => setView('certificate')}
            className="mx-6 mb-5 flex cursor-pointer items-center gap-3 rounded-[10px] border border-violet-500/30 bg-gradient-to-br from-violet-500/20 to-indigo-500/15 px-5 py-3.5 backdrop-blur-[10px]"
          >
            <div className="flex size-8 items-center justify-center rounded-full bg-violet-500/20">
              <Award className="size-3.5 text-violet-500" />
            </div>
            <div className="flex-1">
              <div className="text-[13px] font-semibold text-(--text-1)">
                All modules completed!
              </div>
              <div className="mt-0.5 text-xs text-(--text-3)">
                Click to view and download your certificate
              </div>
            </div>
            <ChevronRight className="size-3.5 text-black/30" />
          </motion.div>
        )}
      </div>
    </div>
  )
}
