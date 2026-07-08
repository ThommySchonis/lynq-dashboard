'use client'

import { Input } from '@/components/ui/input'
import { SettingsPanel, SettingsRow } from '@/components/features/settings/settings-panel'

export interface TimeTrackingValues {
  /** Nominal shift length in seconds. */
  shift_target_seconds: number
}

interface TimeTrackingSectionProps {
  values: TimeTrackingValues
  canEdit: boolean
  onChange: (patch: Partial<TimeTrackingValues>) => void
}

// The shift target is stored in seconds but edited in hours — the friendlier
// unit for an 8-hour workday. Empty/invalid input is ignored so the parent
// keeps the last valid value.
export function TimeTrackingSection({ values, canEdit, onChange }: TimeTrackingSectionProps) {
  const hours = values.shift_target_seconds / 3600

  return (
    <SettingsPanel
      title="Time tracking"
      description="Configure how work sessions are measured across your workspace."
    >
      <SettingsRow
        label="Daily shift target"
        hint="Scales the timer progress bar on the Time Tracking page. Between 1 and 24 hours."
        htmlFor="ws-shift-target"
      >
        <div className="flex items-center gap-2">
          <Input
            id="ws-shift-target"
            type="number"
            min={1}
            max={24}
            step={0.5}
            value={Number.isFinite(hours) ? String(hours) : ''}
            onChange={(e) => {
              const h = parseFloat(e.target.value)
              if (!Number.isFinite(h)) return
              const clamped = Math.min(24, Math.max(1, h))
              onChange({ shift_target_seconds: Math.round(clamped * 3600) })
            }}
            disabled={!canEdit}
            className="w-20 text-right"
          />
          <span className="text-sm text-muted-foreground">hours</span>
        </div>
      </SettingsRow>
    </SettingsPanel>
  )
}
