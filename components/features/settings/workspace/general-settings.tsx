'use client'

import { useState, useEffect } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuthStore } from '@/stores/auth'
import { useWorkspace, useUpdateWorkspace, useUploadLogo, useDeleteLogo } from '@/hooks/settings'
import { WORKSPACE_DEFAULTS } from '@/lib/settings-constants'
import { toast } from 'sonner'
import { IdentitySection } from './identity-section'
import { RegionalSection } from './regional-section'
import type { RegionalValues } from './regional-section'
import { PreferencesSection } from './preferences-section'
import type { PreferencesValues } from './preferences-section'
import { DangerZoneSection } from './danger-zone-section'

interface IdentityState {
  name: string
  slug: string
  logoUrl: string | null
  logoPreview: string | null
  logoFile: File | null
}

interface GeneralSettingsWorkspace {
  name?: string
  slug?: string
  logo_url?: string | null
  timezone?: string
  locale?: string
  date_format?: string
  time_format?: string
  first_day_of_week?: string
  show_order_data?: boolean
  auto_translate?: boolean
  allow_deletion?: boolean
}

export function GeneralSettings() {
  const role = useAuthStore((s) => s.role)

  const { data: ws, isLoading } = useWorkspace()

  const updateWorkspace = useUpdateWorkspace()
  const uploadLogo = useUploadLogo()
  const deleteLogo = useDeleteLogo()

  // ── Identity state ──────────────────────────────────────────────────────────
  const [identity, setIdentity] = useState<IdentityState>({
    name: '',
    slug: '',
    logoUrl: null,
    logoPreview: null,
    logoFile: null,
  })
  const [slugError, setSlugError] = useState('')
  const [savingIdentity, setSavingIdentity] = useState(false)
  const [initIdentity, setInitIdentity] = useState<Pick<IdentityState, 'name' | 'slug' | 'logoUrl'>>({
    name: '',
    slug: '',
    logoUrl: null,
  })

  // ── Regional state ──────────────────────────────────────────────────────────
  const [regional, setRegional] = useState<RegionalValues>({
    timezone: WORKSPACE_DEFAULTS.timezone,
    locale: WORKSPACE_DEFAULTS.locale,
    date_format: WORKSPACE_DEFAULTS.date_format,
    time_format: WORKSPACE_DEFAULTS.time_format,
    first_day_of_week: WORKSPACE_DEFAULTS.first_day_of_week,
  })
  const [savingRegional, setSavingRegional] = useState(false)
  const [initRegional, setInitRegional] = useState<RegionalValues>({
    timezone: WORKSPACE_DEFAULTS.timezone,
    locale: WORKSPACE_DEFAULTS.locale,
    date_format: WORKSPACE_DEFAULTS.date_format,
    time_format: WORKSPACE_DEFAULTS.time_format,
    first_day_of_week: WORKSPACE_DEFAULTS.first_day_of_week,
  })

  // ── Preferences state ───────────────────────────────────────────────────────
  const [preferences, setPreferences] = useState<PreferencesValues>({
    show_order_data: WORKSPACE_DEFAULTS.show_order_data,
    auto_translate: WORKSPACE_DEFAULTS.auto_translate,
    allow_deletion: WORKSPACE_DEFAULTS.allow_deletion,
  })
  const [savingPreferences, setSavingPreferences] = useState(false)
  const [initPreferences, setInitPreferences] = useState<PreferencesValues>({
    show_order_data: WORKSPACE_DEFAULTS.show_order_data,
    auto_translate: WORKSPACE_DEFAULTS.auto_translate,
    allow_deletion: WORKSPACE_DEFAULTS.allow_deletion,
  })

  // ── Seed form state from server data ────────────────────────────────────────
  useEffect(() => {
    if (!ws) return
    const w = ws as GeneralSettingsWorkspace

    const id = {
      name: w.name ?? '',
      slug: w.slug ?? '',
      logoUrl: w.logo_url ?? null,
    }
    setInitIdentity(id)
    setIdentity({ ...id, logoPreview: null, logoFile: null })

    const reg: RegionalValues = {
      timezone: w.timezone ?? WORKSPACE_DEFAULTS.timezone,
      locale: w.locale ?? WORKSPACE_DEFAULTS.locale,
      date_format: w.date_format ?? WORKSPACE_DEFAULTS.date_format,
      time_format: w.time_format ?? WORKSPACE_DEFAULTS.time_format,
      first_day_of_week: w.first_day_of_week ?? WORKSPACE_DEFAULTS.first_day_of_week,
    }
    setInitRegional(reg)
    setRegional(reg)

    const prefs: PreferencesValues = {
      show_order_data: w.show_order_data ?? WORKSPACE_DEFAULTS.show_order_data,
      auto_translate: w.auto_translate ?? WORKSPACE_DEFAULTS.auto_translate,
      allow_deletion: w.allow_deletion ?? WORKSPACE_DEFAULTS.allow_deletion,
    }
    setInitPreferences(prefs)
    setPreferences(prefs)
  }, [ws])

  // ── Dirty checks ─────────────────────────────────────────────────────────────
  const identityDirty =
    identity.name !== initIdentity.name ||
    identity.slug !== initIdentity.slug ||
    identity.logoFile !== null ||
    (identity.logoPreview === null && initIdentity.logoUrl !== null)

  const regionalDirty =
    regional.timezone !== initRegional.timezone ||
    regional.locale !== initRegional.locale ||
    regional.date_format !== initRegional.date_format ||
    regional.time_format !== initRegional.time_format ||
    regional.first_day_of_week !== initRegional.first_day_of_week

  const preferencesDirty =
    preferences.show_order_data !== initPreferences.show_order_data ||
    preferences.auto_translate !== initPreferences.auto_translate ||
    preferences.allow_deletion !== initPreferences.allow_deletion

  const canEdit = role === 'owner' || role === 'admin'

  // ── Save handlers ─────────────────────────────────────────────────────────────
  async function handleSaveIdentity() {
    if (!canEdit) return
    setSavingIdentity(true)
    setSlugError('')
    try {
      let newLogoUrl = identity.logoUrl

      if (identity.logoFile) {
        const result = await uploadLogo.mutateAsync(identity.logoFile)
        newLogoUrl = result.logo_url
        setIdentity((prev) => ({ ...prev, logoFile: null, logoUrl: newLogoUrl }))
      } else if (identity.logoPreview === null && initIdentity.logoUrl !== null) {
        await deleteLogo.mutateAsync()
        newLogoUrl = null
        setIdentity((prev) => ({ ...prev, logoUrl: null }))
      }

      await updateWorkspace.mutateAsync({ name: identity.name, slug: identity.slug })
      setInitIdentity({ name: identity.name, slug: identity.slug, logoUrl: newLogoUrl })
    } catch (err) {
      if (err instanceof Error && err.message.includes('taken')) {
        setSlugError('This URL is already taken')
        toast.error('This URL is already taken')
      }
      // mutations show their own toasts on error
    } finally {
      setSavingIdentity(false)
    }
  }

  async function handleSaveRegional() {
    if (!canEdit) return
    setSavingRegional(true)
    try {
      await updateWorkspace.mutateAsync({
        timezone: regional.timezone,
        locale: regional.locale,
        date_format: regional.date_format,
        time_format: regional.time_format,
        first_day_of_week: regional.first_day_of_week,
      })
      setInitRegional({ ...regional })
    } finally {
      setSavingRegional(false)
    }
  }

  async function handleSavePreferences() {
    if (!canEdit) return
    setSavingPreferences(true)
    try {
      await updateWorkspace.mutateAsync({ ...preferences })
      setInitPreferences({ ...preferences })
    } finally {
      setSavingPreferences(false)
    }
  }

  function handleTransfer() {
    toast.success('Transfer initiated')
  }

  function handleDelete() {
    toast.error('Workspace deletion scheduled')
  }

  // ── Loading skeleton ─────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto px-12 py-12 space-y-10">
        <div className="space-y-2 pb-6 border-b border-border">
          <Skeleton className="h-3.5 w-28" />
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-3.5 w-80" />
        </div>
        <Skeleton className="h-52 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-12 py-12">
      {/* Header */}
      <div className="pb-6 mb-8 border-b border-border">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1.5 flex-wrap">
          <span>Settings</span>
          <span>/</span>
          <span>Workspace</span>
          <span>/</span>
          <span>General</span>
        </div>
        <h1 className="text-[28px] font-semibold text-foreground leading-tight mb-1">General</h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Manage your workspace identity, regional preferences, and global settings.
        </p>
      </div>

      <div className="flex flex-col gap-10">
        <IdentitySection
          values={identity}
          slugError={slugError}
          canEdit={canEdit}
          isSaving={savingIdentity}
          isDirty={identityDirty}
          onChange={(patch) => {
            setIdentity((prev) => ({ ...prev, ...patch }))
            if ('slug' in patch) setSlugError('')
          }}
          onSave={() => void handleSaveIdentity()}
        />

        <RegionalSection
          values={regional}
          canEdit={canEdit}
          isSaving={savingRegional}
          isDirty={regionalDirty}
          onChange={(patch) => setRegional((prev) => ({ ...prev, ...patch }))}
          onSave={() => void handleSaveRegional()}
        />

        <PreferencesSection
          values={preferences}
          canEdit={canEdit}
          isSaving={savingPreferences}
          isDirty={preferencesDirty}
          onChange={(patch) => setPreferences((prev) => ({ ...prev, ...patch }))}
          onSave={() => void handleSavePreferences()}
        />

        <DangerZoneSection
          role={role}
          onTransfer={handleTransfer}
          onDelete={handleDelete}
        />
      </div>
    </div>
  )
}
