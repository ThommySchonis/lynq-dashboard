'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
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
import { useStores } from '@/hooks/stores'
import {
  useAiPolicies,
  useAiScenarios,
  useUpsertAiPolicies,
} from '@/hooks/ai'
import type { AiPoliciesRow } from '@/hooks/ai'
import { FundamentSection } from './fundament-section'
import type { FundamentValues } from './fundament-section'
import { PoliciesSection } from './policies-section'
import type { PoliciesValues } from './policies-section'
import { ScenariosSection, SCENARIOS } from './scenarios-section'

// ── Policies form state (Fundament + Policies write to the SAME ai_policies row) ──
interface PoliciesForm extends FundamentValues, PoliciesValues {}

const EMPTY_FORM: PoliciesForm = {
  // Fundament
  brand_name: '',
  brand_description: '',
  tone_of_voice: '',
  sign_off: '',
  languages: [],
  website_url: '',
  // Policies & rules
  shipping_policy: '',
  refund_policy: '',
  customs_policy: '',
  can_decide: [],
  cannot_decide: [],
  escalate_triggers: [],
  tracking_url: '',
}

function rowToForm(row: AiPoliciesRow | null | undefined): PoliciesForm {
  return {
    brand_name: row?.brand_name ?? '',
    brand_description: row?.brand_description ?? '',
    tone_of_voice: row?.tone_of_voice ?? '',
    sign_off: row?.sign_off ?? '',
    languages: row?.languages ?? [],
    website_url: row?.website_url ?? '',
    shipping_policy: row?.shipping_policy ?? '',
    refund_policy: row?.refund_policy ?? '',
    customs_policy: row?.customs_policy ?? '',
    can_decide: row?.can_decide ?? [],
    cannot_decide: row?.cannot_decide ?? [],
    escalate_triggers: row?.escalate_triggers ?? [],
    tracking_url: row?.tracking_url ?? '',
  }
}

const sameList = (a: string[], b: string[]) => JSON.stringify(a) === JSON.stringify(b)

