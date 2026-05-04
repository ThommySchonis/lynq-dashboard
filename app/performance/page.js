'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import Sidebar from '../components/Sidebar'

// Performance metrics page is being rebuilt on top of the new
// email_conversations data model. Previous implementation read from a
// third-party helpdesk API that has been removed.
export default function PerformancePage() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { window.location.href = '/login' }
    })
  }, [])

  if (!mounted) return null

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#F9F8FF' }}>
      <Sidebar />
      <main style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ marginBottom: 24 }}>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: '#0F0F10', letterSpacing: '-0.02em', marginBottom: 4 }}>Performance</h1>
            <p style={{ fontSize: 13, color: '#6B7280' }}>Customer support metrics</p>
          </div>

          <div style={{
            background: '#fff',
            border: '1px solid rgba(0,0,0,0.06)',
            borderRadius: 12,
            padding: '48px 32px',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#0F0F10', marginBottom: 8 }}>
              Performance metrics coming soon
            </div>
            <p style={{ fontSize: 13, color: '#6B7280', maxWidth: 480, margin: '0 auto', lineHeight: 1.5 }}>
              We're rebuilding this page on top of the new inbox data model.
              Workload, response times, and productivity metrics will be available
              here once email conversation tracking is fully migrated.
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}
