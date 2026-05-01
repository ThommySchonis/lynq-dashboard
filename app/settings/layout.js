import Sidebar from '../components/Sidebar'
import SettingsSidebar from '../components/settings/SettingsSidebar'

export default function SettingsLayout({ children }) {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#F8F7FA' }}>
      <Sidebar />
      {/* 260px spacer for the fixed SettingsSidebar */}
      <div style={{ width: 260, flexShrink: 0 }} />
      <SettingsSidebar />
      <main style={{ flex: 1, overflowY: 'auto', minWidth: 0 }}>
        {children}
      </main>
    </div>
  )
}
