'use client'

import Link from 'next/link'
import { ClipboardList, Pencil, Sparkles, ArrowRight, type LucideIcon } from 'lucide-react'

/**
 * Truly-empty Macros state (Figma node 831-26565): centered illustration +
 * heading + two choice cards (manual / AI-generate, the latter recommended).
 */
export function MacrosEmptyState() {
  return (
    <div className="flex flex-col items-center gap-7 py-10 text-center">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-accent-soft text-primary">
        <ClipboardList size={30} strokeWidth={1.5} />
      </div>

      <div className="flex flex-col items-center gap-2.5">
        <h3 className="text-lg font-semibold text-foreground">No macros yet</h3>
        <p className="max-w-[360px] text-sm text-muted-foreground">
          Choose how you&rsquo;d like to create your first macro.
        </p>
      </div>

      <div className="flex flex-wrap items-stretch justify-center gap-4">
        <ChoiceCard
          href="/settings/workspace/macros/new"
          Icon={Pencil}
          title="Create a macro"
          description="Write a reusable reply with variables you can apply to any ticket in one click."
          cta="Create manually"
        />
        <ChoiceCard
          href="/settings/workspace/macros/generate"
          Icon={Sparkles}
          title="Generate from your store"
          description="Let AI draft ready-to-use macros from your products, policies and FAQs."
          cta="Generate now"
          recommended
        />
      </div>
    </div>
  )
}

interface ChoiceCardProps {
  href: string
  Icon: LucideIcon
  title: string
  description: string
  cta: string
  recommended?: boolean
}

function ChoiceCard({ href, Icon, title, description, cta, recommended }: ChoiceCardProps) {
  return (
    <Link
      href={href}
      className={[
        'group flex w-[258px] flex-col gap-3 rounded-[14px] border-[1.5px] p-[18px] text-left transition-colors hover:bg-accent-soft/50',
        recommended ? 'border-primary/40' : 'border-border',
      ].join(' ')}
    >
      <div className="flex items-start justify-between">
        <div className="flex size-10 items-center justify-center rounded-[11px] border-[1.5px] border-accent-soft text-primary">
          <Icon size={20} strokeWidth={1.75} />
        </div>
        {recommended && (
          <span className="rounded-md bg-accent-soft px-2.5 py-1 text-xs font-medium text-primary">
            Recommended
          </span>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <h4 className="text-base font-semibold text-foreground">{title}</h4>
        <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>
      </div>

      <div className="mt-auto flex items-center gap-1.5 pt-1 text-sm font-semibold text-primary">
        {cta}
        <ArrowRight size={14} strokeWidth={2} className="transition-transform group-hover:translate-x-0.5" />
      </div>
    </Link>
  )
}
