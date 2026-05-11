'use client'

import type { ReactNode } from 'react'

interface AuthLayoutProps {
  /** Headline content — supports word-by-word reveal spans */
  headline: ReactNode
  /** Optional subheadline text */
  subhead?: string
  /** Optional footer content (login/signup toggle links) */
  footer?: ReactNode
  /** Form or other card body content */
  children: ReactNode
  /** Whether to render the animated background orbs (default: true) */
  showOrbs?: boolean
  /** Tailwind max-width class for the content column (default: 'max-w-md') */
  maxWidth?: string
}

export default function AuthLayout({
  headline,
  subhead,
  footer,
  children,
  showOrbs = true,
  maxWidth = 'max-w-md',
}: AuthLayoutProps) {
  return (
    <div className="relative min-h-screen bg-[#0A0612] text-white overflow-hidden flex items-center justify-center px-6 py-10">

      {/* ── Animated orbs ── */}
      {showOrbs && (
        <>
          <div
            aria-hidden="true"
            className="absolute w-[800px] h-[800px] top-[-12%] left-[-10%] rounded-full pointer-events-none z-0 blur-[80px] animate-[orbDriftA_60s_ease-in-out_infinite]"
            style={{
              background: 'radial-gradient(circle, rgba(127,119,221,0.75) 0%, rgba(127,119,221,0.15) 45%, transparent 75%)',
            }}
          />
          <div
            aria-hidden="true"
            className="absolute w-[720px] h-[720px] top-[-8%] right-[-12%] rounded-full pointer-events-none z-0 blur-[75px] animate-[orbDriftB_70s_ease-in-out_infinite]"
            style={{
              background: 'radial-gradient(circle, rgba(99,102,241,0.70) 0%, rgba(99,102,241,0.12) 45%, transparent 75%)',
            }}
          />
          <div
            aria-hidden="true"
            className="absolute w-[760px] h-[760px] bottom-[-25%] left-[20%] rounded-full pointer-events-none z-0 blur-[85px] animate-[orbDriftC_80s_ease-in-out_infinite]"
            style={{
              background: 'radial-gradient(circle, rgba(6,182,212,0.55) 0%, rgba(6,182,212,0.10) 45%, transparent 75%)',
            }}
          />
        </>
      )}

      {/* ── Noise texture overlay ── */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none z-[1] opacity-[0.06] mix-blend-overlay"
        style={{ backgroundImage: "url('/textures/noise.svg')" }}
      />

      {/* ── Content stack ── */}
      <div className={`relative z-[2] w-full ${maxWidth} text-center`}>

        {/* Wordmark */}
        <div className="mb-5 text-[11px] font-semibold tracking-[0.28em] uppercase text-white/55 login-fade login-d-0">
          Lynq &amp; Flow
        </div>

        {/* Headline */}
        <h1 className="text-[clamp(44px,5.4vw,64px)] font-normal leading-[1.05] tracking-[-0.02em] m-0 login-headline">
          {headline}
        </h1>

        {/* Gradient divider */}
        <div
          aria-hidden="true"
          className="w-[140px] h-px mx-auto mt-5 mb-4 login-fade login-d-2"
          style={{ background: 'linear-gradient(90deg, transparent 0%, rgba(127,119,221,0.45) 50%, transparent 100%)' }}
        />

        {/* Subhead */}
        {subhead && (
          <p className="text-[15px] text-white/60 mb-7 mt-0 login-fade login-d-3">
            {subhead}
          </p>
        )}

        {/* Glassmorphism card */}
        <div
          className="rounded-3xl px-9 py-10 text-left backdrop-blur-xl login-card login-fade login-d-4"
          style={{
            background: 'linear-gradient(145deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.04) 100%)',
            border: '1px solid rgba(255,255,255,0.18)',
            boxShadow: [
              '0 0 100px rgba(127,119,221,0.25)',
              '0 0 60px rgba(99,102,241,0.15)',
              '0 8px 32px rgba(0,0,0,0.45)',
              'inset 0 1px 0 rgba(255,255,255,0.10)',
            ].join(', '),
          }}
        >
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="mt-5 text-[14px] text-white/55 login-fade login-d-8">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
