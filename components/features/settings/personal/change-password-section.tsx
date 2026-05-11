'use client'

import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { Button } from '@/components/ui/button'
import { SettingsSection, SettingsCard } from '@/components/features/settings/settings-section'
import { SettingsField } from '@/components/features/settings/settings-field'
import { PasswordInput } from '@/components/features/settings/password-input'
import { useChangePassword } from '@/hooks/settings'
import { INITIAL_PASSWORD_FORM } from '@/lib/settings-constants'
import type { PasswordChangeForm } from '@/types/settings'
import { toast } from 'sonner'

type PasswordErrors = Partial<Record<'current' | 'new' | 'confirm', string>>

type StrengthLevel = 'weak' | 'fair' | 'good' | 'strong'

interface StrengthConfig {
  width: string
  className: string
  label: string
}

const STRENGTH_MAP: Record<StrengthLevel, StrengthConfig> = {
  weak:   { width: '25%',  className: 'bg-destructive', label: 'Weak' },
  fair:   { width: '50%',  className: 'bg-orange-500',  label: 'Fair' },
  good:   { width: '75%',  className: 'bg-blue-500',    label: 'Good' },
  strong: { width: '100%', className: 'bg-green-500',   label: 'Strong' },
}

function getPasswordStrength(pw: string): StrengthLevel {
  if (!pw || pw.length < 8) return 'weak'
  const checks = [
    /[A-Z]/.test(pw),
    /[a-z]/.test(pw),
    /[0-9]/.test(pw),
    /[^A-Za-z0-9]/.test(pw),
  ]
  const score = checks.filter(Boolean).length
  if (pw.length >= 12 && score >= 3) return 'strong'
  if (pw.length >= 10 && score >= 3) return 'good'
  if (score >= 2) return 'fair'
  return 'weak'
}

function StrengthBar({ password }: { password: string }) {
  if (!password) return null
  const level = getPasswordStrength(password)
  const config = STRENGTH_MAP[level]

  return (
    <div className="mt-1.5">
      <div className="h-1 rounded-sm bg-muted overflow-hidden">
        <div
          className={`h-full rounded-sm transition-all duration-300 ${config.className}`}
          style={{ width: config.width }}
        />
      </div>
      <p className={`text-[11px] font-medium mt-1 ${config.className.replace('bg-', 'text-')}`}>
        {config.label}
      </p>
    </div>
  )
}

export function ChangePasswordSection() {
  const userEmail = useAuthStore((s) => s.user?.email)
  const changePassword = useChangePassword()

  const [form, setForm] = useState<PasswordChangeForm>({ ...INITIAL_PASSWORD_FORM })
  const [errors, setErrors] = useState<PasswordErrors>({})
  const [verifying, setVerifying] = useState(false)

  const isBusy = verifying || changePassword.isPending

  const updateField = useCallback(
    (field: keyof PasswordChangeForm) => (value: string) => {
      setForm((prev) => ({ ...prev, [field]: value }))
      setErrors((prev) => {
        const next = { ...prev }
        if (field === 'current_password') delete next.current
        if (field === 'new_password') delete next.new
        if (field === 'confirm_password') delete next.confirm
        return next
      })
    },
    [],
  )

  async function handleSubmit() {
    const errs: PasswordErrors = {}
    if (!form.current_password) errs.current = 'Required'
    if (form.new_password.length < 8) errs.new = 'Minimum 8 characters'
    if (form.new_password && form.current_password && form.new_password === form.current_password)
      errs.new = 'Must differ from current password'
    if (form.confirm_password !== form.new_password) errs.confirm = 'Passwords do not match'
    if (Object.keys(errs).length) {
      setErrors(errs)
      return
    }

    setErrors({})
    setVerifying(true)

    // Verify current password by re-authenticating
    const { error: authErr } = await supabase.auth.signInWithPassword({
      email: userEmail ?? '',
      password: form.current_password,
    })

    if (authErr) {
      setErrors({ current: 'Current password is incorrect' })
      setVerifying(false)
      return
    }
    setVerifying(false)

    changePassword.mutate(
      { password: form.new_password },
      {
        onSuccess: () => {
          setForm({ ...INITIAL_PASSWORD_FORM })
        },
      },
    )
  }

  return (
    <SettingsSection
      title="Password"
      description="Update your password. Changing it signs you out of all other active sessions."
    >
      <SettingsCard
        footer={
          <Button onClick={handleSubmit} disabled={isBusy}>
            {isBusy ? 'Updating...' : 'Update password'}
          </Button>
        }
      >
        <div className="flex flex-col gap-4.5">
          <SettingsField label="Current password" error={errors.current}>
            <PasswordInput
              value={form.current_password}
              onChange={updateField('current_password')}
              placeholder="Your current password"
              aria-invalid={!!errors.current}
            />
          </SettingsField>

          <SettingsField label="New password" error={errors.new}>
            <PasswordInput
              value={form.new_password}
              onChange={updateField('new_password')}
              placeholder="New password (min 8 characters)"
              aria-invalid={!!errors.new}
            />
            <StrengthBar password={form.new_password} />
          </SettingsField>

          <SettingsField label="Confirm new password" error={errors.confirm}>
            <PasswordInput
              value={form.confirm_password}
              onChange={updateField('confirm_password')}
              placeholder="Repeat new password"
              aria-invalid={!!errors.confirm}
            />
          </SettingsField>
        </div>
      </SettingsCard>
    </SettingsSection>
  )
}