export function OnboardingSettings() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const role = useAuthStore((s) => s.role)
  const isSuspended = useAuthStore((s) => s.isSuspended)
  const canEdit = !isSuspended && (role === 'owner' || role === 'admin')

  // ── Store selection (persisted in ?store=) ──
  const { data: stores, isLoading: storesLoading } = useStores()
  const storeId = searchParams.get('store') ?? ''

  const setStore = useCallback(
    (id: string) => {
      const sp = new URLSearchParams(searchParams.toString())
      sp.set('store', id)
      router.replace(`${pathname}?${sp.toString()}`, { scroll: false })
    },
    [pathname, router, searchParams]
  )

  // Default to the first store when none is selected yet.
  useEffect(() => {
    if (!storeId && stores && stores.length > 0) {
      setStore(stores[0].id)
    }
  }, [storeId, stores, setStore])

  // ── Server data for the selected store ──
  const { data: policies, isLoading: policiesLoading } = useAiPolicies(storeId)
  const { data: scenarios, isLoading: scenariosLoading } = useAiScenarios(storeId)
  const upsertPolicies = useUpsertAiPolicies(storeId)

  // ── Local form state, seeded from the server row ──
  const [form, setForm] = useState<PoliciesForm>(EMPTY_FORM)
  const [init, setInit] = useState<PoliciesForm>(EMPTY_FORM)
  const [savingFundament, setSavingFundament] = useState(false)
  const [savingPolicies, setSavingPolicies] = useState(false)

  useEffect(() => {
    const seeded = rowToForm(policies)
    setForm(seeded)
    setInit(seeded)
  }, [policies])

  // ── Dirty checks ──
  const fundamentDirty =
    form.brand_name !== init.brand_name ||
    form.brand_description !== init.brand_description ||
    form.tone_of_voice !== init.tone_of_voice ||
    form.sign_off !== init.sign_off ||
    form.website_url !== init.website_url ||
    !sameList(form.languages, init.languages)

  const policiesDirty =
    form.shipping_policy !== init.shipping_policy ||
    form.refund_policy !== init.refund_policy ||
    form.customs_policy !== init.customs_policy ||
    form.tracking_url !== init.tracking_url ||
    !sameList(form.can_decide, init.can_decide) ||
    !sameList(form.cannot_decide, init.cannot_decide) ||
    !sameList(form.escalate_triggers, init.escalate_triggers)

  // ── Completeness (UI-only; computed from saved server data so badges
  //    reflect what is actually stored and update after each save) ──
  //  • Fundament: brand_name + tone_of_voice + sign_off all non-empty.
  //  • Policies:  shipping_policy + refund_policy + can_decide (non-empty)
  //               + escalate_triggers (non-empty) all present.
  //  • Scenarios: all 7 canonical scenarios have approach + escalate_when.
  const fundamentComplete = !!(
    policies?.brand_name?.trim() &&
    policies?.tone_of_voice?.trim() &&
    policies?.sign_off?.trim()
  )
  const policiesComplete = !!(
    policies?.shipping_policy?.trim() &&
    policies?.refund_policy?.trim() &&
    policies?.can_decide?.length &&
    policies?.escalate_triggers?.length
  )
  const scenariosComplete = SCENARIOS.every((s) => {
    const row = scenarios?.find((r) => r.scenario_key === s.key)
    return !!(row?.approach?.trim() && row?.escalate_when?.trim())
  })

  // ── Save handlers (each section saves only its own fields; omitted fields
  //    are preserved server-side, so the two sections never overwrite each
  //    other's data on the shared ai_policies row) ──
  async function handleSaveFundament() {
    if (!canEdit) return
    setSavingFundament(true)
    try {
      await upsertPolicies.mutateAsync({
        brand_name: form.brand_name,
        brand_description: form.brand_description,
        tone_of_voice: form.tone_of_voice,
        sign_off: form.sign_off,
        languages: form.languages,
        website_url: form.website_url,
      })
      setInit((prev) => ({
        ...prev,
        brand_name: form.brand_name,
        brand_description: form.brand_description,
        tone_of_voice: form.tone_of_voice,
        sign_off: form.sign_off,
        languages: form.languages,
        website_url: form.website_url,
      }))
    } finally {
      setSavingFundament(false)
    }
  }

  async function handleSavePolicies() {
    if (!canEdit) return
    setSavingPolicies(true)
    try {
      await upsertPolicies.mutateAsync({
        shipping_policy: form.shipping_policy,
        refund_policy: form.refund_policy,
        customs_policy: form.customs_policy,
        can_decide: form.can_decide,
        cannot_decide: form.cannot_decide,
        escalate_triggers: form.escalate_triggers,
        tracking_url: form.tracking_url,
      })
      setInit((prev) => ({
        ...prev,
        shipping_policy: form.shipping_policy,
        refund_policy: form.refund_policy,
        customs_policy: form.customs_policy,
        can_decide: form.can_decide,
        cannot_decide: form.cannot_decide,
        escalate_triggers: form.escalate_triggers,
        tracking_url: form.tracking_url,
      }))
    } finally {
      setSavingPolicies(false)
    }
  }

  const updateForm = (patch: Partial<PoliciesForm>) =>
    setForm((prev) => ({ ...prev, ...patch }))

  // ── Loading skeleton (stores still loading) ──
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

  const showSections = !!storeId && !policiesLoading && !scenariosLoading

  return (
    <div className="max-w-3xl mx-auto px-12 py-12">
      {/* Header */}
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
          Teach the AI agent about a store&rsquo;s brand, policies, and how to handle
          common support scenarios.
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
          {/* Store selector */}
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

          {!showSections ? (
            <div className="flex flex-col gap-10">
              <Skeleton className="h-52 w-full rounded-xl" />
              <Skeleton className="h-64 w-full rounded-xl" />
              <Skeleton className="h-72 w-full rounded-xl" />
            </div>
          ) : (
            <div className="flex flex-col gap-10">
              <FundamentSection
                values={form}
                canEdit={canEdit}
                isSaving={savingFundament}
                isDirty={fundamentDirty}
                isComplete={fundamentComplete}
                onChange={updateForm}
                onSave={() => void handleSaveFundament()}
              />

              <PoliciesSection
                values={form}
                canEdit={canEdit}
                isSaving={savingPolicies}
                isDirty={policiesDirty}
                isComplete={policiesComplete}
                onChange={updateForm}
                onSave={() => void handleSavePolicies()}
              />

              <ScenariosSection
                storeId={storeId}
                scenarios={scenarios ?? []}
                canEdit={canEdit}
                isComplete={scenariosComplete}
              />
            </div>
          )}
        </>
      )}
    </div>
  )
}
