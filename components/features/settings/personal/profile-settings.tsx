'use client'

import { useState, useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { SettingsSection, SettingsCard } from '@/components/features/settings/settings-section'
import { SettingsField } from '@/components/features/settings/settings-field'
import { AvatarUpload } from './avatar-upload'
import { ThemeSelector } from './theme-selector'
import { LegalLinksSection } from './legal-links-section'
import {
  useProfile,
  useUpdateProfile,
  useUploadAvatar,
  useDeleteAvatar,
} from '@/hooks/settings'
import { useAuthStore } from '@/stores/auth'
import { useThemeStore } from '@/stores/theme'
import type { Theme } from '@/types/settings'

interface FormState {
  displayName: string
  bio: string
  theme: Theme
}

/**
 * Apply a profile theme choice to the live theme store (which drives the
 * `.dark` class via ThemeSync). The store only holds light/dark, so 'system'
 * is resolved against the OS preference at selection time.
 */
function applyResolvedTheme(theme: Theme) {
  const resolved =
    theme === 'system'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
      : theme
  useThemeStore.getState().setTheme(resolved)
}

export function ProfileSettings() {
  const isSuspended = useAuthStore((s) => s.isSuspended)
  const { data: profile, isLoading } = useProfile()

  const updateProfile = useUpdateProfile()
  const uploadAvatar = useUploadAvatar()
  const deleteAvatar = useDeleteAvatar()

  const [form, setForm] = useState<FormState>({
    displayName: '',
    bio: '',
    theme: 'system',
  })
  const [initForm, setInitForm] = useState<FormState>({
    displayName: '',
    bio: '',
    theme: 'system',
  })
  const [nameError, setNameError] = useState<string | null>(null)

  // Seed form when profile data loads
  useEffect(() => {
    if (!profile) return
    const initial: FormState = {
      displayName: profile.display_name ?? '',
      bio: profile.bio ?? '',
      theme: (profile.theme as Theme) ?? 'system',
    }
    setTimeout(() => {
      setInitForm(initial)
      setForm(initial)
    }, 0)
  }, [profile])

  const isDirty =
    form.displayName.trim() !== initForm.displayName ||
    form.bio.trim() !== initForm.bio ||
    form.theme !== initForm.theme

  const isSaving = updateProfile.isPending

  function handleDiscard() {
    setForm(initForm)
    applyResolvedTheme(initForm.theme)
    setNameError(null)
  }

  async function handleSave() {
    setNameError(null)

    if (!form.displayName.trim()) {
      setNameError('Name is required.')
      return
    }
    if (form.displayName.trim().length > 50) {
      setNameError('Name must be 50 characters or less.')
      return
    }

    try {
      await updateProfile.mutateAsync({
        display_name: form.displayName.trim(),
        bio: form.bio.trim(),
        theme: form.theme,
      })
      setInitForm({
        displayName: form.displayName.trim(),
        bio: form.bio.trim(),
        theme: form.theme,
      })
    } catch {
      // mutation handles toast
    }
  }

  function handleUpload(file: File) {
    uploadAvatar.mutate(file)
  }

  function handleDeleteAvatar() {
    deleteAvatar.mutate()
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-[800px] px-6 py-10 space-y-8">
        <Skeleton className="h-64 w-full rounded-2xl" />
        <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[800px] px-6 py-10">
      <div className="flex flex-col gap-8">
        {/* Personal information section */}
        <SettingsSection
          title="Personal information"
          description="Your name and bio appear on tickets and email signatures."
        >
          <SettingsCard>
            <div className="grid grid-cols-[1fr_auto] gap-8 items-start">
              {/* Form fields */}
              <div className="flex flex-col gap-4">
                <SettingsField
                  label="Your name"
                  htmlFor="profile-display-name"
                  error={nameError ?? undefined}
                >
                  <Input
                    id="profile-display-name"
                    type="text"
                    value={form.displayName}
                    onChange={(e) => {
                      setForm((prev) => ({ ...prev, displayName: e.target.value }))
                      if (nameError) setNameError(null)
                    }}
                    maxLength={50}
                    placeholder="Jane Smith"
                    aria-invalid={!!nameError}
                  />
                </SettingsField>

                <SettingsField
                  label="Your email"
                  htmlFor="profile-email"
                  hint="Email is read-only. Contact support to change it."
                >
                  <Input
                    id="profile-email"
                    type="email"
                    value={profile?.email ?? ''}
                    disabled
                    readOnly
                  />
                </SettingsField>

                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="profile-bio"
                      className="text-sm font-medium text-foreground"
                    >
                      Your bio
                    </label>
                    <span className="text-xs text-muted-foreground">
                      {form.bio.length}/200
                    </span>
                  </div>
                  <Textarea
                    id="profile-bio"
                    value={form.bio}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, bio: e.target.value.slice(0, 200) }))
                    }
                    maxLength={200}
                    placeholder="Customer success, based in Amsterdam"
                    rows={3}
                    className="resize-y min-h-[80px]"
                  />
                  <p className="text-xs text-muted-foreground">Used in email signatures.</p>
                </div>
              </div>

              {/* Avatar column */}
              <AvatarUpload
                avatarUrl={profile?.avatar_url ?? null}
                displayName={form.displayName}
                email={profile?.email ?? ''}
                onUpload={handleUpload}
                onDelete={handleDeleteAvatar}
                uploading={uploadAvatar.isPending || deleteAvatar.isPending}
              />
            </div>
          </SettingsCard>
        </SettingsSection>

        {/* Appearance / theme section */}
        <SettingsSection
          title="Theme"
          description="Choose how Lynq looks. System follows your device setting."
        >
          <SettingsCard>
            <ThemeSelector
              value={form.theme}
              onChange={(theme) => {
                setForm((prev) => ({ ...prev, theme }))
                applyResolvedTheme(theme)
              }}
            />
          </SettingsCard>
        </SettingsSection>

        {/* Legal links */}
        <LegalLinksSection />
      </div>

      {/* Sticky save/discard footer — only shown when dirty */}
      {isDirty && (
        <div className="sticky bottom-0 mt-6 flex items-center justify-end gap-2 border-t border-border bg-background py-3">
          <span className="mr-auto text-xs text-muted-foreground">Unsaved changes</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleDiscard}
            disabled={isSaving}
          >
            Discard
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => void handleSave()}
            disabled={isSuspended || isSaving || !form.displayName.trim()}
          >
            {isSaving ? (
              <>
                <Loader2 size={14} strokeWidth={1.75} className="animate-spin" />
                Saving…
              </>
            ) : (
              'Save changes'
            )}
          </Button>
        </div>
      )}
    </div>
  )
}
