'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { ChevronLeft, Share2, Download, Lock, Award, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Sidebar } from '@/components/layout/sidebar'
import { EASE } from '@/lib/academy-constants'

interface CertData {
  exam_score: number
  modules_completed: number
  issued_at: string
}

function formatDate(isoString: string): string {
  if (!isoString) return ''
  return new Date(isoString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export function CertificatePage() {
  const [loading, setLoading] = useState(true)
  const [cert, setCert] = useState<CertData | null>(null)
  const [name, setName] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
      if (!s) {
        window.location.href = '/login'
        return
      }

      const meta = (s.user.user_metadata || {}) as Record<string, string>
      const raw = (s.user.email || '').split('@')[0]
      setName(meta.full_name || meta.name || raw.charAt(0).toUpperCase() + raw.slice(1))

      try {
        const { data } = await supabase
          .from('certificates')
          .select('*')
          .eq('user_id', s.user.id)
          .single()
        setCert((data as CertData) || null)
      } catch {
        setCert(null)
      }
      setLoading(false)
    })
  }, [])

  function handleDownload() {
    window.print()
  }

  function handleLinkedIn() {
    const text = encodeURIComponent(
      'I just earned the Lynq Academy E-commerce CS Mastery certificate! #CustomerService #Ecommerce #LynqAcademy',
    )
    window.open(
      `https://www.linkedin.com/sharing/share-offsite/?text=${text}`,
      '_blank',
    )
  }

  if (loading)
    return (
      <div className="flex h-screen bg-[#F9F9FB]">
        <Sidebar />
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <Loader2 className="mx-auto mb-3 size-9 animate-spin text-violet-500" />
            <div className="text-[13px] text-(--text-4)">Loading...</div>
          </div>
        </div>
      </div>
    )

  if (!cert)
    return (
      <div className="flex h-screen bg-[#F9F9FB]">
        <Sidebar />
        <div className="ac-scroll flex flex-1 items-center justify-center overflow-y-auto px-6 py-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: EASE }}
            className="w-full max-w-[480px] text-center"
          >
            <div className="mx-auto mb-5 flex size-16 items-center justify-center rounded-full border border-red-500/20 bg-red-500/10">
              <Lock className="size-7 text-red-500" />
            </div>
            <h1 className="mb-2.5 text-2xl font-extrabold text-(--text-1)">
              Certificate Not Found
            </h1>
            <p className="mb-6 text-sm leading-[1.65] text-(--text-3)">
              You haven&apos;t passed the final exam yet. Complete the exam with 80%+ to earn your
              certificate.
            </p>
            <div className="flex justify-center gap-2.5">
              <button
                className="flex cursor-pointer items-center gap-2 rounded-[20px] border border-black/9 bg-black/4 px-5 py-2.5 font-[inherit] text-[13px] font-medium text-(--text-3) transition-all duration-150 hover:bg-black/7 hover:text-(--text-2)"
                onClick={() => (window.location.href = '/academy')}
              >
                Back to Academy
              </button>
              <button
                className="flex cursor-pointer items-center gap-2 rounded-[20px] border-none bg-gradient-to-br from-violet-500 to-indigo-500 px-6 py-2.5 font-[inherit] text-[13px] font-semibold text-white shadow-[0_4px_16px_rgba(99,102,241,0.3)] transition-all duration-150 hover:-translate-y-px hover:brightness-110"
                onClick={() => (window.location.href = '/academy/final-exam')}
              >
                Take Final Exam &rarr;
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    )

  return (
    <div className="flex h-screen bg-[#F9F9FB]">
      <Sidebar />
      <div className="ac-scroll flex-1 overflow-y-auto px-6 py-8">
        <div className="mx-auto max-w-[760px]">
          {/* Actions bar */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: EASE }}
            className="cert-no-print mb-7 flex items-center justify-between"
          >
            <button
              className="flex cursor-pointer items-center gap-2 rounded-[20px] border border-black/9 bg-black/4 px-5 py-2.5 font-[inherit] text-[13px] font-medium text-(--text-3) transition-all duration-150 hover:bg-black/7 hover:text-(--text-2)"
              onClick={() => (window.location.href = '/academy')}
            >
              <ChevronLeft className="size-3.5" />
              Back to Academy
            </button>
            <div className="flex gap-2">
              <button
                className="flex cursor-pointer items-center gap-2 rounded-[20px] border border-black/9 bg-black/4 px-5 py-2.5 font-[inherit] text-[13px] font-medium text-(--text-3) transition-all duration-150 hover:bg-black/7 hover:text-(--text-2)"
                onClick={handleLinkedIn}
              >
                <Share2 className="size-3.5" />
                Share on LinkedIn
              </button>
              <button
                className="flex cursor-pointer items-center gap-2 rounded-[20px] border-none bg-gradient-to-br from-violet-500 to-indigo-500 px-[22px] py-2.5 font-[inherit] text-[13px] font-semibold text-white shadow-[0_4px_16px_rgba(99,102,241,0.3)] transition-all duration-150 hover:-translate-y-px hover:brightness-110"
                onClick={handleDownload}
              >
                <Download className="size-3.5" />
                Download PDF
              </button>
            </div>
          </motion.div>

          {/* Certificate card */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: EASE, delay: 0.1 }}
            className="overflow-hidden rounded-[20px] border border-black/8 bg-white shadow-[0_8px_48px_rgba(0,0,0,0.08)]"
          >
            {/* Top gradient bar */}
            <div className="h-1.5 bg-gradient-to-r from-violet-500 via-indigo-500 to-blue-500" />

            {/* Corner ornaments */}
            <div className="absolute left-5 top-5 size-10 opacity-[0.12]">
              <svg viewBox="0 0 40 40" fill="none">
                <path d="M0 40 L40 0" stroke="#8B5CF6" strokeWidth="1" />
                <path d="M0 30 L30 0" stroke="#8B5CF6" strokeWidth="1" />
                <path d="M0 20 L20 0" stroke="#8B5CF6" strokeWidth="1" />
              </svg>
            </div>

            <div className="relative px-16 py-[52px] text-center">
              {/* Logo / issuer */}
              <div className="mb-8 text-[11px] font-bold uppercase tracking-[0.14em] text-(--text-4)">
                Lynq &amp; Flow Agency
              </div>

              {/* Certificate label */}
              <div className="mb-4 text-xs font-semibold uppercase tracking-[0.12em] text-violet-500">
                Certificate of Completion
              </div>

              {/* Divider */}
              <div className="mx-auto mb-7 h-0.5 w-[60px] bg-gradient-to-r from-transparent via-violet-500 to-transparent" />

              <p className="mb-3 text-sm italic text-(--text-4)">This certifies that</p>

              {/* Name */}
              <div className="mb-5 text-[44px] font-extrabold leading-[1.1] tracking-tight text-(--text-1)">
                {name}
              </div>

              <p className="mb-2.5 text-sm text-(--text-3)">has successfully completed</p>

              {/* Course name */}
              <div className="mb-1.5 text-2xl font-bold tracking-tight text-(--text-1)">
                E-commerce CS Mastery
              </div>
              <div className="mb-8 text-sm text-(--text-3)">
                Lynq Academy &middot; Full Certification Program
              </div>

              {/* Divider */}
              <div className="mx-auto mb-8 h-px w-20 bg-black/8" />

              {/* Stats row */}
              <div className="mb-10 flex justify-center gap-10">
                <div className="text-center">
                  <div className="mb-1 text-[28px] font-extrabold text-violet-500">
                    {cert.exam_score}%
                  </div>
                  <div className="text-[11px] uppercase tracking-[0.08em] text-(--text-4)">
                    Exam Score
                  </div>
                </div>
                <div className="w-px bg-black/7" />
                <div className="text-center">
                  <div className="mb-1 text-[28px] font-extrabold text-emerald-500">
                    {cert.modules_completed || 6}
                  </div>
                  <div className="text-[11px] uppercase tracking-[0.08em] text-(--text-4)">
                    Modules Completed
                  </div>
                </div>
                <div className="w-px bg-black/7" />
                <div className="text-center">
                  <div className="mb-1 text-[28px] font-extrabold text-indigo-500">50</div>
                  <div className="text-[11px] uppercase tracking-[0.08em] text-(--text-4)">
                    Questions Passed
                  </div>
                </div>
              </div>

              {/* Award icon */}
              <div className="mx-auto mb-8 flex size-14 items-center justify-center rounded-full border border-violet-500/20 bg-gradient-to-br from-violet-500/12 to-indigo-500/8">
                <Award className="size-6 text-violet-500" />
              </div>

              {/* Issue date */}
              <div className="text-xs text-[#C4C4C4]">
                Issued on {formatDate(cert.issued_at)}
              </div>
            </div>

            {/* Bottom gradient bar */}
            <div className="h-1 bg-gradient-to-r from-violet-500 via-indigo-500 to-blue-500" />
          </motion.div>

          <div className="h-10" />
        </div>
      </div>
    </div>
  )
}
