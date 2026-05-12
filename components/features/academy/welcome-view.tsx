'use client'

import { motion } from 'framer-motion'
import { BarChart3, Clock, Check, GraduationCap } from 'lucide-react'
import { MODULES, EASE } from '@/lib/academy-constants'
import type { Module } from '@/types/academy'

interface WelcomeViewProps {
  passedTypes: string[]
  onSelectModule: (mod: Module) => void
  onViewCertificate: () => void
}

export function WelcomeView({ passedTypes, onSelectModule, onViewCertificate }: WelcomeViewProps) {
  const completed = MODULES.filter((m) => passedTypes.includes(m.examType)).length
  const allDone = completed === MODULES.length

  return (
    <div className="relative flex flex-1 items-center justify-center overflow-hidden px-6 py-10">
      {/* Orbs */}
      <motion.div
        animate={{ x: [0, 40, -30, 0], y: [0, -50, 30, 0] }}
        transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
        className="pointer-events-none absolute -right-[5%] -top-[15%] size-[600px] rounded-full opacity-50 blur-[80px]"
        style={{ background: 'radial-gradient(circle,rgba(139,92,246,0.10),transparent 70%)' }}
      />
      <motion.div
        animate={{ x: [0, -40, 20, 0], y: [0, 40, -20, 0] }}
        transition={{ duration: 25, repeat: Infinity, ease: 'easeInOut' }}
        className="pointer-events-none absolute -bottom-[10%] -left-[5%] size-[550px] rounded-full opacity-50 blur-[80px]"
        style={{ background: 'radial-gradient(circle,rgba(99,102,241,0.08),transparent 70%)' }}
      />
      <motion.div
        animate={{ x: [0, 20, -15, 0], y: [0, -20, 15, 0] }}
        transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
        className="pointer-events-none absolute left-[20%] top-[30%] size-[400px] rounded-full opacity-50 blur-[80px]"
        style={{ background: 'radial-gradient(circle,rgba(99,102,241,0.06),transparent 70%)' }}
      />

      {/* Content */}
      <div className="relative z-[1] flex max-w-[620px] flex-col items-center text-center">
        {/* Spinning icon */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: EASE }}
          className="relative mb-7 size-[100px]"
        >
          <div className="absolute inset-0 rounded-full border-2 border-violet-500/30 border-t-violet-500 animate-[ac-spin_3s_linear_infinite]" />
          <div className="absolute inset-2 flex items-center justify-center rounded-full border border-violet-500/25 bg-violet-500/12 backdrop-blur-[10px]">
            <GraduationCap className="size-8 text-violet-500" strokeWidth={1.8} />
          </div>
        </motion.div>

        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.5, ease: EASE }}
          className="mb-[18px] inline-block rounded-[20px] border border-violet-500/15 bg-violet-500/8 px-3.5 py-1"
        >
          <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-violet-700">
            Lynq Academy
          </span>
        </motion.div>

        {/* Title */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.6, ease: EASE }}
        >
          <h1 className="mb-0 text-[clamp(36px,5vw,52px)] font-extrabold leading-[1.08] tracking-[-0.03em] text-foreground">
            Master E-commerce
          </h1>
          <h1 className="mb-[18px] bg-gradient-to-br from-violet-500 via-indigo-500 to-blue-500 bg-clip-text text-[clamp(36px,5vw,52px)] font-extrabold leading-[1.08] tracking-[-0.03em] text-transparent">
            Operations
          </h1>
        </motion.div>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.22, duration: 0.5, ease: EASE }}
          className="mb-7 max-w-[440px] text-base leading-[1.65] text-muted-foreground"
        >
          Your complete training program for e-commerce customer service and backend operations.
        </motion.p>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5, ease: EASE }}
          className="mb-7 flex flex-wrap justify-center gap-2.5"
        >
          {[
            { icon: BarChart3, text: '6 Modules' },
            { icon: Clock, text: '~4 Hours' },
            { icon: Check, text: 'Certificate' },
          ].map(({ icon: Icon, text }, i) => (
            <div
              key={i}
              className="flex items-center gap-[7px] rounded-[20px] border border-black/8 bg-[#F5F5F5] px-4 py-2"
            >
              <Icon className="size-3.5 text-foreground-4" />
              <span className="text-[13px] font-medium text-[#555555]">{text}</span>
            </div>
          ))}
        </motion.div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.38, duration: 0.5, ease: EASE }}
        >
          <button
            className="cursor-pointer rounded-[10px] border-none bg-gradient-to-br from-violet-500 to-indigo-500 px-7 py-3 font-[inherit] text-sm font-semibold text-white shadow-[0_4px_20px_rgba(139,92,246,0.4)] transition-all duration-150 hover:-translate-y-px hover:brightness-110 hover:shadow-[0_8px_28px_rgba(139,92,246,0.5)]"
            onClick={() => onSelectModule(MODULES[0])}
          >
            {completed > 0 ? 'Continue Learning \u2192' : 'Start Learning \u2192'}
          </button>
        </motion.div>

        {/* Module pills */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.55, duration: 0.6 }}
          className="mt-8 flex flex-wrap justify-center gap-2"
        >
          {MODULES.map((mod, i) => {
            const done = passedTypes.includes(mod.examType)
            return (
              <motion.div
                key={mod.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.55 + i * 0.06 }}
                onClick={() => onSelectModule(mod)}
                className="flex cursor-pointer items-center gap-[7px] rounded-[20px] border bg-[#F5F5F5] px-3.5 py-1.5 transition-all duration-150 hover:bg-black/6"
                style={{ borderColor: done ? mod.color + '40' : 'rgba(0,0,0,0.08)' }}
              >
                <div
                  className="size-[7px] shrink-0 rounded-full"
                  style={{ background: done ? '#10B981' : mod.color }}
                />
                <span className="text-xs font-medium text-[#555555]">{mod.label}</span>
                {done && <Check className="size-[11px] text-emerald-500" />}
              </motion.div>
            )
          })}
        </motion.div>

        {allDone && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
            className="mt-5"
          >
            <button
              className="cursor-pointer rounded-[20px] border-none bg-gradient-to-br from-emerald-500 to-emerald-600 px-[22px] py-2.5 font-[inherit] text-[13px] font-semibold text-white shadow-[0_4px_16px_rgba(16,185,129,0.3)] transition-all duration-150 hover:-translate-y-px hover:brightness-110"
              onClick={onViewCertificate}
            >
              View Certificate &rarr;
            </button>
          </motion.div>
        )}
      </div>
    </div>
  )
}
