'use client'

import Link from 'next/link'
import { Sparkles } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { SettingsPageHeader } from '@/components/features/settings/settings-header'
import { SettingsEmptyState } from '@/components/features/settings/settings-empty-state'
import { useAuthStore } from '@/stores/auth'
import { useAiStoreSelection } from '@/hooks/ai'
import { AiStoreSelect } from './ai-store-select'
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

  if (storesLoading) {
    return (
      <div className="mx-auto max-w-[920px] px-6 py-10">
        <SettingsPageHeader title={HEADER_TITLE} description={HEADER_DESC} />
        <div className="flex flex-col gap-10">
          <Skeleton className="h-52 w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[920px] px-6 py-10">
      <SettingsPageHeader title={HEADER_TITLE} description={HEADER_DESC} />

      {!stores || stores.length === 0 ? (
        <div className="flex items-center justify-center pt-6">
          <div className="w-[440px] max-w-full rounded-2xl border border-settings-border bg-card px-10 py-7">
            <SettingsEmptyState
              Icon={Sparkles}
              title="No stores yet"
              description="Connect a store first to configure its AI agent. Stores can be added under Settings → Stores."
              action={
                <Button render={<Link href="/settings/workspace/stores" />}>Connect store</Button>
              }
            />
          </div>
        </div>
      ) : (
        <>
          <div className="mb-8">
            <AiStoreSelect stores={stores} storeId={storeId} onChange={setStore} />
          </div>

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
        </>
      )}
    </div>
  )
}
