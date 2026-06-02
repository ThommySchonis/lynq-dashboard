import Link from 'next/link'
import type { LegalDoc } from '@/lib/legal/types'
import { LegalSection } from './legal-section'
import { LegalToc } from './legal-toc'

interface LegalPageProps {
  doc: LegalDoc
  /** Cross-link to the other legal page (e.g. from Terms → Privacy) */
  crossLink: { href: string; label: string }
}

export function LegalPage({ doc, crossLink }: LegalPageProps) {
  return (
    <main className="min-h-screen bg-[var(--background)] py-16 lg:py-20 px-6">
      <div className="max-w-[1080px] mx-auto">

        {/* Header */}
        <header className="mb-12">
          <Link href="/login" className="inline-block">
            <img src="/logo.png" alt="Lynq" className="h-7" />
          </Link>
        </header>

        {/* Two-column grid on desktop */}
        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_240px] lg:gap-12">

          {/* Main content column */}
          <article className="max-w-[720px]">
            <h1 className="font-display text-4xl lg:text-5xl text-[var(--foreground)] leading-tight">
              {doc.title}
            </h1>
            <p className="mt-3 text-sm text-[var(--foreground-3)]">
              Last updated: {doc.lastUpdated}
            </p>

            {doc.intro && (
              <div className="mt-8 text-[15px] leading-relaxed text-[var(--foreground-2)] space-y-3">
                {doc.intro}
              </div>
            )}

            <div className="mt-4">
              {doc.sections.map((section) => (
                <LegalSection key={section.id} section={section} />
              ))}
            </div>

            {/* In-page footer */}
            <footer className="mt-16 pt-8 border-t border-[var(--border)] text-[14px] text-[var(--foreground-3)] space-y-2">
              <p>
                Have questions? Email{' '}
                <a
                  href="mailto:info@lynqagency.com"
                  className="text-[var(--primary)] hover:underline"
                >
                  info@lynqagency.com
                </a>
                .
              </p>
              <p>
                Also see our{' '}
                <Link
                  href={crossLink.href}
                  className="text-[var(--primary)] hover:underline"
                >
                  {crossLink.label}
                </Link>
                .
              </p>
            </footer>
          </article>

          {/* Sidebar TOC */}
          <aside>
            <LegalToc sections={doc.sections} />
          </aside>
        </div>
      </div>
    </main>
  )
}
