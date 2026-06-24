'use client'

import { useRef } from 'react'
import { ImageIcon, Loader2 } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { useUploadSignatureLogo } from '@/hooks/settings/use-email-display'
import { EmailDisplayCard, EmailDisplayToggleRow } from './email-display-card'
import { isValidLogoFile } from './logo-upload-utils'

interface BrandingCardProps {
  logoUrl: string | null
  storeId: string
  accentColor: string
  showLogoInHeader: boolean
  onChange: (updates: {
    logoUrl?: string | null
    accentColor?: string
    showLogoInHeader?: boolean
  }) => void
  disabled?: boolean
}

export function BrandingCard({
  logoUrl,
  storeId,
  accentColor,
  showLogoInHeader,
  onChange,
  disabled,
}: BrandingCardProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const uploadMutation = useUploadSignatureLogo()

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !isValidLogoFile(file)) {
      e.target.value = ''
      return
    }
    uploadMutation.mutate(
      { file, storeId },
      { onSuccess: (data) => onChange({ logoUrl: data.logoUrl }) },
    )
    e.target.value = ''
  }

  return (
    <EmailDisplayCard title="Branding">
      <div className="flex flex-col gap-4">
        {/* Store logo */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center overflow-hidden rounded-[9px] bg-accent-soft">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt="Store logo" className="size-full object-contain" />
              ) : (
                <ImageIcon size={20} strokeWidth={1.75} className="text-primary" />
              )}
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-semibold text-foreground">Store logo</span>
              <span className="text-xs font-medium text-foreground-3">PNG or SVG, up to 1 MB</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled || uploadMutation.isPending}
              className="flex items-center gap-1.5 rounded-[9px] border border-settings-border bg-card px-3.5 py-2 text-xs font-semibold text-foreground-2 transition-colors hover:bg-foreground/[0.03] disabled:opacity-50"
            >
              {uploadMutation.isPending && <Loader2 size={13} className="animate-spin" />}
              Replace
            </button>
            {logoUrl && (
              <button
                type="button"
                onClick={() => onChange({ logoUrl: null })}
                disabled={disabled}
                className="text-xs font-medium text-foreground-3 transition-colors hover:text-foreground disabled:opacity-50"
              >
                Remove
              </button>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".png,.jpg,.jpeg,.svg,.webp"
            className="hidden"
            onChange={handleFileSelect}
          />
        </div>

        <div className="h-px w-full bg-settings-border" />

        {/* Accent color */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-semibold text-foreground">Accent color</span>
            <span className="text-xs font-medium text-foreground-3">Used for buttons and links in emails</span>
          </div>
          <label className="flex cursor-pointer items-center gap-2 rounded-[9px] border border-settings-border bg-card py-1.5 pl-2 pr-3">
            <span className="size-5 rounded-md" style={{ backgroundColor: accentColor }} />
            <span className="text-sm font-semibold uppercase text-foreground-2">{accentColor}</span>
            <input
              type="color"
              value={accentColor}
              onChange={(e) => onChange({ accentColor: e.target.value })}
              disabled={disabled}
              className="sr-only"
            />
          </label>
        </div>

        <EmailDisplayToggleRow
          title="Show store logo in email header"
          control={
            <Switch
              checked={showLogoInHeader}
              onCheckedChange={(v) => onChange({ showLogoInHeader: v })}
              disabled={disabled}
            />
          }
        />
      </div>
    </EmailDisplayCard>
  )
}
