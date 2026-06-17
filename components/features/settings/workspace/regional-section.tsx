'use client'

import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { SettingsSection, SettingsCard } from '@/components/features/settings/settings-section'
import { SettingsField } from '@/components/features/settings/settings-field'
import { TIMEZONES, LOCALES } from '@/lib/settings-constants'

const DATE_FORMATS = [
  { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY' },
  { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY' },
  { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD' },
] as const

const TIME_FORMATS = [
  { value: '12h', label: '12-hour' },
  { value: '24h', label: '24-hour' },
] as const

const WEEK_START_OPTIONS = [
  { value: 'Sunday', label: 'Sunday' },
  { value: 'Monday', label: 'Monday' },
] as const

export interface RegionalValues {
  timezone: string
  locale: string
  date_format: string
  time_format: string
  first_day_of_week: string
}

interface RegionalSectionProps {
  values: RegionalValues
  canEdit: boolean
  isSaving: boolean
  isDirty: boolean
  onChange: (patch: Partial<RegionalValues>) => void
  onSave: () => void
}

export function RegionalSection({
  values,
  canEdit,
  isSaving,
  isDirty,
  onChange,
  onSave,
}: RegionalSectionProps) {
  return (
    <SettingsSection
      title="Regional settings"
      description="Control how dates, times, and languages appear across your workspace."
    >
      <SettingsCard
        footer={
          canEdit ? (
            <Button onClick={onSave} disabled={!isDirty || isSaving}>
              {isSaving ? 'Saving…' : 'Save changes'}
            </Button>
          ) : undefined
        }
      >
        <div className="flex flex-col gap-5">
          <SettingsField label="Timezone" htmlFor="ws-timezone">
            <Select
              value={values.timezone}
              onValueChange={(v) => canEdit && v && onChange({ timezone: v })}
              disabled={!canEdit}
            >
              <SelectTrigger id="ws-timezone" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIMEZONES.map((tz) => (
                  <SelectItem key={tz} value={tz}>
                    {tz.replace(/_/g, ' ')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SettingsField>

          <SettingsField label="Default language" htmlFor="ws-locale">
            <Select
              value={values.locale}
              onValueChange={(v) => canEdit && v && onChange({ locale: v })}
              disabled={!canEdit}
            >
              <SelectTrigger id="ws-locale" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LOCALES.map((l) => (
                  <SelectItem key={l.value} value={l.value}>
                    {l.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SettingsField>

          <SettingsField label="Date format" htmlFor="ws-date-format">
            <Select
              value={values.date_format}
              onValueChange={(v) => canEdit && v && onChange({ date_format: v })}
              disabled={!canEdit}
            >
              <SelectTrigger id="ws-date-format" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DATE_FORMATS.map((f) => (
                  <SelectItem key={f.value} value={f.value}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SettingsField>

          <SettingsField label="Time format" htmlFor="ws-time-format">
            <Select
              value={values.time_format}
              onValueChange={(v) => canEdit && v && onChange({ time_format: v })}
              disabled={!canEdit}
            >
              <SelectTrigger id="ws-time-format" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIME_FORMATS.map((f) => (
                  <SelectItem key={f.value} value={f.value}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SettingsField>

          <SettingsField label="First day of week" htmlFor="ws-first-day">
            <Select
              value={values.first_day_of_week}
              onValueChange={(v) => canEdit && v && onChange({ first_day_of_week: v })}
              disabled={!canEdit}
            >
              <SelectTrigger id="ws-first-day" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WEEK_START_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SettingsField>
        </div>
      </SettingsCard>
    </SettingsSection>
  )
}
