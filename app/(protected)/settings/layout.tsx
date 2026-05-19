import { AppShell } from '@/components/layout/app-shell'
import SettingsSidebar from '@/components/features/settings/settings-sidebar'

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell>
      <SettingsSidebar />
      {/* 260px spacer compensates for the fixed-position SettingsSidebar */}
      <div className="flex min-h-screen bg-secondary">
        <div className="w-[260px] shrink-0" />
        <main className="flex-1 overflow-y-auto min-w-0">
          {children}
        </main>
      </div>
    </AppShell>
  )
}
