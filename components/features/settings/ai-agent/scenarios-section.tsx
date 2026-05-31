'use client'

import { SettingsSection, SettingsCard } from '@/components/features/settings/settings-section'
import { StatusBadge } from '@/components/features/settings/status-badge'
import type { AiScenarioRow } from '@/hooks/ai'
import { ScenarioRow } from './scenario-row'

export interface ScenarioMeta {
  key: string
  title: string
  /** angry_or_chargeback is always human-handled — autonomy is locked at 0%. */
  lockAutonomy?: boolean
}

// The 7 canonical scenarios, in the exact order required by the spec.
export const SCENARIOS: ScenarioMeta[] = [
  { key: 'wismo',             title: 'Where is my order?' },
  { key: 'long_delivery',     title: 'Long delivery time' },
  { key: 'lost_package',      title: 'Lost package' },
  { key: 'wrong_or_damaged',  title: 'Wrong or damaged item' },
  { key: 'refund_or_cancel',  title: 'Refund or cancellation' },
  { key: 'customs_fees',      title: 'Customs fees' },
  { key: 'angry_or_chargeback', title: 'Angry customer or chargeback', lockAutonomy: true },
]

interface ScenariosSectionProps {
  storeId: string
  scenarios: AiScenarioRow[]
  canEdit: boolean
  isComplete: boolean
}

export function ScenariosSection({ storeId, scenarios, canEdit, isComplete }: ScenariosSectionProps) {
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
              row={scenarios.find((r) => r.scenario_key === meta.key)}
              first={i === 0}
              last={i === SCENARIOS.length - 1}
            />
          ))}
        </div>
      </SettingsCard>
    </SettingsSection>
  )
}
