'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
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
import { TimeTrackingSection } from './time-tracking-section'
import type { TimeTrackingValues } from './time-tracking-section'
import { DangerZoneSection } from './danger-zone-section'
import { PendingTransferBanner } from './pending-transfer-banner'
import { usePendingTransfer } from '@/hooks/settings/use-ownership-transfer'

interface IdentityState {
  name: string
  slug: string
  logoUrl: string | null
  logoPreview: string | null
  logoFile: File | null
  logoRemoved: boolean
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
  shift_target_seconds?: number
}

export function GeneralSettings() {
  const role = useAuthStore((s) => s.role)
  const currentUserId = useAuthStore((s) => s.user?.id)
  const isSuspended = useAuthStore((s) => s.isSuspended)

  const { data: ws, isLoading } = useWorkspace()
  const { data: pendingTransfer } = usePendingTransfer()

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
    logoRemoved: false,
  })
  const [slugError, setSlugError] = useState('')
  const [isSaving, setIsSaving] = useState(false)
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
  const [initPreferences, setInitPreferences] = useState<PreferencesValues>({
    show_order_data: WORKSPACE_DEFAULTS.show_order_data,
    auto_translate: WORKSPACE_DEFAULTS.auto_translate,
    allow_deletion: WORKSPACE_DEFAULTS.allow_deletion,
  })

  // ── Time tracking state ───────────────────────────────────────────────────────
  const [timeTracking, setTimeTracking] = useState<TimeTrackingValues>({
    shift_target_seconds: WORKSPACE_DEFAULTS.shift_target_seconds,
  })
  const [initTimeTracking, setInitTimeTracking] = useState<TimeTrackingValues>({
    shift_target_seconds: WORKSPACE_DEFAULTS.shift_target_seconds,
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
    setIdentity({ ...id, logoPreview: null, logoFile: null, logoRemoved: false })

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

    const tt: TimeTrackingValues = {
      shift_target_seconds: w.shift_target_seconds ?? WORKSPACE_DEFAULTS.shift_target_seconds,
    }
    setInitTimeTracking(tt)
    setTimeTracking(tt)
  }, [ws])

  // ── Dirty checks ─────────────────────────────────────────────────────────────
  const identityDirty =
    identity.name !== initIdentity.name ||
    identity.slug !== initIdentity.slug ||
    identity.logoFile !== null ||
    identity.logoRemoved

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

  const timeTrackingDirty =
    timeTracking.shift_target_seconds !== initTimeTracking.shift_target_seconds

  const canEdit = !isSuspended && (role === 'owner' || role === 'admin')
  const anyDirty = identityDirty || regionalDirty || preferencesDirty || timeTrackingDirty

  // ── Save / discard — one global save-bar for the whole page ───────────────────
  async function handleSaveAll() {
    if (!canEdit || !anyDirty) return
    setIsSaving(true)
    setSlugError('')
    try {
      if (identityDirty) {
        let newLogoUrl = identity.logoUrl

        if (identity.logoFile) {
          const result = await uploadLogo.mutateAsync(identity.logoFile)
          newLogoUrl = result.logo_url
          setIdentity((prev) => ({ ...prev, logoFile: null, logoPreview: null, logoUrl: newLogoUrl }))
        } else if (identity.logoRemoved) {
          await deleteLogo.mutateAsync()
          newLogoUrl = null
          setIdentity((prev) => ({ ...prev, logoRemoved: false, logoUrl: null }))
        }

        // Send only the fields that actually changed. Omitted fields stay unchanged
        // server-side (the RPC COALESCEs NULL params to the existing value).
        const patch: Record<string, unknown> = {}
        if (identity.name !== initIdentity.name) patch.name = identity.name
        if (identity.slug !== initIdentity.slug) patch.slug = identity.slug
        if (Object.keys(patch).length > 0) {
          await updateWorkspace.mutateAsync(patch)
        }

        setInitIdentity({ name: identity.name, slug: identity.slug, logoUrl: newLogoUrl })
      }

      if (regionalDirty) {
        await updateWorkspace.mutateAsync({
          timezone: regional.timezone,
          locale: regional.locale,
          date_format: regional.date_format,
          time_format: regional.time_format,
          first_day_of_week: regional.first_day_of_week,
        })
        setInitRegional({ ...regional })
      }

      if (preferencesDirty) {
        await updateWorkspace.mutateAsync({ ...preferences })
        setInitPreferences({ ...preferences })
      }

      if (timeTrackingDirty) {
        await updateWorkspace.mutateAsync({ ...timeTracking })
        setInitTimeTracking({ ...timeTracking })
      }
    } catch (err) {
      if (err instanceof Error && err.message.includes('taken')) {
        setSlugError('This URL is already taken')
        toast.error('This URL is already taken')
      }
      // mutations show their own toasts on error
    } finally {
      setIsSaving(false)
    }
  }

  function handleDiscard() {
    if (!anyDirty) return
    setIdentity({ ...initIdentity, logoPreview: null, logoFile: null, logoRemoved: false })
    setRegional({ ...initRegional })
    setPreferences({ ...initPreferences })
    setTimeTracking({ ...initTimeTracking })
    setSlugError('')
  }

  // ── Loading skeleton ─────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="mx-auto max-w-[800px] px-6 py-10 space-y-5">
        <div className="space-y-2">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-96" />
        </div>
        <Skeleton className="h-52 w-full rounded-2xl" />
        <Skeleton className="h-72 w-full rounded-2xl" />
        <Skeleton className="h-44 w-full rounded-2xl" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[800px] px-6 py-10">
      <div className="flex flex-col gap-5">
        {/* Header + global save bar */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-foreground leading-tight mb-1">General</h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Manage your workspace identity, regional preferences and global settings.
            </p>
          </div>
          {canEdit && (
            <div className="flex items-center gap-2.5 flex-shrink-0">
              <Button
                variant="outline"
                onClick={handleDiscard}
                disabled={!anyDirty || isSaving}
              >
                Discard
              </Button>
              <Button
                onClick={() => void handleSaveAll()}
                disabled={!anyDirty || isSaving}
              >
                {isSaving ? 'Saving…' : 'Save changes'}
              </Button>
            </div>
          )}
        </div>

        {currentUserId && pendingTransfer && (
          <PendingTransferBanner
            transfer={pendingTransfer}
            currentUserId={currentUserId}
          />
        )}

        <IdentitySection
          values={identity}
          slugError={slugError}
          canEdit={canEdit}
          onChange={(patch) => {
            setIdentity((prev) => ({ ...prev, ...patch }))
            if ('slug' in patch) setSlugError('')
          }}
        />

        <RegionalSection
          values={regional}
          canEdit={canEdit}
          onChange={(patch) => setRegional((prev) => ({ ...prev, ...patch }))}
        />

        <PreferencesSection
          values={preferences}
          canEdit={canEdit}
          onChange={(patch) => setPreferences((prev) => ({ ...prev, ...patch }))}
        />

        <TimeTrackingSection
          values={timeTracking}
          canEdit={canEdit}
          onChange={(patch) => setTimeTracking((prev) => ({ ...prev, ...patch }))}
        />

        <DangerZoneSection
          role={role}
          currentUserId={currentUserId}
        />
      </div>
    </div>
  )
}
