'use client'

import { SettingsPageHeader } from '@/components/features/settings/settings-header'
import { ChangePasswordSection } from './change-password-section'
import { MfaSection } from './mfa-section'
import { SessionsSection } from './sessions-section'
import { AccountDeletionSection } from '@/components/features/settings/personal/account-deletion-section'

export function SecuritySettings() {
  return (
    <div className="mx-auto max-w-[800px] px-6 py-10">
      <SettingsPageHeader
        title="Password & Security"
        description="Manage your password, two-factor authentication, and active sessions"
      />
      <div className="flex flex-col gap-8">
        <ChangePasswordSection />
        <MfaSection />
        <SessionsSection />
        <AccountDeletionSection />
      </div>
    </div>
  )
}
