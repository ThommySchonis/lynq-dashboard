import { Sidebar } from '@/components/layout/sidebar'
import SettingsSidebar from '@/components/features/settings/settings-sidebar'

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-[#F8F7FA]">
      <Sidebar />
      {/* 260px spacer compensates for the fixed-position SettingsSidebar */}
      <div className="w-[260px] shrink-0" />
      <SettingsSidebar />
      <main className="flex-1 overflow-y-auto min-w-0">
        {children}
      </main>
    </div>
  )
}
