'use client'

import { Bot } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { EmptyState } from '@/components/shared/empty-state'
import { useAuthStore } from '@/stores/auth'
import { useAiStoreSelection } from '@/hooks/ai'
import { FundamentSection } from './fundament-section'
import { PoliciesSection } from './policies-section'
import { ExamplesSection } from './examples-section'
import { ScenariosSection } from './scenarios-section'

export function OnboardingSettings() {
  const role = useAuthStore((s) => s.role)
  const isSuspended = useAuthStore((s) => s.isSuspended)
  const canEdit = !isSuspended && (role === 'owner' || role === 'admin')

  const { storeId, setStore, stores, storesLoading } = useAiStoreSelection()

  if (storesLoading) {
    return (
      <div className="max-w-3xl mx-auto px-12 py-12 space-y-10">
        <div className="space-y-2 pb-6 border-b border-border">
          <Skeleton className="h-3.5 w-28" />
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-3.5 w-80" />
        </div>
        <Skeleton className="h-52 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-12 py-12">
      <div className="pb-6 mb-8 border-b border-border">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1.5 flex-wrap">
          <span>Settings</span>
          <span>/</span>
          <span>AI agent</span>
          <span>/</span>
          <span>Onboarding</span>
        </div>
        <h1 className="text-[28px] font-semibold text-foreground leading-tight mb-1">Onboarding</h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Teach the AI agent about a store&rsquo;s brand, policies, example replies, and how to
          handle common support scenarios.
        </p>
      </div>

      {!stores || stores.length === 0 ? (
        <EmptyState
          icon={Bot}
          title="No stores yet"
          description="Connect a store first to configure its AI agent. Stores can be added under Settings → Stores."
        />
      ) : (
        <>
          <div className="mb-8 flex flex-col gap-1.5 max-w-xs">
            <Label htmlFor="ai-store-select" className="text-sm font-medium text-foreground">
              Store
            </Label>
            <Select value={storeId} onValueChange={(v) => v && setStore(v)}>
              <SelectTrigger id="ai-store-select" className="w-full">
                <SelectValue placeholder="Select a store" />
              </SelectTrigger>
              <SelectContent>
                {stores.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
              <Skeleton className="h-52 w-full rounded-xl" />
              <Skeleton className="h-64 w-full rounded-xl" />
              <Skeleton className="h-52 w-full rounded-xl" />
              <Skeleton className="h-72 w-full rounded-xl" />
            </div>
          )}
        </>
      )}
    </div>
  )
}
