'use client'

import { useState, useEffect, useMemo } from 'react'
import { SettingsSection, SettingsCard } from '@/components/features/settings/settings-section'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { EmailDisplayForm, type DisplayFormValues } from './email-display-form'
import { EmailPreview } from './email-preview'
import { AccountOverrides } from './account-overrides'
import {
  useEmailDisplaySettings,
  useSaveEmailDisplaySettings,
  useDeleteEmailDisplaySettings,
} from '@/hooks/settings/use-email-display'
import { useEmailAccounts } from '@/hooks/settings/use-settings-data'
import { useStoreStore } from '@/stores/store'
import type { EmailDisplaySettings } from '@/types/settings'

const EMPTY_FORM: DisplayFormValues = {
  displayName: '',
  closingText: '',
  signatureHtml: '',
  logoUrl: null,
  logoWidth: 150,
  logoLinkUrl: null,
  isActive: true,
}

function settingsToForm(s: EmailDisplaySettings): DisplayFormValues {
  return {
    displayName: s.display_name ?? '',
    closingText: s.closing_text ?? '',
    signatureHtml: s.signature_html ?? '',
    logoUrl: s.logo_url,
    logoWidth: s.logo_width ?? 150,
    logoLinkUrl: s.logo_link_url,
    isActive: s.is_active,
  }
}

export function EmailDisplaySettingsPage() {
  const stores = useStoreStore((s) => s.stores)
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null)

  useEffect(() => {
    if (!selectedStoreId && stores.length > 0) {
      setSelectedStoreId(stores[0].id)
    }
  }, [stores, selectedStoreId])

  const { data: allSettings, isLoading } = useEmailDisplaySettings(selectedStoreId)
  const { data: emailAccounts } = useEmailAccounts()
  const saveMutation = useSaveEmailDisplaySettings(selectedStoreId)
  const deleteMutation = useDeleteEmailDisplaySettings(selectedStoreId)

  const storeSettings = useMemo(
    () => allSettings?.find((s) => !s.email_account_id) ?? null,
    [allSettings]
  )

  const accountOverrides = useMemo(
    () => allSettings?.filter((s) => s.email_account_id) ?? [],
    [allSettings]
  )

  const storeAccounts = useMemo(
    () => emailAccounts?.filter((a) => a.status !== 'disconnected') ?? [],
    [emailAccounts]
  )

  const [form, setForm] = useState<DisplayFormValues>(EMPTY_FORM)
  const [initForm, setInitForm] = useState<DisplayFormValues>(EMPTY_FORM)

  useEffect(() => {
    if (storeSettings) {
      const values = settingsToForm(storeSettings)
      setForm(values)
      setInitForm(values)
    } else {
      setForm(EMPTY_FORM)
      setInitForm(EMPTY_FORM)
    }
  }, [storeSettings])

  const isDirty = JSON.stringify(form) !== JSON.stringify(initForm)

  function handleChange(updates: Partial<DisplayFormValues>) {
    setForm((prev) => ({ ...prev, ...updates }))
  }

  function handleSave() {
    if (!selectedStoreId) return
    saveMutation.mutate({
      storeId: selectedStoreId,
      emailAccountId: null,
      displayName: form.displayName || null,
      closingText: form.closingText || null,
      signatureHtml: form.signatureHtml || null,
      logoUrl: form.logoUrl,
      logoWidth: form.logoWidth,
      logoLinkUrl: form.logoLinkUrl,
      isActive: form.isActive,
    })
  }

  function handleDiscard() {
    setForm(initForm)
  }

  function handleAccountSave(accountId: string, values: DisplayFormValues) {
    if (!selectedStoreId) return
    saveMutation.mutate({
      storeId: selectedStoreId,
      emailAccountId: accountId,
      displayName: values.displayName || null,
      closingText: values.closingText || null,
      signatureHtml: values.signatureHtml || null,
      logoUrl: values.logoUrl,
      logoWidth: values.logoWidth,
      logoLinkUrl: values.logoLinkUrl,
      isActive: values.isActive,
    })
  }

  function handleOverrideDelete(id: string) {
    deleteMutation.mutate(id)
  }

  if (stores.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-10 py-12">
        <SettingsSection
          title="Email Display"
          description="Connect a store first to configure email display settings."
        >
          <SettingsCard>
            <p className="text-sm text-foreground-3 py-8 text-center">
              No stores connected. Go to Stores settings to add one.
            </p>
          </SettingsCard>
        </SettingsSection>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-10 py-12">
    <SettingsSection
      title="Email Display"
      description="Configure how your outgoing emails appear to recipients."
    >
      {/* Store selector */}
      {stores.length > 1 && (
        <div className="mb-6">
          <Select value={selectedStoreId ?? ''} onValueChange={setSelectedStoreId}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Select store" />
            </SelectTrigger>
            <SelectContent>
              {stores.map((store) => (
                <SelectItem key={store.id} value={store.id}>
                  {store.name || store.shopify_domain}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {isLoading ? (
        <SettingsCard>
          <div className="space-y-4 py-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        </SettingsCard>
      ) : (
        <>
          {/* Store-level form */}
          <SettingsCard>
            <EmailDisplayForm
              values={form}
              storeId={selectedStoreId!}
              onChange={handleChange}
              disabled={saveMutation.isPending}
            />
          </SettingsCard>

          {/* Live preview */}
          <div className="mt-6">
            <EmailPreview
              displayName={form.displayName}
              emailAddress={storeAccounts[0]?.email ?? 'support@yourstore.com'}
              closingText={form.closingText}
              logoUrl={form.logoUrl}
              logoWidth={form.logoWidth}
              logoLinkUrl={form.logoLinkUrl}
              signatureHtml={form.signatureHtml}
            />
          </div>

          {/* Account overrides */}
          {storeAccounts.length > 0 && (
            <div className="mt-6">
              <AccountOverrides
                accounts={storeAccounts}
                overrides={accountOverrides}
                storeDefaults={form}
                storeId={selectedStoreId!}
                onSave={handleAccountSave}
                onDelete={handleOverrideDelete}
                isSaving={saveMutation.isPending}
              />
            </div>
          )}

          {/* Save bar */}
          {isDirty && (
            <div className="sticky bottom-0 mt-6 flex items-center justify-end gap-3 border-t border-border bg-background px-4 py-3 -mx-4 -mb-4 rounded-b-lg">
              <Button variant="ghost" onClick={handleDiscard} disabled={saveMutation.isPending}>
                Discard
              </Button>
              <Button onClick={handleSave} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          )}
        </>
      )}
    </SettingsSection>
    </div>
  )
}
