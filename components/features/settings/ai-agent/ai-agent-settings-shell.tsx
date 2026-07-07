'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { SettingsPageHeader } from '@/components/features/settings/settings-header'
import { SettingsEmptyState } from '@/components/features/settings/settings-empty-state'
import { AiStoreSelect } from './ai-store-select'
import type { StorePublic } from '@/types/stores'

interface AiAgentSettingsShellProps {
  title: string
  description: string
  /** Icon for the "no stores" empty state (varies per page). */
  emptyIcon: LucideIcon
  /** Optional page-header action slot (e.g. the Lessons "Add lesson" button). */
  headerActions?: ReactNode
  storesLoading: boolean
  stores: StorePublic[] | undefined
  storeId: string
  onStoreChange: (id: string) => void
  /** Rendered below the store picker once a store exists. Children own their
   *  own per-store data-loading states. */
  children: ReactNode
}

/**
 * Shared shell for the AI-agent settings pages (Onboarding, Lessons, Rules).
 * Owns the page container, header, store-loading skeleton, "no stores" empty
 * card, and the store picker — the scaffold that was previously copy-pasted
 * across all three pages.
 */
export function AiAgentSettingsShell({
  title,
  description,
  emptyIcon,
  headerActions,
  storesLoading,
  stores,
  storeId,
  onStoreChange,
  children,
}: AiAgentSettingsShellProps) {
  if (storesLoading) {
    return (
      <div className="mx-auto max-w-[920px] px-6 py-10">
        <SettingsPageHeader title={title} description={description} />
        <div className="flex flex-col gap-10">
          <Skeleton className="h-32 w-full rounded-2xl" />
          <Skeleton className="h-52 w-full rounded-2xl" />
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[920px] px-6 py-10">
      <SettingsPageHeader title={title} description={description} actions={headerActions} />

      {!stores || stores.length === 0 ? (
        <div className="flex items-center justify-center pt-6">
          <div className="w-[440px] max-w-full rounded-2xl border border-settings-border bg-card px-10 py-7">
            <SettingsEmptyState
              Icon={emptyIcon}
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
            <AiStoreSelect stores={stores} storeId={storeId} onChange={onStoreChange} />
          </div>
          {children}
        </>
      )}
    </div>
  )
}
