'use client'

import type { LucideIcon } from 'lucide-react'
import { Sparkles, Pencil, Eye, Send } from 'lucide-react'

/** 18px brand-tinted icon in a 32px rounded square (Figma node 1372-66637). */
function IconBox({ Icon }: { Icon: LucideIcon }) {
  return (
    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent-soft">
      <Icon size={18} strokeWidth={1.75} className="text-primary" />
    </span>
  )
}

const STEPS: { Icon: LucideIcon; step: string; title: string; description: string }[] = [
  {
    Icon: Pencil,
    step: 'STEP 1',
    title: 'Emma drafts',
    description: 'A ready-to-send reply is prepared for every ticket.',
  },
  {
    Icon: Eye,
    step: 'STEP 2',
    title: 'You review',
    description: 'Open the suggestion, edit the wording, add your voice.',
  },
  {
    Icon: Send,
    step: 'STEP 3',
    title: 'You send',
    description: 'Approve and send when it’s right — nothing goes out on its own.',
  },
]

/**
 * Explainer card shown in place of the auto-send rules while "Suggest only"
 * is selected (Figma node 1373-7). Emma never sends on her own in this mode,
 * so there are no conditions to configure — just how the flow works.
 */
export function SuggestOnlyInfo() {
  return (
    <div className="flex flex-col rounded-2xl border border-settings-border bg-card">
      <div className="flex items-center gap-3 px-[18px] py-4">
        <IconBox Icon={Sparkles} />
        <div className="flex flex-col gap-0.5">
          <h3 className="text-lg font-semibold text-foreground">How “Suggest only” works</h3>
          <p className="text-xs font-medium text-muted-foreground">
            Emma never sends on her own in this mode — every reply waits for a person.
          </p>
        </div>
      </div>

      <div className="border-t border-settings-border" />

      <div className="flex gap-3.5 p-[18px]">
        {STEPS.map(({ Icon, step, title, description }) => (
          <div key={step} className="flex flex-1 flex-col gap-[9px]">
            <div className="flex items-center gap-[9px]">
              <IconBox Icon={Icon} />
              <span className="text-xs font-semibold text-foreground-4">{step}</span>
            </div>
            <p className="text-sm font-semibold text-foreground">{title}</p>
            <p className="text-xs font-medium text-muted-foreground">{description}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
