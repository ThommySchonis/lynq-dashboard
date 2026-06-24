'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Store } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { SettingsPageHeader } from '@/components/features/settings/settings-header'
import { SettingsEmptyState } from '@/components/features/settings/settings-empty-state'
import { DEFAULT_ACCENT_COLOR } from './email-display-card'
import { StoreSelectorPill } from './store-selector-pill'
import { SenderIdentityCard } from './sender-identity-card'
import { BrandingCard } from './branding-card'
import { SignatureCard } from './signature-card'
import { DisplayOptionsCard } from './display-options-card'
import { EmailPreview } from './email-preview'
import { useEmailDisplaySettings, useSaveEmailDisplaySettings } from '@/hooks/settings/use-email-display'
import { useEmailAccounts } from '@/hooks/settings/use-settings-data'
import { useStoreStore } from '@/stores/store'
import type { EmailDisplaySettings } from '@/types/settings'

export interface DisplayFormValues {
  displayName: string
  closingText: string
  signatureHtml: string
  logoUrl: string | null
  logoWidth: number
  logoLinkUrl: string | null
  isActive: boolean
  // Deferred / UI-only fields (Figma 984-38) — drive the live preview, not yet
  // persisted by the backend. Always seeded by EMPTY_FORM.
  replyToEmail: string
  accentColor: string
  showLogoInHeader: boolean
  showAgentName: boolean
  poweredByFooter: boolean
}

const EMPTY_FORM: DisplayFormValues = {
  displayName: '',
  closingText: '',
  signatureHtml: '',
  logoUrl: null,
  logoWidth: 150,
  logoLinkUrl: null,
  isActive: true,
  replyToEmail: '',
  accentColor: DEFAULT_ACCENT_COLOR,
  showLogoInHeader: true,
  showAgentName: true,
  poweredByFooter: false,
}

function settingsToForm(s: EmailDisplaySettings): DisplayFormValues {
  return {
    ...EMPTY_FORM,
    displayName: s.display_name ?? '',
    closingText: s.closing_text ?? '',
    signatureHtml: s.signature_html ?? '',
    logoUrl: s.logo_url,
    logoWidth: s.logo_width ?? 150,
    logoLinkUrl: s.logo_link_url,
    isActive: s.is_active,
  }
}

function sendingAddressFor(domain: string | null | undefined): string {
  const slug = (domain ?? 'your-store').replace(/\.myshopify\.com$/, '')
  return `${slug}@inbox.lynqflow.com`
}

