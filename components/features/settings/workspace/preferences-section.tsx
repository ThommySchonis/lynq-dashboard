'use client'

import { Button } from '@/components/ui/button'
import { SettingsSection, SettingsCard } from '@/components/features/settings/settings-section'
import { SettingsToggle } from '@/components/features/settings/settings-toggle'

export interface PreferencesValues {
  show_order_data: boolean
  auto_translate: boolean
  allow_deletion: boolean
}

interface PreferencesSectionProps {
  values: PreferencesValues
  canEdit: boolean
  isSaving: boolean
  isDirty: boolean
  onChange: (patch: Partial<PreferencesValues>) => void
  onSave: () => void
}

const PREFERENCE_ROWS = [
  {
    key: 'show_order_data' as const,
    label: 'Show order data inline in tickets',
    description: 'Display Shopify order details directly inside ticket view',
  },
  {
    key: 'auto_translate' as const,
    label: 'Auto-translate customer messages',
    description: 'Automatically translate non-English messages using AI',
  },
  {
    key: 'allow_deletion' as const,
    label: 'Allow agents to delete tickets',
    description: 'Agents can permanently delete tickets (cannot be undone)',
  },
]

export function PreferencesSection({
  values,
  canEdit,
  isSaving,
  isDirty,
  onChange,
  onSave,
}: PreferencesSectionProps) {
  return (
    <SettingsSection
      title="Workspace preferences"
      description="Global feature toggles that apply to all agents in this workspace."
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
        <div className="flex flex-col divide-y divide-border">
          {PREFERENCE_ROWS.map((row, i) => (
            <div
              key={row.key}
              className={`py-4 ${i === 0 ? 'pt-0' : ''} ${i === PREFERENCE_ROWS.length - 1 ? 'pb-0' : ''}`}
            >
              <SettingsToggle
                id={`toggle-${row.key}`}
                label={row.label}
                description={row.description}
                checked={values[row.key]}
                onCheckedChange={(checked) => onChange({ [row.key]: checked })}
                disabled={!canEdit}
              />
            </div>
          ))}
        </div>
      </SettingsCard>
    </SettingsSection>
  )
}
