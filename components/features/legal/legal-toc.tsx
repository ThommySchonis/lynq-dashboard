// components/features/legal/legal-toc.tsx
'use client'

import { useEffect, useState } from 'react'
import type { LegalSection } from '@/lib/legal/types'

interface LegalTocProps {
  sections: LegalSection[]
}

export function LegalToc({ sections }: LegalTocProps) {
  const [activeId, setActiveId] = useState<string>(sections[0]?.id ?? '')

  useEffect(() => {
    if (sections.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        // Pick the topmost intersecting entry.
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible[0]) {
          setActiveId(visible[0].target.id)
        }
      },
      { rootMargin: '-96px 0px -60% 0px', threshold: 0 },
    )

    const targets: Element[] = []
    for (const s of sections) {
      const el = document.getElementById(s.id)
      if (el) {
        observer.observe(el)
        targets.push(el)
      }
    }

    return () => {
      for (const el of targets) observer.unobserve(el)
      observer.disconnect()
    }
  }, [sections])

  const list = (
    <ol className="space-y-2 m-0 p-0 list-none">
      {sections.map((s) => {
        const active = s.id === activeId
        return (
          <li key={s.id}>
            <a
              href={`#${s.id}`}
              className={
                'block text-sm transition-colors ' +
                (active
                  ? 'text-[var(--primary)] font-medium'
                  : 'text-[var(--foreground-3)] hover:text-[var(--foreground)]')
              }
            >
              {s.number}. {s.title}
            </a>
          </li>
        )
      })}
    </ol>
  )

  return (
    <>
      {/* Mobile: collapsible card */}
      <details className="lg:hidden mb-8 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] px-4 py-3">
        <summary className="cursor-pointer text-sm font-medium text-[var(--foreground)] select-none">
          Jump to section
        </summary>
        <nav aria-label="Table of contents" className="mt-3">
          {list}
        </nav>
      </details>

      {/* Desktop: sticky sidebar */}
      <nav
        aria-label="Table of contents"
        className="hidden lg:block sticky top-24 border-l border-[var(--border)] pl-4 max-h-[calc(100vh-8rem)] overflow-y-auto"
      >
        {list}
      </nav>
    </>
  )
}
