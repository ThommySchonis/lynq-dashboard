'use client'

import { SettingsSection, SettingsCard } from '@/components/features/settings/settings-section'
import { StatusBadge } from '@/components/features/settings/status-badge'
import { useAiScenarios } from '@/hooks/ai'
import { ScenarioRow } from './scenario-row'

export interface ScenarioMeta {
  key: string
  title: string
  /** angry_or_chargeback is always human-handled — autonomy is locked at 0%. */
  lockAutonomy?: boolean
}

export const SCENARIOS: ScenarioMeta[] = [
  { key: 'wismo',               title: 'Where is my order?' },
  { key: 'long_delivery',       title: 'Long delivery time' },
  { key: 'lost_package',        title: 'Lost package' },
  { key: 'wrong_or_damaged',    title: 'Wrong or damaged item' },
  { key: 'refund_or_cancel',    title: 'Refund or cancellation' },
  { key: 'customs_fees',        title: 'Customs fees' },
  { key: 'angry_or_chargeback', title: 'Angry customer or chargeback', lockAutonomy: true },
]

interface ScenariosSectionProps {
  storeId: string
  canEdit: boolean
}

export function ScenariosSection({ storeId, canEdit }: ScenariosSectionProps) {
  const { data: scenarios } = useAiScenarios(storeId)

  const isComplete = SCENARIOS.every((s) => {
    const row = scenarios?.find((r) => r.scenario_key === s.key)
    return !!(row?.approach?.trim() && row?.escalate_when?.trim())
  })

  return (
    <SettingsSection
      title="Scenarios"
      description="How the AI agent approaches each common support situation. Each scenario saves on its own."
      actions={
        <StatusBadge
          status={isComplete ? 'active' : 'pending'}
          label={isComplete ? 'Complete' : 'Incomplete'}
        />
      }
    >
      <SettingsCard>
        <div className="flex flex-col divide-y divide-border">
          {SCENARIOS.map((meta, i) => (
            <ScenarioRow
              key={meta.key}
              meta={meta}
              storeId={storeId}
              canEdit={canEdit}
              row={scenarios?.find((r) => r.scenario_key === meta.key)}
              first={i === 0}
              last={i === SCENARIOS.length - 1}
            />
          ))}
        </div>
      </SettingsCard>
    </SettingsSection>
  )
}
