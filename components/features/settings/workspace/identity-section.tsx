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
import { SettingsSection, SettingsCard } from '@/components/features/settings/settings-section'
import { SettingsField } from '@/components/features/settings/settings-field'
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
  isSaving: boolean
  isDirty: boolean
  onChange: (patch: Partial<IdentityValues>) => void
  onSave: () => void
}

export function IdentitySection({
  values,
  slugError,
  canEdit,
  isSaving,
  isDirty,
  onChange,
  onSave,
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
    <SettingsSection
      title="Workspace identity"
      description="Your workspace name, URL, and logo are shown to all members."
    >
      <SettingsCard
        footer={
          canEdit ? (
            <Button onClick={onSave} disabled={!isDirty || isSaving}>
              {isSaving ? 'Saving…' : 'Save changes'}
            </Button>
          ) : undefined
        }
      >
        <div className="flex flex-col gap-5">
          <SettingsField label="Workspace name" htmlFor="ws-name">
            <Input
              id="ws-name"
              type="text"
              value={values.name}
              onChange={(e) => onChange({ name: e.target.value })}
              placeholder="Your workspace name"
              disabled={!canEdit}
            />
          </SettingsField>

          <SettingsField
            label="Workspace URL"
            htmlFor="ws-slug"
            hint="lynqflow.app/your-workspace"
            error={slugError}
          >
            <InputGroup>
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
          </SettingsField>

          <SettingsField
            label="Workspace logo"
            hint="PNG or JPG, max 2 MB, square recommended"
          >
            <div className="flex items-center gap-5 mt-1">
              <div className="size-20 rounded-xl border border-border overflow-hidden shrink-0 flex items-center justify-center bg-muted/40">
                {displayLogo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={displayLogo}
                    alt="Workspace logo"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <ImageIcon size={24} strokeWidth={1.5} className="text-muted-foreground/50" />
                )}
              </div>
              {canEdit && (
                <div className="flex flex-col gap-2">
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
          </SettingsField>
        </div>
      </SettingsCard>
    </SettingsSection>
  )
}
