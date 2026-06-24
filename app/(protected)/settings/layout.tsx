import { AppShell } from '@/components/layout/app-shell'
import SettingsSidebar from '@/components/features/settings/settings-sidebar'
import {
  SettingsHeaderProvider,
  SettingsHeaderBar,
} from '@/components/features/settings/settings-header'

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell>
      <SettingsHeaderProvider>
        <div className="flex h-screen flex-col bg-settings-surface">
          {/* Full-width per-page section header — spans over the sidebar too (Figma node 831-26745) */}
          <SettingsHeaderBar />
          <div className="flex min-h-0 flex-1">
            <SettingsSidebar />
            <main className="flex-1 overflow-y-auto min-w-0">{children}</main>
          </div>
        </div>
      </SettingsHeaderProvider>
    </AppShell>
  )
}
