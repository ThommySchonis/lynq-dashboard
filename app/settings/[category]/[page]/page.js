import { redirect } from 'next/navigation'
import { Clock } from 'lucide-react'

const VALID = new Set([
  'workspace/billing',
  'integrations/shopify',
  'personal/profile',
  'personal/security',
])

function toLabel(slug) {
  return slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

export default async function SettingsCatchAll({ params }) {
  const { category, page } = await params

  if (!VALID.has(`${category}/${page}`)) {
    redirect('/settings/workspace/general')
  }

  const categoryLabel = toLabel(category)
  const pageLabel     = toLabel(page)

  return (
    <div style={{
      background: '#F8F7FA',
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '48px 32px',
      fontFamily: "'Switzer', -apple-system, BlinkMacSystemFont, sans-serif",
      WebkitFontSmoothing: 'antialiased',
    }}>
      <div style={{ width: '100%', maxWidth: 480 }}>
        {/* Breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 28, fontSize: 12, color: '#9B91A8' }}>
          <span>Settings</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
          <span>{categoryLabel}</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
          <span style={{ color: '#6B5E7B' }}>{pageLabel}</span>
        </div>

        {/* Card */}
        <div style={{ background: '#FFFFFF', border: '1px solid #E5E0EB', borderRadius: 12, padding: '48px 40px', textAlign: 'center' }}>
          <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'center' }}>
            <Clock size={32} strokeWidth={1.75} color="#9B91A8" />
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 600, color: '#1C0F36', margin: '0 0 8px 0', lineHeight: 1.3 }}>
            {pageLabel} Settings
          </h2>
          <p style={{ fontSize: 14, color: '#6B5E7B', margin: 0, lineHeight: 1.6 }}>
            This page is being built. Check back soon.
          </p>
        </div>
      </div>
    </div>
  )
}
