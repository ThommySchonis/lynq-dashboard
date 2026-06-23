'use client'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { SettingsPanel, SettingsRow } from '@/components/features/settings/settings-panel'
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
  onChange: (patch: Partial<RegionalValues>) => void
}

export function RegionalSection({
  values,
  canEdit,
  onChange,
}: RegionalSectionProps) {
  return (
    <SettingsPanel
      title="Regional settings"
      description="Control how dates, times and languages appear across your workspace."
    >
      <SettingsRow
        label="Timezone"
        hint="Used for reports, schedules & timestamps."
        htmlFor="ws-timezone"
      >
        <Select
          value={values.timezone}
          onValueChange={(v) => canEdit && v && onChange({ timezone: v })}
          disabled={!canEdit}
        >
          <SelectTrigger id="ws-timezone" className="w-[300px]">
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
      </SettingsRow>

      <SettingsRow
        label="Default language"
        hint="Interface language for this workspace."
        htmlFor="ws-locale"
      >
        <Select
          value={values.locale}
          onValueChange={(v) => canEdit && v && onChange({ locale: v })}
          disabled={!canEdit}
        >
          <SelectTrigger id="ws-locale" className="w-[300px]">
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
      </SettingsRow>

      <SettingsRow
        label="Date format"
        hint="How dates are displayed."
        htmlFor="ws-date-format"
      >
        <Select
          value={values.date_format}
          onValueChange={(v) => canEdit && v && onChange({ date_format: v })}
          disabled={!canEdit}
        >
          <SelectTrigger id="ws-date-format" className="w-[300px]">
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
      </SettingsRow>

      <SettingsRow
        label="Time format"
        hint="12-hour or 24-hour clock."
        htmlFor="ws-time-format"
      >
        <Select
          value={values.time_format}
          onValueChange={(v) => canEdit && v && onChange({ time_format: v })}
          disabled={!canEdit}
        >
          <SelectTrigger id="ws-time-format" className="w-[300px]">
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
      </SettingsRow>

      <SettingsRow
        label="First day of week"
        hint="First day shown in calendars."
        htmlFor="ws-first-day"
      >
        <Select
          value={values.first_day_of_week}
          onValueChange={(v) => canEdit && v && onChange({ first_day_of_week: v })}
          disabled={!canEdit}
        >
          <SelectTrigger id="ws-first-day" className="w-[300px]">
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
      </SettingsRow>
    </SettingsPanel>
  )
}
