import { AppShell } from '@/components/layout/app-shell'
import {
  SettingsHeaderProvider,
  SettingsShell,
} from '@/components/features/settings/settings-header'

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell>
      <SettingsHeaderProvider>
        <SettingsShell>{children}</SettingsShell>
      </SettingsHeaderProvider>
    </AppShell>
  )
}
