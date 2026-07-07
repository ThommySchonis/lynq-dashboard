'use client'

import { Sparkles } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuthStore } from '@/stores/auth'
import { useAiStoreSelection } from '@/hooks/ai'
import { AiAgentSettingsShell } from './ai-agent-settings-shell'
import { FundamentSection } from './fundament-section'
import { PoliciesSection } from './policies-section'
import { ExamplesSection } from './examples-section'
import { ScenariosSection } from './scenarios-section'

const HEADER_TITLE = 'Onboarding'
const HEADER_DESC =
  "Teach the AI agent about a store's brand, policies, example replies, and how to handle common support scenarios."

export function OnboardingSettings() {
  const role = useAuthStore((s) => s.role)
  const isSuspended = useAuthStore((s) => s.isSuspended)
  const canEdit = !isSuspended && (role === 'owner' || role === 'admin')

  const { storeId, setStore, stores, storesLoading } = useAiStoreSelection()

  return (
    <AiAgentSettingsShell
      title={HEADER_TITLE}
      description={HEADER_DESC}
      emptyIcon={Sparkles}
      storesLoading={storesLoading}
      stores={stores}
      storeId={storeId}
      onStoreChange={setStore}
    >
      {storeId ? (
        <div className="flex flex-col gap-10">
          <FundamentSection storeId={storeId} canEdit={canEdit} />
          <PoliciesSection  storeId={storeId} canEdit={canEdit} />
          <ExamplesSection  storeId={storeId} canEdit={canEdit} />
          <ScenariosSection storeId={storeId} canEdit={canEdit} />
        </div>
      ) : (
        <div className="flex flex-col gap-10">
          <Skeleton className="h-52 w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      )}
    </AiAgentSettingsShell>
  )
}
