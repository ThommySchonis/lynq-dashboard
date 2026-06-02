import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'

interface LegalLinkProps {
  href: string
  label: string
}

function LegalLink({ href, label }: LegalLinkProps) {
  return (
    <Link
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center justify-between rounded-[var(--radius)] px-3 py-2.5 text-sm text-[var(--foreground)] hover:bg-[var(--accent-soft)] transition-colors"
    >
      <span>{label}</span>
      <ArrowUpRight
        aria-hidden="true"
        className="size-3.5 text-[var(--foreground-3)]"
      />
    </Link>
  )
}

export function LegalLinksSection() {
  return (
    <section className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-5">
      <header className="mb-3">
        <h2 className="text-base font-semibold text-[var(--foreground)]">Legal</h2>
        <p className="mt-1 text-xs text-[var(--foreground-3)]">
          Lynq &amp; Flow agreements you accepted when creating your account.
        </p>
      </header>
      <div className="space-y-1">
        <LegalLink href="/terms" label="Terms of Service" />
        <LegalLink href="/privacy" label="Privacy Policy" />
      </div>
    </section>
  )
}
