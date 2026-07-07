'use client'

import type { LucideIcon } from 'lucide-react'
import { Eye, Send, Info, Check } from 'lucide-react'

export type AutomationModeValue = 'suggest' | 'auto'

interface ModeCardProps {
  selected: boolean
  Icon: LucideIcon
  title: string
  description: string
  onSelect: () => void
  disabled?: boolean
}

/** One selectable automation-mode card (Figma node 1068-27 / 1068-37). */
function ModeCard({ selected, Icon, title, description, onSelect, disabled }: ModeCardProps) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      disabled={disabled}
      className={`flex flex-1 flex-col rounded-[14px] p-[18px] text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
        selected
          ? 'border-[1.5px] border-primary bg-primary/[0.04]'
          : 'border border-settings-border bg-card hover:border-border-hover'
      }`}
    >
      <div className="flex items-start justify-between">
        <Icon
          size={22}
          strokeWidth={1.75}
          className={selected ? 'text-primary' : 'text-muted-foreground'}
        />
        <span
          className={`flex size-5 shrink-0 items-center justify-center rounded-full ${
            selected ? 'bg-primary text-primary-foreground' : 'border-[1.5px] border-foreground-4'
          }`}
        >
          {selected && <Check size={13} strokeWidth={3} />}
        </span>
      </div>
      <p className="mt-3.5 text-base font-semibold text-foreground">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </button>
  )
}

interface AutomationModeProps {
  value: AutomationModeValue
  onSelect: (value: AutomationModeValue) => void
  disabled?: boolean
}

/**
 * Automation-mode selector (Figma node 1068-23 … 1068-53). Two radio cards —
 * "Suggest only" vs "Auto-send when confident" — plus the info banner that only
 * makes sense while auto-send is active.
 */
export function AutomationMode({ value, onSelect, disabled }: AutomationModeProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-bold text-foreground">Automation mode</h2>
        <p className="text-sm font-medium text-muted-foreground">
          Choose how Emma handles replies for this store.
        </p>
      </div>

      <div role="radiogroup" className="flex gap-4">
        <ModeCard
          selected={value === 'suggest'}
          Icon={Eye}
          title="Suggest only"
          description="Every reply waits for a teammate to review and send. Safest setting."
          onSelect={() => onSelect('suggest')}
          disabled={disabled}
        />
        <ModeCard
          selected={value === 'auto'}
          Icon={Send}
          title="Auto-send when confident"
          description="Emma sends replies that pass the rules below — everything else goes to review."
          onSelect={() => onSelect('auto')}
          disabled={disabled}
        />
      </div>

      {value === 'auto' && (
        <div className="flex items-center gap-[9px] rounded-[10px] bg-info-soft px-3.5 py-3">
          <Info size={16} strokeWidth={2} className="shrink-0 text-[#1D4ED8]" />
          <p className="text-xs font-medium text-[#1D4ED8]">
            Replies that don’t qualify for auto-send land in your inbox as ready-to-approve
            suggestions.
          </p>
        </div>
      )}
    </div>
  )
}
