'use client'

import { useState, useEffect } from 'react'
import { Monitor } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { SettingsSection, SettingsCard } from '@/components/features/settings/settings-section'
import { ConfirmDialog } from '@/components/features/settings/confirm-dialog'
import { useSignOutOthers } from '@/hooks/settings'
import { useAuthStore } from '@/stores/auth'

function parseDevice(ua: string): string {
  const os = /Windows/.test(ua)
    ? 'Windows'
    : /Mac OS/.test(ua)
      ? 'macOS'
      : /iPhone|iPad/.test(ua)
        ? 'iOS'
        : /Android/.test(ua)
          ? 'Android'
          : /Linux/.test(ua)
            ? 'Linux'
            : 'Unknown OS'

  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /Chrome\//.test(ua)
      ? 'Chrome'
      : /Firefox\//.test(ua)
        ? 'Firefox'
        : /Safari\//.test(ua)
          ? 'Safari'
          : 'Browser'

  return `${browser} on ${os}`
}

export function SessionsSection() {
  const signOutOthers = useSignOutOthers()
  const userEmail = useAuthStore((s) => s.user?.email)
  const isSuspended = useAuthStore((s) => s.isSuspended)
  const [deviceInfo, setDeviceInfo] = useState('This device')
  const [confirmOpen, setConfirmOpen] = useState(false)

  useEffect(() => {
    if (typeof navigator !== 'undefined') {
      const info = parseDevice(navigator.userAgent)
      setTimeout(() => setDeviceInfo(info), 0)
    }
  }, [])

  function handleSignOut() {
    signOutOthers.mutate(undefined, {
      onSuccess: () => setConfirmOpen(false),
    })
  }

  return (
    <SettingsSection
      title="Active sessions"
      description="Devices currently signed in to your account."
    >
      <SettingsCard>
        <div className="flex items-center gap-3.5">
          <div className="size-10 rounded-[10px] bg-muted border border-border flex items-center justify-center shrink-0">
            <Monitor className="size-5 text-primary" strokeWidth={1.75} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-foreground">{deviceInfo}</span>
              <Badge variant="outline" className="text-[11px] font-semibold text-primary border-primary/20 bg-primary/10">
                This device
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Signed in as {userEmail}
            </p>
          </div>
        </div>

        <div className="border-t border-border mt-5 pt-5">
          <p className="text-[13px] text-muted-foreground mb-3">
            Sign out of all browsers and devices except this one. This is useful if you
            forgot to sign out on a shared device.
          </p>
          <Button
            variant="outline"
            onClick={() => setConfirmOpen(true)}
            disabled={isSuspended || signOutOthers.isPending}
          >
            {signOutOthers.isPending ? 'Signing out...' : 'Sign out of all other devices'}
          </Button>
        </div>
      </SettingsCard>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Sign out other devices"
        description="This will sign you out of all browsers and devices except the one you're currently using."
        confirmLabel="Sign out others"
        onConfirm={handleSignOut}
        loading={signOutOthers.isPending}
      />
    </SettingsSection>
  )
}
