'use client'

import { useRef, useState } from 'react'
import { Upload, X, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SettingsField } from '@/components/features/settings/settings-field'
import { useUploadSignatureLogo } from '@/hooks/settings/use-email-display'

interface LogoUploadProps {
  logoUrl: string | null
  logoWidth: number
  logoLinkUrl: string | null
  storeId: string
  onChange: (updates: { logoUrl?: string | null; logoWidth?: number; logoLinkUrl?: string | null }) => void
  disabled?: boolean
}

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp']
const MAX_SIZE = 2 * 1024 * 1024

export function LogoUpload({ logoUrl, logoWidth, logoLinkUrl, storeId, onChange, disabled }: LogoUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(logoUrl)
  const uploadMutation = useUploadSignatureLogo()

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (!ALLOWED_TYPES.includes(file.type)) {
      return
    }
    if (file.size > MAX_SIZE) {
      return
    }

    const reader = new FileReader()
    reader.onload = () => setPreview(reader.result as string)
    reader.readAsDataURL(file)

    uploadMutation.mutate(
      { file, storeId },
      {
        onSuccess: (data) => {
          onChange({ logoUrl: data.logoUrl })
          setPreview(data.logoUrl)
        },
      }
    )

    e.target.value = ''
  }

  function handleRemove() {
    onChange({ logoUrl: null })
    setPreview(null)
  }

  return (
    <div className="space-y-3">
      <SettingsField label="Signature Logo" htmlFor="logo-upload" hint="PNG, JPG, SVG, or WebP. Max 2MB.">
        {preview ? (
          <div className="flex items-start gap-3">
            <div className="rounded-md border border-border p-2 bg-white">
              <img
                src={preview}
                alt="Logo preview"
                style={{ width: logoWidth, maxWidth: '100%', height: 'auto' }}
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleRemove}
              disabled={disabled}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || uploadMutation.isPending}
            className="flex items-center justify-center gap-2 w-full py-6 border border-dashed border-border rounded-lg text-sm text-foreground-3 hover:border-border-hover hover:text-foreground-2 transition-colors"
          >
            {uploadMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            {uploadMutation.isPending ? 'Uploading...' : 'Click to upload logo'}
          </button>
        )}
        <input
          ref={fileInputRef}
          id="logo-upload"
          type="file"
          accept=".png,.jpg,.jpeg,.svg,.webp"
          className="hidden"
          onChange={handleFileSelect}
        />
      </SettingsField>

      {preview && (
        <>
          <SettingsField label="Logo Width" htmlFor="logo-width" hint="50–300px">
            <Input
              id="logo-width"
              type="number"
              min={50}
              max={300}
              value={logoWidth}
              onChange={(e) => onChange({ logoWidth: parseInt(e.target.value, 10) || 150 })}
              disabled={disabled}
              className="w-24"
            />
          </SettingsField>

          <SettingsField label="Logo Link URL" htmlFor="logo-link" hint="Optional. Where the logo links to when clicked.">
            <Input
              id="logo-link"
              type="url"
              placeholder="https://yourstore.com"
              value={logoLinkUrl ?? ''}
              onChange={(e) => onChange({ logoLinkUrl: e.target.value || null })}
              disabled={disabled}
            />
          </SettingsField>
        </>
      )}
    </div>
  )
}
