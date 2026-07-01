'use client'

import { CircleCheck, FileText, Mail, Sparkles } from 'lucide-react'
import { TRACKING_PREFS } from '@/lib/supply-chain-constants'
import { StepHeader, SectionLabel, Toggle, PrefRow } from './wizard-ui'
import { SendFromSelect } from './send-from-select'

const PREF = Object.fromEntries(TRACKING_PREFS.map((p) => [p.key, p]))

interface StepTrackingPrefsProps {
  values: Record<string, boolean>
  onToggle: (key: string) => void
}

// Preferences are UI-only for now (proactive emails, sender, branded page, Emma
// and auto-resolve land with BE-4/BE-5/BE-6/BE-7/BE-8).
export function StepTrackingPrefs({ values, onToggle }: StepTrackingPrefsProps) {
  const toggle = (key: string) => (
    <Toggle checked={values[key]} onChange={() => onToggle(key)} aria-label={PREF[key].title} />
  )

  return (
    <div className="flex w-full flex-col items-center gap-5">
      <StepHeader
        step={4}
        title="Tracking preferences"
        subtitle="Choose how Lynq keeps customers informed and how it uses tracking data behind the scenes."
      />

      <SectionLabel>Customer updates</SectionLabel>

      <div className="flex w-full flex-col gap-0.5 rounded-[16px] border border-border bg-card p-2">
        <PrefRow
          icon={Mail}
          title={PREF.proactive_updates.title}
          caption={PREF.proactive_updates.caption}
          control={toggle('proactive_updates')}
        />
        <PrefRow
          icon={Mail}
          title="Send updates from"
          caption="The inbox customers see as the sender."
          control={<SendFromSelect />}
        />
        <PrefRow
          icon={FileText}
          title={PREF.branded_page.title}
          caption={PREF.branded_page.caption}
          control={toggle('branded_page')}
        />
      </div>

      <SectionLabel>AI assistance</SectionLabel>

      <div className="flex w-full flex-col gap-0.5 rounded-[16px] border border-accent-border bg-secondary p-2">
        <PrefRow
          icon={Sparkles}
          iconClass="text-primary"
          chipClass="bg-accent-soft"
          title={PREF.emma_wismo.title}
          caption={PREF.emma_wismo.caption}
          control={toggle('emma_wismo')}
        />
        <div className="mx-1 h-px bg-accent-border" />
        <PrefRow
          icon={CircleCheck}
          iconClass="text-primary"
          chipClass="bg-accent-soft"
          title={PREF.auto_resolve.title}
          caption={PREF.auto_resolve.caption}
          control={toggle('auto_resolve')}
        />
      </div>
    </div>
  )
}
