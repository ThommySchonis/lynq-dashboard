'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

/** Reused "← Back to sign in" link shown on forgot / reset / 2FA screens. */
export function BackToSignIn() {
  return (
    <Link
      href="/login"
      className="flex items-center justify-center gap-1.5 text-sm font-semibold text-primary transition-opacity hover:opacity-80"
    >
      <ArrowLeft size={15} />
      Back to sign in
    </Link>
  )
}
