'use client'

import AdminSidebar from '../../components/features/admin/admin-sidebar'

// Shell for /lynq-admin/* routes — mirrors the admin panel shell at /admin
// so the two feel like one cohesive surface. The sidebar runs in link-mode
// (no onTabChange prop): clicking a tab navigates to /admin?tab=<id> and
// the AdminPage's useSearchParams effect opens the right tab.
//
// SUPPORT > Feedback is a real route, so its active state highlights based
// on pathname while we're inside /lynq-admin/feedback.
export default function LynqAdminLayout({ children }) {
  return (
    <div style={{
      display: 'flex',
      height: '100vh',
      background: '#F9F9FB',
      overflow: 'hidden',
      fontFamily: "'Switzer',-apple-system,BlinkMacSystemFont,sans-serif",
      WebkitFontSmoothing: 'antialiased',
    }}>
      <AdminSidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        {children}
      </div>
    </div>
  )
}
