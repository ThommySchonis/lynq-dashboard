'use client'

import type { ReactNode } from 'react'
import Image from 'next/image'
import Link from 'next/link'

interface AuthCardLayoutProps {
  /** Card title (e.g. "Welcome back") */
  title: string
  /** Optional subtitle under the title */
  subtitle?: string
  /** Form body content */
  children: ReactNode
  /** Optional slot below the form (divider + sign-up row or back link) */
  footer?: ReactNode
}

/**
 * Light, card-centric auth shell matching the Figma "Authorization" design.
 * The light counterpart to the dark `auth-layout.tsx` (kept for signup/invite).
 */
export default function AuthCardLayout({
  title,
  subtitle,
  children,
  footer,
}: AuthCardLayoutProps) {
  return (
    <div className="relative min-h-screen bg-background overflow-hidden flex flex-col items-center justify-center px-6 py-10">
      {/* ── Decorative blurred orbs ── */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-28 -right-24 h-[502px] w-[647px] rounded-full blur-[53px]"
        style={{ background: 'rgba(139, 92, 246, 0.08)' }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-28 -left-24 h-[502px] w-[647px] rounded-full blur-[53px]"
        style={{ background: 'rgba(139, 92, 246, 0.08)' }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 -left-32 h-[502px] w-[647px] rounded-full blur-[53px]"
        style={{ background: 'rgba(59, 130, 246, 0.08)' }}
      />

      {/* ── Card ── */}
      <div
        className="relative z-10 w-full max-w-[500px] rounded-[22px] border border-border bg-card p-10 text-left"
        style={{ boxShadow: '0px 24px 50px 0px rgba(28, 15, 54, 0.1)' }}
      >
        <Image
          src="/logo.png"
          alt="Lynq & Flow"
          width={1201}
          height={131}
          className="mb-6 h-4 w-auto"
          priority
        />
        <h1 className="text-[22px] font-bold leading-tight tracking-[-0.01em] text-foreground">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1.5 text-sm text-foreground-3">{subtitle}</p>
        )}

        <div className="mt-7">{children}</div>

        {footer}
      </div>

      {/* ── Page footer ── */}
      <p className="relative z-10 mt-6 text-sm text-foreground-4">
        © 2026 Lynq &amp; Flow{'  ·  '}
        <Link href="/terms" className="hover:text-foreground-3">
          Terms
        </Link>
        {'  ·  '}
        <Link href="/privacy" className="hover:text-foreground-3">
          Privacy
        </Link>
      </p>
    </div>
  )
}