export function EmailDisplaySettingsPage() {
  const router = useRouter()
  const stores = useStoreStore((s) => s.stores)
  const [pickedStoreId, setPickedStoreId] = useState<string | null>(null)
  const selectedStoreId = pickedStoreId ?? stores[0]?.id ?? null

  const { data: allSettings, isLoading } = useEmailDisplaySettings(selectedStoreId)
  const { data: emailAccounts } = useEmailAccounts()
  const saveMutation = useSaveEmailDisplaySettings(selectedStoreId)

  const storeSettings = useMemo(() => allSettings?.find((s) => !s.email_account_id) ?? null, [allSettings])
  const storeAccounts = useMemo(
    () => emailAccounts?.filter((a) => a.status !== 'disconnected') ?? [],
    [emailAccounts],
  )

  const [form, setForm] = useState<DisplayFormValues>(EMPTY_FORM)
  const [initForm, setInitForm] = useState<DisplayFormValues>(EMPTY_FORM)

  useEffect(() => {
    const values = storeSettings ? settingsToForm(storeSettings) : EMPTY_FORM
    setForm(values)
    setInitForm(values)
  }, [storeSettings])

  const isDirty = JSON.stringify(form) !== JSON.stringify(initForm)
  const saving = saveMutation.isPending

  const handleChange = (updates: Partial<DisplayFormValues>) => setForm((prev) => ({ ...prev, ...updates }))
  const handleDiscard = () => setForm(initForm)

  function persist(values: DisplayFormValues) {
    if (!selectedStoreId) return
    saveMutation.mutate({
      storeId: selectedStoreId,
      emailAccountId: null,
      displayName: values.displayName || null,
      closingText: values.closingText || null,
      signatureHtml: values.signatureHtml || null,
      logoUrl: values.logoUrl,
      logoWidth: values.logoWidth,
      logoLinkUrl: values.logoLinkUrl,
      isActive: values.isActive,
    })
  }

  const selectedStore = stores.find((s) => s.id === selectedStoreId)
  const description =
    stores.length === 0
      ? 'Connect a store first to configure email display settings.'
      : 'Configure how your outgoing emails appear to recipients.'

  return (
    <div className="mx-auto flex min-h-full max-w-[914px] flex-col gap-[22px] px-6 py-10">
      <SettingsPageHeader title="Email Display" description={description} />

      {stores.length === 0 ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="flex w-[440px] max-w-full flex-col items-center gap-2 rounded-2xl border border-settings-border bg-card px-10 py-9">
            <SettingsEmptyState
              Icon={Store}
              title="No stores connected"
              description="Go to Stores settings to add one."
            />
            <Button className="mt-2" onClick={() => router.push('/settings/workspace/stores')}>
              <Plus size={16} strokeWidth={1.75} />
              Connect store
            </Button>
          </div>
        </div>
      ) : (
        <>
          <StoreSelectorPill stores={stores} value={selectedStoreId} onChange={setPickedStoreId} />

          {isLoading ? (
            <div className="flex flex-col gap-3">
              <Skeleton className="h-48 w-full rounded-2xl" />
              <Skeleton className="h-40 w-full rounded-2xl" />
            </div>
          ) : (
            <>
              <div className="flex gap-6">
                <div className="flex min-w-0 flex-1 flex-col gap-5">
                  <SenderIdentityCard
                    displayName={form.displayName}
                    replyToEmail={form.replyToEmail}
                    sendingAddress={sendingAddressFor(selectedStore?.shopify_domain)}
                    onChange={handleChange}
                    disabled={saving}
                  />
                  <BrandingCard
                    logoUrl={form.logoUrl}
                    storeId={selectedStoreId!}
                    accentColor={form.accentColor}
                    showLogoInHeader={form.showLogoInHeader}
                    onChange={handleChange}
                    disabled={saving}
                  />
                  <SignatureCard
                    signatureHtml={form.signatureHtml}
                    closingText={form.closingText}
                    appendSignature={form.isActive}
                    onChange={handleChange}
                    disabled={saving}
                  />
                  <DisplayOptionsCard
                    showAgentName={form.showAgentName}
                    poweredByFooter={form.poweredByFooter}
                    onChange={handleChange}
                    disabled={saving}
                  />
                </div>

                <div className="sticky top-6 self-start">
                  <EmailPreview
                    displayName={form.displayName}
                    emailAddress={form.replyToEmail || storeAccounts[0]?.email || 'support@yourstore.com'}
                    accentColor={form.accentColor}
                    logoUrl={form.logoUrl}
                    showLogoInHeader={form.showLogoInHeader}
                    signatureHtml={form.signatureHtml}
                    poweredByFooter={form.poweredByFooter}
                    storeDomain={selectedStore?.shopify_domain ?? 'your-store.myshopify.com'}
                  />
                </div>
              </div>

              {isDirty && (
                <div className="sticky bottom-4 flex items-center justify-end gap-3 rounded-xl border border-settings-border bg-card px-4 py-3 shadow-card">
                  <Button variant="ghost" onClick={handleDiscard} disabled={saving}>
                    Discard
                  </Button>
                  <Button onClick={() => persist(form)} disabled={saving}>
                    {saving ? 'Saving…' : 'Save changes'}
                  </Button>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}
