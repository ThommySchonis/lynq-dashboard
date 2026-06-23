import { AppShell } from '@/components/layout/app-shell'
import SettingsSidebar from '@/components/features/settings/settings-sidebar'

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell>
      <div className="flex h-screen flex-col bg-settings-surface">
        {/* Full-width section header — spans over the settings sidebar too (Figma node 831-26754) */}
        <header className="shrink-0 bg-card border-b border-settings-border px-10 py-5">
          <h1 className="text-[22px] font-bold leading-tight text-foreground">Settings</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Workspace, account &amp; preferences
          </p>
        </header>
        <div className="flex min-h-0 flex-1">
          <SettingsSidebar />
          <main className="flex-1 overflow-y-auto min-w-0">{children}</main>
        </div>
      </div>
    </AppShell>
  )
}
