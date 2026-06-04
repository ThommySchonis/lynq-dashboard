'use client'

import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { SettingsField } from '@/components/features/settings/settings-field'
import { SignatureEditor } from './signature-editor'
import { LogoUpload } from './logo-upload'

export interface DisplayFormValues {
  displayName: string
  closingText: string
  signatureHtml: string
  logoUrl: string | null
  logoWidth: number
  logoLinkUrl: string | null
  isActive: boolean
}

interface EmailDisplayFormProps {
  values: DisplayFormValues
  storeId: string
  onChange: (updates: Partial<DisplayFormValues>) => void
  disabled?: boolean
}

export function EmailDisplayForm({ values, storeId, onChange, disabled }: EmailDisplayFormProps) {
  return (
    <div className="space-y-5">
      <SettingsField label="Sender Display Name" htmlFor="display-name" hint="The name recipients see in their inbox (e.g. 'Acme Support Team')">
        <Input
          id="display-name"
          value={values.displayName}
          onChange={(e) => onChange({ displayName: e.target.value })}
          placeholder="Support Team"
          disabled={disabled}
        />
      </SettingsField>

      <SettingsField label="Closing Text" htmlFor="closing-text" hint="Text before the signature (e.g. 'Best regards,')">
        <Input
          id="closing-text"
          value={values.closingText}
          onChange={(e) => onChange({ closingText: e.target.value })}
          placeholder="Best regards,"
          disabled={disabled}
        />
      </SettingsField>

      <LogoUpload
        logoUrl={values.logoUrl}
        logoWidth={values.logoWidth}
        logoLinkUrl={values.logoLinkUrl}
        storeId={storeId}
        onChange={(updates) => onChange(updates)}
        disabled={disabled}
      />

      <SettingsField label="Signature Content" htmlFor="signature-editor" hint="Rich text signature appended to outgoing emails">
        <SignatureEditor
          value={values.signatureHtml}
          onChange={(html) => onChange({ signatureHtml: html })}
          disabled={disabled}
        />
      </SettingsField>

      <div className="flex items-center gap-3">
        <Switch
          id="signature-active"
          checked={values.isActive}
          onCheckedChange={(checked) => onChange({ isActive: checked })}
          disabled={disabled}
        />
        <label htmlFor="signature-active" className="text-sm text-foreground-2">
          Enable signature on outgoing emails
        </label>
      </div>
    </div>
  )
}
