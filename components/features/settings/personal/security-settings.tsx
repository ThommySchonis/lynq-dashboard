'use client'

import { ChangePasswordSection } from './change-password-section'
import { MfaSection } from './mfa-section'
import { SessionsSection } from './sessions-section'

export function SecuritySettings() {
  return (
    <div className="max-w-3xl mx-auto py-12 px-10">
      <h1 className="text-[22px] font-semibold text-foreground mb-1">
        Password & Security
      </h1>
      <p className="text-sm text-muted-foreground mb-8">
        Manage your password, two-factor authentication, and active sessions
      </p>
      <div className="flex flex-col gap-10">
        <ChangePasswordSection />
        <MfaSection />
        <SessionsSection />
      </div>
    </div>
  )
}
