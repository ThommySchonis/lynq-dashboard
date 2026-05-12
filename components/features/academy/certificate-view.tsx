'use client'

import { motion } from 'framer-motion'
import { Check, Award } from 'lucide-react'
import { MODULES, EASE } from '@/lib/academy-constants'

interface CertificateViewProps {
  userName: string
  passedTypes: string[]
  onBack: () => void
}

export function CertificateView({ userName, passedTypes, onBack }: CertificateViewProps) {
  const today = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <div className="px-6 py-8">
      <button
        className="mb-6 cursor-pointer rounded-[20px] border border-black/9 bg-black/4 px-5 py-2.5 font-[inherit] text-xs font-medium text-muted-foreground transition-all duration-150 hover:bg-black/7 hover:text-foreground-2"
        onClick={onBack}
      >
        &larr; Academy
      </button>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: EASE }}
      >
        <div className="relative mx-auto max-w-[720px] overflow-hidden rounded-2xl border border-border bg-white p-12 text-center">
          {/* Decorative */}
          <div
            className="pointer-events-none absolute inset-0 opacity-40"
            style={{
              backgroundImage: 'radial-gradient(circle,rgba(0,0,0,0.06) 1px,transparent 1px)',
              backgroundSize: '28px 28px',
            }}
          />
          <div
            className="pointer-events-none absolute -left-[60px] -top-[60px] size-[200px] rounded-full"
            style={{ background: 'radial-gradient(circle,rgba(139,92,246,0.18),transparent 70%)' }}
          />
          <div
            className="pointer-events-none absolute -bottom-[60px] -right-[60px] size-[200px] rounded-full"
            style={{ background: 'radial-gradient(circle,rgba(99,102,241,0.14),transparent 70%)' }}
          />

          <div className="relative z-[1]">
            {/* Logo */}
            <div className="mb-8 flex items-center justify-center gap-2.5">
              <div className="flex size-[26px] items-center justify-center rounded-[7px] bg-gradient-to-br from-primary to-violet-700">
                <Award className="size-3 text-white" strokeWidth={2.2} />
              </div>
              <span className="text-sm font-medium text-muted-foreground">Lynq &amp; Flow Academy</span>
            </div>

            <div className="mb-4 text-[11px] font-bold uppercase tracking-[0.12em] text-foreground-4">
              Certificate of Completion
            </div>

            <div className="mb-2 text-4xl font-extrabold tracking-tight text-foreground">
              {userName || 'Student'}
            </div>
            <div className="mb-1.5 text-sm text-muted-foreground">has successfully completed the</div>
            <div className="mb-7 bg-gradient-to-br from-violet-500 to-indigo-500 bg-clip-text text-lg font-semibold text-transparent">
              E-commerce Customer Service Mastery
            </div>

            <div className="mb-5 h-px bg-black/7" />

            <div className="mb-5 text-[13px] text-foreground-4">Completed on {today}</div>

            {/* Module badges */}
            <div className="mb-7 flex flex-wrap justify-center gap-[7px]">
              {MODULES.map((mod) => {
                const done = passedTypes.includes(mod.examType)
                return (
                  <div
                    key={mod.id}
                    className="flex items-center gap-1.5 rounded-[20px] border bg-black/3 px-3 py-1"
                    style={{ borderColor: done ? mod.color + '40' : 'rgba(0,0,0,0.08)' }}
                  >
                    <div
                      className="size-1.5 rounded-full"
                      style={{ background: done ? mod.color : 'rgba(0,0,0,0.15)' }}
                    />
                    <span
                      className="text-[11px] font-medium"
                      style={{ color: done ? '#374151' : '#9CA3AF' }}
                    >
                      {mod.label}
                    </span>
                    {done && <Check className="size-2.5 text-emerald-500" />}
                  </div>
                )
              })}
            </div>

            <div className="mb-6 h-px bg-black/7" />

            {/* Signature */}
            <div className="mb-8 flex items-end justify-between">
              <div className="text-left">
                <div className="mb-1 text-xs text-foreground-4">Certified by</div>
                <div className="text-[15px] font-semibold text-foreground">Lynq &amp; Flow</div>
              </div>
              <div className="text-right">
                <div className="mb-1 text-xs text-foreground-4">Date</div>
                <div className="text-sm text-foreground-2">{today}</div>
              </div>
            </div>

            {/* Seal */}
            <div className="mb-8 flex justify-center">
              <div className="flex size-20 flex-col items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-500 shadow-[0_0_30px_rgba(139,92,246,0.4)]">
                <Award className="size-7 text-white" />
                <span className="mt-0.5 text-[7px] font-bold uppercase tracking-[0.08em] text-white/80">
                  Certified
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap justify-center gap-2.5">
              <button
                className="cursor-pointer rounded-lg border-none bg-gradient-to-br from-violet-500 to-indigo-500 px-[22px] py-[11px] font-[inherit] text-[13px] font-semibold text-white shadow-[0_4px_20px_rgba(139,92,246,0.4)] transition-all duration-150 hover:-translate-y-px hover:brightness-110"
                onClick={() => window.print()}
              >
                Download Certificate
              </button>
              <button
                className="cursor-pointer rounded-lg border border-black/9 bg-black/4 px-[22px] py-[11px] font-[inherit] text-[13px] font-medium text-muted-foreground transition-all duration-150 hover:bg-black/7 hover:text-foreground-2"
                onClick={() => {
                  const text = `I just earned the E-commerce Customer Service Mastery certificate from Lynq & Flow Academy!`
                  window.open(
                    `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(window.location.href)}&summary=${encodeURIComponent(text)}`,
                    '_blank',
                  )
                }}
              >
                Share on LinkedIn
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
