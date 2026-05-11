'use client'

import type { SwitchRoot } from '@base-ui/react/switch'
import { Switch } from '@/components/ui/switch'

interface SettingsToggleProps {
  label: string
  description?: string
  checked: boolean
  onCheckedChange: (checked: boolean, eventDetails: SwitchRoot.ChangeEventDetails) => void
  disabled?: boolean
  id?: string
}

export function SettingsToggle({
  label,
  description,
  checked,
  onCheckedChange,
  disabled,
  id,
}: SettingsToggleProps) {
  return (
    <div className="flex items-center justify-between gap-6">
      <div className="flex-1">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {description && (
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{description}</p>
        )}
      </div>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
      />
    </div>
  )
}
