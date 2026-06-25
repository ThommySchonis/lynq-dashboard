'use client'

import { Switch } from '@/components/ui/switch'
import { SettingsPanel, SettingsRow } from '@/components/features/settings/settings-panel'

export interface PreferencesValues {
  show_order_data: boolean
  auto_translate: boolean
  allow_deletion: boolean
}

interface PreferencesSectionProps {
  values: PreferencesValues
  canEdit: boolean
  onChange: (patch: Partial<PreferencesValues>) => void
}

const PREFERENCE_ROWS = [
  {
    key: 'show_order_data' as const,
    label: 'Show order data inline in tickets',
    description: 'Display Shopify order details directly inside the ticket view.',
  },
  {
    key: 'auto_translate' as const,
    label: 'Auto-translate customer messages',
    description: 'Automatically translate non-English messages using AI.',
  },
  {
    key: 'allow_deletion' as const,
    label: 'Allow agents to delete tickets',
    description: 'Agents can permanently delete tickets — this cannot be undone.',
  },
]

export function PreferencesSection({
  values,
  canEdit,
  onChange,
}: PreferencesSectionProps) {
  return (
    <SettingsPanel
      title="Workspace preferences"
      description="Global feature toggles that apply to all agents in this workspace."
    >
      {PREFERENCE_ROWS.map((row) => (
        <SettingsRow
          key={row.key}
          label={row.label}
          hint={row.description}
          htmlFor={`toggle-${row.key}`}
        >
          <Switch
            id={`toggle-${row.key}`}
            checked={values[row.key]}
            onCheckedChange={(checked) => onChange({ [row.key]: checked })}
            disabled={!canEdit}
          />
        </SettingsRow>
      ))}
    </SettingsPanel>
  )
}
