// components/features/legal/legal-section.tsx
import type { LegalSection as LegalSectionType } from '@/lib/legal/types'

interface LegalSectionProps {
  section: LegalSectionType
}

export function LegalSection({ section }: LegalSectionProps) {
  return (
    <section
      id={section.id}
      className="scroll-mt-24 mt-12 first:mt-0"
      aria-labelledby={`${section.id}-heading`}
    >
      <h2
        id={`${section.id}-heading`}
        className="text-xl font-semibold text-[var(--foreground)] mb-4"
      >
        {section.number}. {section.title}
      </h2>
      <div className="text-[15px] leading-relaxed text-[var(--foreground-2)] space-y-3">
        {section.body}
      </div>
    </section>
  )
}
