'use client'

import { useState } from 'react'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/features/settings/status-badge'
import { EmailDisplayForm, type DisplayFormValues } from './email-display-form'
import type { EmailAccount, EmailDisplaySettings } from '@/types/settings'

interface AccountOverridesProps {
  accounts: EmailAccount[]
  overrides: EmailDisplaySettings[]
  storeDefaults: DisplayFormValues
  storeId: string
  onSave: (accountId: string, values: DisplayFormValues) => void
  onDelete: (settingsId: string) => void
  isSaving: boolean
}

export function AccountOverrides({
  accounts,
  overrides,
  storeDefaults,
  storeId,
  onSave,
  onDelete,
  isSaving,
}: AccountOverridesProps) {
  if (accounts.length === 0) return null

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-foreground-2">Account Overrides</h3>
      <p className="text-xs text-foreground-3">
        Override store defaults for specific email accounts.
      </p>
      <div className="space-y-2">
        {accounts.map((account) => {
          const override = overrides.find((o) => o.email_account_id === account.id)
          return (
            <AccountOverrideRow
              key={account.id}
              account={account}
              override={override ?? null}
              storeDefaults={storeDefaults}
              storeId={storeId}
              onSave={(values) => onSave(account.id, values)}
              onDelete={override ? () => onDelete(override.id) : undefined}
              isSaving={isSaving}
            />
          )
        })}
      </div>
    </div>
  )
}

interface AccountOverrideRowProps {
  account: EmailAccount
  override: EmailDisplaySettings | null
  storeDefaults: DisplayFormValues
  storeId: string
  onSave: (values: DisplayFormValues) => void
  onDelete?: () => void
  isSaving: boolean
}

function AccountOverrideRow({
  account,
  override,
  storeDefaults,
  storeId,
  onSave,
  onDelete,
  isSaving,
}: AccountOverrideRowProps) {
  const [enabled, setEnabled] = useState(!!override)
  const [form, setForm] = useState<DisplayFormValues>(
    override
      ? {
          displayName: override.display_name ?? '',
          closingText: override.closing_text ?? '',
          signatureHtml: override.signature_html ?? '',
          logoUrl: override.logo_url,
          logoWidth: override.logo_width ?? 150,
          logoLinkUrl: override.logo_link_url,
          isActive: override.is_active,
        }
      : { ...storeDefaults }
  )

  function handleToggle(checked: boolean) {
    setEnabled(checked)
    if (!checked && onDelete) {
      onDelete()
    }
  }

  function handleChange(updates: Partial<DisplayFormValues>) {
    setForm((prev) => ({ ...prev, ...updates }))
  }

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium">{account.email || account.provider}</span>
          <StatusBadge status={account.status} />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-foreground-3">Custom settings</span>
          <Switch checked={enabled} onCheckedChange={handleToggle} />
        </div>
      </div>

      {enabled && (
        <div className="px-4 pb-4 pt-2 border-t border-border">
          <EmailDisplayForm
            values={form}
            storeId={storeId}
            onChange={handleChange}
          />
          <div className="flex justify-end mt-4">
            <Button
              onClick={() => onSave(form)}
              disabled={isSaving}
              size="sm"
            >
              Save Override
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
