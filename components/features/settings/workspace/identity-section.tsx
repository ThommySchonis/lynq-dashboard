'use client'

import { useRef } from 'react'
import { ImageIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupText,
  InputGroupInput,
} from '@/components/ui/input-group'
import { SettingsPanel, SettingsRow } from '@/components/features/settings/settings-panel'
import { toast } from 'sonner'

interface IdentityValues {
  name: string
  slug: string
  /** Current saved logo URL (from server) */
  logoUrl: string | null
  /** Local preview data-URL set after file selection */
  logoPreview: string | null
  logoFile: File | null
  /** True when the user explicitly removed the existing logo */
  logoRemoved: boolean
}

interface IdentitySectionProps {
  values: IdentityValues
  slugError?: string
  canEdit: boolean
  onChange: (patch: Partial<IdentityValues>) => void
}

export function IdentitySection({
  values,
  slugError,
  canEdit,
  onChange,
}: IdentitySectionProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const displayLogo = values.logoRemoved ? null : (values.logoPreview ?? values.logoUrl)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image must be under 2 MB')
      return
    }
    const reader = new FileReader()
    reader.onload = (ev) => {
      onChange({ logoFile: file, logoPreview: ev.target?.result as string, logoRemoved: false })
    }
    reader.readAsDataURL(file)
  }

  function handleRemoveLogo() {
    onChange({ logoFile: null, logoPreview: null, logoRemoved: true })
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <SettingsPanel
      title="Workspace identity"
      description="Your workspace name, URL and logo are shown to all members."
    >
      <SettingsRow
        label="Workspace name"
        hint="The name shown across your workspace."
        htmlFor="ws-name"
      >
        <Input
          id="ws-name"
          type="text"
          value={values.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="Your workspace name"
          disabled={!canEdit}
          className="w-[300px]"
        />
      </SettingsRow>

      <SettingsRow
        label="Workspace URL"
        hint="Your unique Lynq address — lynqflow.app/your-workspace."
        error={slugError}
        htmlFor="ws-slug"
      >
        <InputGroup className="w-[300px]">
          <InputGroupAddon align="inline-start">
            <InputGroupText>lynqflow.app/</InputGroupText>
          </InputGroupAddon>
          <InputGroupInput
            id="ws-slug"
            type="text"
            value={values.slug}
            onChange={(e) => {
              const slug = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')
              onChange({ slug })
            }}
            placeholder="your-workspace"
            disabled={!canEdit}
          />
        </InputGroup>
      </SettingsRow>

      <SettingsRow
        label="Workspace logo"
        hint="PNG or JPG · max 2 MB · square recommended."
      >
        <div className="flex items-center gap-3">
          <div className="size-14 rounded-xl border border-dashed border-border overflow-hidden shrink-0 flex items-center justify-center bg-muted/40">
            {displayLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={displayLogo}
                alt="Workspace logo"
                className="w-full h-full object-cover"
              />
            ) : (
              <ImageIcon size={22} strokeWidth={1.5} className="text-muted-foreground/50" />
            )}
          </div>
          {canEdit && (
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={handleFileChange}
              />
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={() => fileInputRef.current?.click()}
              >
                Upload image
              </Button>
              {displayLogo && (
                <Button
                  variant="ghost"
                  size="sm"
                  type="button"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={handleRemoveLogo}
                >
                  Remove
                </Button>
              )}
            </div>
          )}
        </div>
      </SettingsRow>
    </SettingsPanel>
  )
}
