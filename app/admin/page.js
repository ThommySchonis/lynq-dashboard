'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

const ADMIN_EMAIL = 'info@lynqagency.com'

export default function AdminPage() {
  const [clients, setClients] = useState([])
  const [broadcasts, setBroadcasts] = useState([])
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(false)
  const [broadcastLoading, setBroadcastLoading] = useState(false)
  const [notifLoading, setNotifLoading] = useState(false)
  const [success, setSuccess] = useState('')
  const [broadcastSuccess, setBroadcastSuccess] = useState('')
  const [notifSuccess, setNotifSuccess] = useState('')
  const [authorized, setAuthorized] = useState(false)
  const [activeTab, setActiveTab] = useState('clients')
  const [finance, setFinance] = useState(null)
  const [financeLoading, setFinanceLoading] = useState(false)
  const [broadcastForm, setBroadcastForm] = useState({ title: '', body: '', type: 'update' })
  const [notifForm, setNotifForm] = useState({ title: '', body: '', type: 'info' })
  const [form, setForm] = useState({
    company_name: '',
    email: '',
    password: '',
    gorgias_domain: '',
    gorgias_api_key: '',
    shopify_domain: '',
    shopify_api_key: '',
    parcel_panel_api_key: '',
  })

  useEffect(() => {
    async function checkAuth() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || user.email !== ADMIN_EMAIL) {
        window.location.href = '/admin/login'
        return
      }
      setAuthorized(true)
      fetchClients()
      fetchBroadcasts()
      fetchNotifications()
    }
    checkAuth()
  }, [])

  async function fetchFinance() {
    setFinanceLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/admin/finance', {
      headers: { Authorization: `Bearer ${session.access_token}`, 'x-admin-email': ADMIN_EMAIL },
    })
    if (res.ok) setFinance(await res.json())
    setFinanceLoading(false)
  }

  async function fetchNotifications() {
    const { data } = await supabase.from('notifications').select('*').order('created_at', { ascending: false })
    if (data) setNotifications(data)
  }

  async function handleNotification(e) {
    e.preventDefault()
    setNotifLoading(true)
    setNotifSuccess('')
    const { error } = await supabase.from('notifications').insert({
      title: notifForm.title,
      body: notifForm.body,
      type: notifForm.type,
    })
    if (error) {
      alert('Error: ' + error.message)
    } else {
      setNotifSuccess('Notification pushed!')
      setNotifForm({ title: '', body: '', type: 'info' })
      fetchNotifications()
    }
    setNotifLoading(false)
  }

  async function deleteNotification(id) {
    await supabase.from('notifications').delete().eq('id', id)
    fetchNotifications()
  }

  async function fetchBroadcasts() {
    const { data } = await supabase.from('broadcasts').select('*').order('created_at', { ascending: false })
    if (data) setBroadcasts(data)
  }

  async function handleBroadcast(e) {
    e.preventDefault()
    setBroadcastLoading(true)
    setBroadcastSuccess('')
    const { error } = await supabase.from('broadcasts').insert({
      title: broadcastForm.title,
      body: broadcastForm.body,
      type: broadcastForm.type,
    })
    if (error) {
      alert('Error: ' + error.message)
    } else {
      setBroadcastSuccess('Message pushed to all clients!')
      setBroadcastForm({ title: '', body: '', type: 'update' })
      fetchBroadcasts()
    }
    setBroadcastLoading(false)
  }

  async function deleteBroadcast(id) {
    await supabase.from('broadcasts').delete().eq('id', id)
    fetchBroadcasts()
  }

  async function fetchClients() {
    const { data } = await supabase.from('clients').select('*').order('created_at', { ascending: false })
    if (data) setClients(data)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setSuccess('')

    // 1. Maak auth account aan
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
    })

    if (authError) {
      alert('Error: ' + authError.message)
      setLoading(false)
      return
    }

    // 2. Sla klantdata op in clients tabel
    const { error: dbError } = await supabase.from('clients').insert({
      company_name: form.company_name,
      email: form.email,
      gorgias_domain: form.gorgias_domain,
      gorgias_api_key: form.gorgias_api_key,
      shopify_domain: form.shopify_domain,
      shopify_api_key: form.shopify_api_key,
      parcel_panel_api_key: form.parcel_panel_api_key,
      status: 'active',
    })

    if (dbError) {
      alert('DB Error: ' + dbError.message)
      setLoading(false)
      return
    }

    setSuccess(`Client ${form.company_name} created!`)
    setForm({ company_name: '', email: '', password: '', gorgias_domain: '', gorgias_api_key: '', shopify_domain: '', shopify_api_key: '', parcel_panel_api_key: '' })
    fetchClients()
    setLoading(false)
  }

  const s = {
    page: { minHeight: '100vh', background: '#1C0F36', fontFamily: "'Inter Tight', sans-serif", color: '#fff' },
    topbar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 40px', height: '64px', background: '#180d30', borderBottom: '1px solid rgba(255,255,255,0.07)', position: 'sticky', top: 0, zIndex: 10 },
    topbarLogo: { height: '28px', filter: 'brightness(0) invert(1)' },
    topbarRight: { display: 'flex', alignItems: 'center', gap: '16px' },
    topbarEmail: { fontSize: '12px', color: '#4a7fb5' },
    logoutBtn: { padding: '7px 16px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', color: '#4a7fb5', fontSize: '12px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Inter Tight', sans-serif", transition: 'all 0.15s' },
    content: { padding: '36px 40px', maxWidth: '1200px' },
    pageHeader: { marginBottom: '32px' },
    pageTitle: { fontSize: '22px', fontWeight: '800', marginBottom: '4px' },
    pageSub: { color: '#4a7fb5', fontSize: '13px' },
    statsRow: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '32px', maxWidth: '600px' },
    statCard: { background: '#241352', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', padding: '20px 24px' },
    statNum: { fontSize: '28px', fontWeight: '800', color: '#fff', lineHeight: 1 },
    statLabel: { fontSize: '11px', color: '#4a7fb5', marginTop: '4px', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.05em' },
    tabBar: { display: 'flex', gap: '2px', marginBottom: '28px', background: 'rgba(255,255,255,0.04)', padding: '4px', borderRadius: '10px', width: 'fit-content' },
    tab: { padding: '8px 20px', borderRadius: '7px', border: 'none', fontSize: '13px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.15s', fontFamily: "'Inter Tight', sans-serif" },
    tabActive: { background: '#A175FC', color: '#fff', boxShadow: '0 2px 8px rgba(161,117,252,0.3)' },
    tabInactive: { background: 'transparent', color: '#4a7fb5' },
    grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' },
    card: { background: '#241352', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', padding: '28px' },
    cardTitle: { fontSize: '15px', fontWeight: '700', marginBottom: '6px', color: '#fff' },
    cardSub: { fontSize: '12px', color: '#4a7fb5', marginBottom: '24px' },
    divider: { height: '1px', background: 'rgba(255,255,255,0.06)', margin: '16px 0' },
    label: { display: 'block', fontSize: '11px', color: '#4a7fb5', marginBottom: '5px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.04em' },
    input: { width: '100%', padding: '10px 14px', background: '#180d30', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', color: '#fff', fontSize: '13px', boxSizing: 'border-box', marginBottom: '14px', fontFamily: "'Inter Tight', sans-serif", transition: 'border-color 0.15s' },
    textarea: { width: '100%', padding: '10px 14px', background: '#180d30', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', color: '#fff', fontSize: '13px', boxSizing: 'border-box', marginBottom: '14px', fontFamily: "'Inter Tight', sans-serif", resize: 'vertical', minHeight: '100px' },
    btn: { width: '100%', padding: '11px', background: '#A175FC', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '700', cursor: 'pointer', marginTop: '6px', fontFamily: "'Inter Tight', sans-serif", letterSpacing: '0.02em', transition: 'opacity 0.15s' },
    success: { background: 'rgba(78,204,163,0.1)', border: '1px solid rgba(78,204,163,0.3)', borderRadius: '8px', padding: '10px 14px', color: '#4ecca3', fontSize: '13px', marginBottom: '16px' },
    clientRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' },
    pill: { padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '600', background: 'rgba(78,204,163,0.12)', color: '#4ecca3', border: '1px solid rgba(78,204,163,0.2)' },
    typePill: (t, selected) => ({ padding: '7px 14px', borderRadius: '8px', border: '1px solid', fontSize: '12px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Inter Tight', sans-serif", transition: 'all 0.15s', borderColor: selected === t ? '#A175FC' : 'rgba(255,255,255,0.08)', background: selected === t ? 'rgba(161,117,252,0.15)' : 'transparent', color: selected === t ? '#A175FC' : '#4a7fb5' }),
    broadcastRow: { padding: '16px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' },
  }

  if (!authorized) return (
    <div style={{ minHeight: '100vh', background: '#1C0F36', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4a7fb5', fontFamily: "'Inter Tight', sans-serif" }}>
      Checking access...
    </div>
  )

  return (
    <div style={s.page}>
      <link href="https://fonts.googleapis.com/css2?family=Rethink+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />

      {/* Topbar */}
      <div style={s.topbar}>
        <img src="/logo.png" alt="Lynq & Flow" style={s.topbarLogo} />
        <div style={s.topbarRight}>
          <span style={s.topbarEmail}>info@lynqagency.com</span>
          <button onClick={async () => { await supabase.auth.signOut(); window.location.href = '/admin/login' }} style={s.logoutBtn}>
            Log out
          </button>
        </div>
      </div>

      <div style={s.content}>
        {/* Page header */}
        <div style={s.pageHeader}>
          <div style={s.pageTitle}>Admin Panel</div>
          <div style={s.pageSub}>Manage clients, broadcasts and notifications</div>
        </div>

        {/* Stats */}
        <div style={s.statsRow}>
          <div style={s.statCard}>
            <div style={s.statNum}>{clients.length}</div>
            <div style={s.statLabel}>Clients</div>
          </div>
          <div style={s.statCard}>
            <div style={s.statNum}>{broadcasts.length}</div>
            <div style={s.statLabel}>Broadcasts</div>
          </div>
          <div style={s.statCard}>
            <div style={s.statNum}>{notifications.length}</div>
            <div style={s.statLabel}>Notifications</div>
          </div>
        </div>

        {/* Tabs */}
        <div style={s.tabBar}>
          <button style={{ ...s.tab, ...(activeTab === 'clients' ? s.tabActive : s.tabInactive) }} onClick={() => setActiveTab('clients')}>Clients</button>
          <button style={{ ...s.tab, ...(activeTab === 'broadcasts' ? s.tabActive : s.tabInactive) }} onClick={() => setActiveTab('broadcasts')}>Broadcasts</button>
          <button style={{ ...s.tab, ...(activeTab === 'notifications' ? s.tabActive : s.tabInactive) }} onClick={() => setActiveTab('notifications')}>Notifications</button>
          <button style={{ ...s.tab, ...(activeTab === 'finance' ? s.tabActive : s.tabInactive) }} onClick={() => { setActiveTab('finance'); if (!finance) fetchFinance() }}>Finance</button>
        </div>

      {activeTab === 'broadcasts' && (
        <div style={s.grid}>
          {/* Broadcast schrijven */}
          <div style={s.card}>
            <div style={s.cardTitle}>Push new message</div>
            <div style={s.cardSub}>Visible in the Value Feed of all clients</div>
            {broadcastSuccess && <div style={s.success}>{broadcastSuccess}</div>}
            <form onSubmit={handleBroadcast}>
              <label style={s.label}>Type</label>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
                {['update', 'tip', 'video'].map(t => (
                  <button key={t} type="button" style={s.typePill(t, broadcastForm.type)} onClick={() => setBroadcastForm({...broadcastForm, type: t})}>
                    {t === 'update' ? '📢 Update' : t === 'tip' ? '💡 Tip' : '🎥 Video'}
                  </button>
                ))}
              </div>
              <label style={s.label}>Title</label>
              <input style={s.input} value={broadcastForm.title} onChange={e => setBroadcastForm({...broadcastForm, title: e.target.value})} required placeholder="Message subject" />
              <label style={s.label}>Message</label>
              <textarea style={s.textarea} value={broadcastForm.body} onChange={e => setBroadcastForm({...broadcastForm, body: e.target.value})} required placeholder="Write your message here..." />
              <button style={s.btn} type="submit" disabled={broadcastLoading}>
                {broadcastLoading ? 'Pushing...' : '📤 Push to all clients'}
              </button>
            </form>
          </div>

          {/* Broadcast geschiedenis */}
          <div style={s.card}>
            <div style={s.cardTitle}>Sent — {broadcasts.length}</div>
            {broadcasts.length === 0 && <div style={{ color: '#4a7fb5', fontSize: '13px' }}>No messages sent yet.</div>}
            {broadcasts.map(b => (
              <div key={b.id} style={s.broadcastRow}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ ...s.pill, background: b.type === 'tip' ? 'rgba(161,117,252,0.15)' : b.type === 'video' ? 'rgba(255,209,102,0.15)' : 'rgba(78,204,163,0.15)', color: b.type === 'tip' ? '#A175FC' : b.type === 'video' ? '#ffd166' : '#4ecca3' }}>
                        {b.type === 'update' ? '📢 Update' : b.type === 'tip' ? '💡 Tip' : '🎥 Video'}
                      </span>
                      <span style={{ fontSize: '11px', color: '#4a7fb5' }}>{new Date(b.created_at).toLocaleDateString('en-US')}</span>
                    </div>
                    <div style={{ fontWeight: '600', fontSize: '14px', marginBottom: '4px' }}>{b.title}</div>
                    <div style={{ fontSize: '12px', color: '#4a7fb5', lineHeight: '1.5' }}>{b.body}</div>
                  </div>
                  <button onClick={() => deleteBroadcast(b.id)} style={{ background: 'none', border: 'none', color: '#ff6b8a', cursor: 'pointer', fontSize: '14px', marginLeft: '12px', flexShrink: 0 }}>✕</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'notifications' && (
        <div style={s.grid}>
          {/* Notificatie schrijven */}
          <div style={s.card}>
            <div style={s.cardTitle}>Push new notification</div>
            <div style={s.cardSub}>Appears in the notification icon of all clients</div>
            {notifSuccess && <div style={s.success}>{notifSuccess}</div>}
            <form onSubmit={handleNotification}>
              <label style={s.label}>Type</label>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
                {['info', 'warning', 'alert'].map(t => (
                  <button key={t} type="button" style={s.typePill(t, notifForm.type)} onClick={() => setNotifForm({...notifForm, type: t})}>
                    {t === 'info' ? '💬 Info' : t === 'warning' ? '⚠️ Warning' : '🔴 Alert'}
                  </button>
                ))}
              </div>
              <label style={s.label}>Title</label>
              <input style={s.input} value={notifForm.title} onChange={e => setNotifForm({...notifForm, title: e.target.value})} required placeholder="Notification subject" />
              <label style={s.label}>Message</label>
              <textarea style={s.textarea} value={notifForm.body} onChange={e => setNotifForm({...notifForm, body: e.target.value})} required placeholder="Write your notification here..." />
              <button style={s.btn} type="submit" disabled={notifLoading}>
                {notifLoading ? 'Pushing...' : '🔔 Push notification'}
              </button>
            </form>
          </div>

          {/* Notificaties geschiedenis */}
          <div style={s.card}>
            <div style={s.cardTitle}>Sent — {notifications.length}</div>
            {notifications.length === 0 && <div style={{ color: '#4a7fb5', fontSize: '13px' }}>No notifications sent yet.</div>}
            {notifications.map(n => (
              <div key={n.id} style={s.broadcastRow}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ ...s.pill, background: n.type === 'alert' ? 'rgba(255,107,138,0.15)' : n.type === 'warning' ? 'rgba(255,209,102,0.15)' : 'rgba(78,204,163,0.15)', color: n.type === 'alert' ? '#ff6b8a' : n.type === 'warning' ? '#ffd166' : '#4ecca3' }}>
                        {n.type === 'info' ? '💬 Info' : n.type === 'warning' ? '⚠️ Warning' : '🔴 Alert'}
                      </span>
                      <span style={{ fontSize: '11px', color: '#4a7fb5' }}>{new Date(n.created_at).toLocaleDateString('en-US')}</span>
                    </div>
                    <div style={{ fontWeight: '600', fontSize: '14px', marginBottom: '4px' }}>{n.title}</div>
                    <div style={{ fontSize: '12px', color: '#4a7fb5', lineHeight: '1.5' }}>{n.body}</div>
                  </div>
                  <button onClick={() => deleteNotification(n.id)} style={{ background: 'none', border: 'none', color: '#ff6b8a', cursor: 'pointer', fontSize: '14px', marginLeft: '12px', flexShrink: 0 }}>✕</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'finance' && (
        <div>
          {financeLoading && <div style={{ color: '#4a7fb5', fontSize: '13px' }}>Loading...</div>}
          {!financeLoading && !finance && <div style={{ color: '#4a7fb5', fontSize: '13px' }}>No data available.</div>}
          {finance && (() => {
            const f = finance.finance
            const ai = finance.ai
            const fmt = (n) => n == null ? '—' : `$${n.toFixed(4)}`
            const fmtE = (n) => n == null ? '—' : `€${n.toFixed(0)}`
            const fmtN = (n) => (n || 0).toLocaleString()
            const green = '#4ecca3', red = '#ff6b8a', yellow = '#ffd166', purple = '#A175FC'

            return (
              <div>
                {/* P&L overzicht */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '28px' }}>
                  {[
                    { label: 'MRR', value: fmtE(f.mrr), color: green, sub: `${f.activeClients} active clients` },
                    { label: 'Costs this month', value: fmtE(f.totalCostMonth), color: yellow, sub: `Fixed €${f.fixedCosts} + AI $${f.aiCostMonth.toFixed(4)}` },
                    { label: 'Net margin', value: fmtE(f.netMargin), color: f.netMargin >= 0 ? green : red, sub: `${f.marginPct}% of MRR` },
                    { label: 'AI costs today', value: fmt(ai.today.cost), color: purple, sub: `${ai.today.calls} calls` },
                  ].map(({ label, value, color, sub }) => (
                    <div key={label} style={s.statCard}>
                      <div style={{ ...s.statNum, color }}>{value}</div>
                      <div style={s.statLabel}>{label}</div>
                      <div style={{ fontSize: '11px', color: '#4a7fb5', marginTop: '4px' }}>{sub}</div>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
                  {/* AI usage week/month */}
                  <div style={s.card}>
                    <div style={s.cardTitle}>AI Credits usage</div>
                    <div style={s.cardSub}>Claude Haiku 4.5 · $0.80/M input · $4.00/M output</div>
                    {[
                      { label: 'Today', cost: ai.today.cost, calls: ai.today.calls },
                      { label: 'Last 7 days', cost: ai.week.cost, calls: ai.week.calls, tokens: ai.week.input_tokens + ai.week.output_tokens },
                      { label: 'This month', cost: ai.month.cost, calls: ai.month.calls, tokens: ai.month.input_tokens + ai.month.output_tokens },
                      { label: 'Last month', cost: ai.lastMonth.cost },
                    ].map(({ label, cost, calls, tokens }) => (
                      <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: '600' }}>{label}</div>
                          {tokens != null && <div style={{ fontSize: '11px', color: '#4a7fb5', marginTop: '2px' }}>{fmtN(tokens)} tokens · {calls} calls</div>}
                          {tokens == null && calls != null && <div style={{ fontSize: '11px', color: '#4a7fb5', marginTop: '2px' }}>{calls} calls</div>}
                        </div>
                        <div style={{ fontWeight: '700', color: purple, fontSize: '14px' }}>{fmt(cost)}</div>
                      </div>
                    ))}
                  </div>

                  {/* Per route */}
                  <div style={s.card}>
                    <div style={s.cardTitle}>Usage by route (this month)</div>
                    <div style={s.cardSub}>Which AI function costs the most</div>
                    {Object.entries(ai.byRoute).length === 0 && (
                      <div style={{ color: '#4a7fb5', fontSize: '13px' }}>No AI calls logged this month.</div>
                    )}
                    {Object.entries(ai.byRoute).sort(([,a],[,b]) => b.cost - a.cost).map(([route, v]) => (
                      <div key={route} style={{ padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <span style={{ fontSize: '13px', fontWeight: '600', textTransform: 'capitalize' }}>{route}</span>
                          <span style={{ fontWeight: '700', color: purple, fontSize: '13px' }}>{fmt(v.cost)}</span>
                        </div>
                        <div style={{ fontSize: '11px', color: '#4a7fb5' }}>
                          {fmtN(v.calls)} calls · {fmtN(v.input_tokens)} in · {fmtN(v.output_tokens)} out tokens
                        </div>
                        <div style={{ marginTop: '6px', height: '3px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px' }}>
                          <div style={{ height: '3px', background: purple, borderRadius: '2px', width: `${Math.min(100, (v.calls / Math.max(...Object.values(ai.byRoute).map(r => r.calls))) * 100)}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                  {/* Subscriptions */}
                  <div style={s.card}>
                    <div style={s.cardTitle}>Fixed subscriptions</div>
                    <div style={s.cardSub}>Monthly fixed costs</div>
                    {finance.subscriptions.map(sub => (
                      <div key={sub.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: '600' }}>{sub.name}</div>
                          {sub.note && <div style={{ fontSize: '11px', color: '#4a7fb5', marginTop: '2px' }}>{sub.note}</div>}
                        </div>
                        <div style={{ fontWeight: '700', color: sub.cost > 0 ? yellow : '#4a7fb5', fontSize: '13px' }}>
                          {sub.cost > 0 ? `$${sub.cost}/mo` : '—'}
                        </div>
                      </div>
                    ))}
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0 0', marginTop: '4px' }}>
                      <span style={{ fontSize: '13px', fontWeight: '700' }}>Total</span>
                      <span style={{ fontWeight: '800', color: yellow, fontSize: '14px' }}>${f.fixedCosts}/mo</span>
                    </div>
                  </div>

                  {/* Daily AI costs */}
                  <div style={s.card}>
                    <div style={s.cardTitle}>AI costs per day (this month)</div>
                    <div style={s.cardSub}>Daily usage overview</div>
                    {ai.daily.length === 0 && <div style={{ color: '#4a7fb5', fontSize: '13px' }}>No data yet.</div>}
                    <div style={{ maxHeight: '280px', overflowY: 'auto' }}>
                      {[...ai.daily].reverse().map(({ date, cost, calls }) => {
                        const maxCost = Math.max(...ai.daily.map(d => d.cost), 0.0001)
                        const pct = Math.min(100, (cost / maxCost) * 100)
                        return (
                          <div key={date} style={{ padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                              <span style={{ fontSize: '12px', color: '#4a7fb5' }}>{new Date(date).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}</span>
                              <span style={{ fontSize: '12px', fontWeight: '600', color: purple }}>{fmt(cost)} <span style={{ color: '#4a7fb5', fontWeight: '400' }}>· {calls}x</span></span>
                            </div>
                            <div style={{ height: '3px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px' }}>
                              <div style={{ height: '3px', background: purple, borderRadius: '2px', width: `${pct}%`, opacity: 0.7 }} />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    <button onClick={fetchFinance} style={{ ...s.btn, marginTop: '16px', background: 'rgba(161,117,252,0.15)', color: purple }}>
                      Refresh
                    </button>
                  </div>
                </div>
              </div>
            )
          })()}
        </div>
      )}

      {activeTab === 'clients' && <div style={s.grid}>
        {/* New client form */}
        <div style={s.card}>
          <div style={s.cardTitle}>Create new client</div>
          <div style={s.cardSub}>Create account + configure API integrations</div>

          {success && <div style={s.success}>{success}</div>}

          <form onSubmit={handleSubmit}>
            <label style={s.label}>Company name</label>
            <input style={s.input} value={form.company_name} onChange={e => setForm({...form, company_name: e.target.value})} required placeholder="Smith Sisters" />

            <label style={s.label}>Email</label>
            <input style={s.input} type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} required placeholder="client@company.com" />

            <label style={s.label}>Password</label>
            <input style={s.input} type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} required placeholder="Min. 6 characters" />

            <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', margin: '6px 0 16px' }} />

            <label style={s.label}>Gorgias domain</label>
            <input style={s.input} value={form.gorgias_domain} onChange={e => setForm({...form, gorgias_domain: e.target.value})} placeholder="smithsisters.gorgias.com" />

            <label style={s.label}>Gorgias API key</label>
            <input style={s.input} value={form.gorgias_api_key} onChange={e => setForm({...form, gorgias_api_key: e.target.value})} placeholder="API key" />

            <label style={s.label}>Shopify domain</label>
            <input style={s.input} value={form.shopify_domain} onChange={e => setForm({...form, shopify_domain: e.target.value})} placeholder="smithsisters.myshopify.com" />

            <label style={s.label}>Shopify API key</label>
            <input style={s.input} value={form.shopify_api_key} onChange={e => setForm({...form, shopify_api_key: e.target.value})} placeholder="API key" />

            <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', margin: '6px 0 16px' }} />

            <label style={s.label}>Parcel Panel API key</label>
            <input style={s.input} value={form.parcel_panel_api_key} onChange={e => setForm({...form, parcel_panel_api_key: e.target.value})} placeholder="Parcel Panel API key" />

            <button style={s.btn} type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create client'}
            </button>
          </form>
        </div>

        {/* Klanten lijst */}
        <div style={s.card}>
          <div style={s.cardTitle}>Clients — {clients.length}</div>
          {clients.length === 0 && (
            <div style={{ color: '#4a7fb5', fontSize: '13px' }}>No clients created yet.</div>
          )}
          {clients.map(client => (
            <div key={client.id} style={s.clientRow}>
              <div>
                <div style={{ fontWeight: '600', fontSize: '14px' }}>{client.company_name}</div>
                <div style={{ color: '#4a7fb5', fontSize: '12px', marginTop: '2px' }}>{client.email}</div>
                {client.gorgias_domain && <div style={{ color: '#4a7fb5', fontSize: '11px', marginTop: '2px' }}>Gorgias: {client.gorgias_domain}</div>}
              </div>
              <span style={s.pill}>{client.status}</span>
            </div>
          ))}
        </div>
      </div>}
      </div>
    </div>
  )
}
