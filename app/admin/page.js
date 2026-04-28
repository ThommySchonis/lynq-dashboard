'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

const ADMIN_EMAIL = 'info@lynqagency.com'

export default function AdminPage() {
  const [clients, setClients] = useState([])
  const [broadcasts, setBroadcasts] = useState([])
  const [notifications, setNotifications] = useState([])
  const [teamMembers, setTeamMembers] = useState([])
  const [loading, setLoading] = useState(false)
  const [broadcastLoading, setBroadcastLoading] = useState(false)
  const [notifLoading, setNotifLoading] = useState(false)
  const [teamLoading, setTeamLoading] = useState(false)
  const [success, setSuccess] = useState('')
  const [broadcastSuccess, setBroadcastSuccess] = useState('')
  const [notifSuccess, setNotifSuccess] = useState('')
  const [teamSuccess, setTeamSuccess] = useState('')
  const [teamError, setTeamError] = useState('')
  const [authorized, setAuthorized] = useState(false)
  const [activeTab, setActiveTab] = useState('clients')
  const [teamForm, setTeamForm] = useState({ name: '', email: '', password: '', role: 'developer' })
  const [finance, setFinance] = useState(null)
  const [financeLoading, setFinanceLoading] = useState(false)
  const [timeData, setTimeData] = useState(null)
  const [timeLoading, setTimeLoading] = useState(false)
  const [timeFilter, setTimeFilter] = useState('week')
  const [broadcastForm, setBroadcastForm] = useState({ title: '', body: '', type: 'update', youtube_url: '' })
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
      fetchTeamMembers()
    }
    checkAuth()
  }, [])

  async function fetchTeamMembers() {
    const { data } = await supabase.from('team_members').select('*').order('created_at', { ascending: false })
    if (data) setTeamMembers(data)
  }

  async function fetchTimeData(f = timeFilter) {
    setTimeLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch(`/api/time?filter=${f}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
    if (res.ok) {
      const d = await res.json()
      setTimeData(d)
    }
    setTimeLoading(false)
  }

  async function handleCreateTeamMember(e) {
    e.preventDefault()
    setTeamLoading(true)
    setTeamSuccess('')
    setTeamError('')

    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/admin/create-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify(teamForm),
    })
    const d = await res.json()

    if (!res.ok) {
      setTeamError(d.error || 'Something went wrong')
    } else {
      setTeamSuccess(`${teamForm.name} can now log in with ${teamForm.email}`)
      setTeamForm({ name: '', email: '', password: '', role: 'developer' })
      fetchTeamMembers()
    }
    setTeamLoading(false)
  }

  async function deleteTeamMember(id, email) {
    if (!confirm(`Remove ${email}? They will no longer be able to log in.`)) return
    const { data: { session } } = await supabase.auth.getSession()
    await fetch(`/api/admin/delete-user?id=${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
    fetchTeamMembers()
  }

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
      youtube_url: broadcastForm.youtube_url?.trim() || null,
    })
    if (error) {
      alert('Error: ' + error.message)
    } else {
      setBroadcastSuccess('Message pushed to all clients!')
      setBroadcastForm({ title: '', body: '', type: 'update', youtube_url: '' })
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
          <button style={{ ...s.tab, ...(activeTab === 'team' ? s.tabActive : s.tabInactive) }} onClick={() => setActiveTab('team')}>Team</button>
          <button style={{ ...s.tab, ...(activeTab === 'time' ? s.tabActive : s.tabInactive) }} onClick={() => { setActiveTab('time'); fetchTimeData(timeFilter) }}>Time Tracking</button>
        </div>

      {activeTab === 'broadcasts' && (() => {
        const getYtId = (url) => {
          if (!url) return null
          const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
          return m ? m[1] : null
        }
        const TYPE_CFG = {
          update:   { label: 'Update',   desc: 'Share news or announcements',   accent: '#4ade80', bg: 'rgba(74,222,128,0.08)',  border: 'rgba(74,222,128,0.25)',
            icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg> },
          tip:      { label: 'Tip',      desc: 'Share a strategy or trick',      accent: '#fbbf24', bg: 'rgba(251,191,36,0.08)',  border: 'rgba(251,191,36,0.25)',
            icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg> },
          video:    { label: 'Video',    desc: 'Embed a YouTube video',          accent: '#A175FC', bg: 'rgba(161,117,252,0.08)', border: 'rgba(161,117,252,0.25)',
            icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg> },
          industry: { label: 'Industry', desc: 'Market or industry insights',    accent: '#60a5fa', bg: 'rgba(96,165,250,0.08)',  border: 'rgba(96,165,250,0.25)',
            icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 20h20M4 20V10l8-6 8 6v10"/><path d="M10 20v-6h4v6"/></svg> },
        }
        const cfg = TYPE_CFG[broadcastForm.type] || TYPE_CFG.update
        const ytId = broadcastForm.type === 'video' ? getYtId(broadcastForm.youtube_url) : null
        const canSubmit = broadcastForm.title.trim() && (broadcastForm.type === 'video' ? true : broadcastForm.body.trim())

        return (
          <div style={s.grid}>

            {/* ── Create form ── */}
            <div style={s.card}>
              <div style={s.cardTitle}>New post</div>
              <div style={s.cardSub}>Published instantly to the Value Feed of all clients</div>

              {broadcastSuccess && <div style={s.success}>{broadcastSuccess}</div>}

              <form onSubmit={handleBroadcast}>
                {/* Type selector */}
                <label style={s.label}>Content type</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 20 }}>
                  {Object.entries(TYPE_CFG).map(([id, t]) => (
                    <button key={id} type="button"
                      onClick={() => setBroadcastForm({...broadcastForm, type: id})}
                      style={{ padding: '11px 14px', borderRadius: 10, border: `1px solid ${broadcastForm.type === id ? t.border : 'rgba(255,255,255,0.07)'}`, background: broadcastForm.type === id ? t.bg : 'transparent', cursor: 'pointer', textAlign: 'left', transition: 'all .15s', fontFamily: "'Inter Tight', sans-serif" }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ color: broadcastForm.type === id ? t.accent : 'rgba(255,255,255,0.25)', display: 'flex', transition: 'color .15s' }}>{t.icon}</span>
                        <div>
                          <div style={{ fontSize: 12.5, fontWeight: 700, color: broadcastForm.type === id ? '#fff' : 'rgba(255,255,255,0.45)', transition: 'color .15s' }}>{t.label}</div>
                          <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.25)', marginTop: 1 }}>{t.desc}</div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>

                {/* YouTube URL + thumbnail preview */}
                {broadcastForm.type === 'video' && (
                  <div style={{ marginBottom: 14 }}>
                    <label style={s.label}>YouTube URL</label>
                    <input style={s.input} value={broadcastForm.youtube_url} onChange={e => setBroadcastForm({...broadcastForm, youtube_url: e.target.value})} placeholder="https://youtube.com/watch?v=..." />
                    {ytId && (
                      <div style={{ borderRadius: 8, overflow: 'hidden', position: 'relative', paddingTop: '36%', marginTop: -6, marginBottom: 14 }}>
                        <img src={`https://img.youtube.com/vi/${ytId}/maxresdefault.jpg`} alt="thumb" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, transparent 50%, rgba(13,6,32,0.85) 100%)' }} />
                        <div style={{ position: 'absolute', bottom: 8, left: 10, fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.55)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Thumbnail preview</div>
                        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                          <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', border: '1.5px solid rgba(255,255,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="#fff" style={{ marginLeft: 2 }}><polygon points="5 3 19 12 5 21 5 3"/></svg>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Title */}
                <label style={s.label}>Title</label>
                <input style={{ ...s.input, fontSize: 14, fontWeight: 600 }} value={broadcastForm.title} onChange={e => setBroadcastForm({...broadcastForm, title: e.target.value})} required placeholder={broadcastForm.type === 'tip' ? 'Your tip in one sentence…' : broadcastForm.type === 'video' ? 'Video title…' : 'Post title…'} />

                {/* Body */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                  <label style={{ ...s.label, marginBottom: 0 }}>{broadcastForm.type === 'video' ? 'Description' : 'Content'} {broadcastForm.type === 'video' && <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span>}</label>
                  <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)' }}>{broadcastForm.body.length} chars</span>
                </div>
                <textarea style={{ ...s.textarea, minHeight: 110 }} value={broadcastForm.body} onChange={e => setBroadcastForm({...broadcastForm, body: e.target.value})} required={broadcastForm.type !== 'video'} placeholder={broadcastForm.type === 'tip' ? 'Explain the tip in detail — be specific and actionable…' : broadcastForm.type === 'video' ? 'What will viewers learn or take away from this video…' : broadcastForm.type === 'industry' ? 'Share the insight and what it means for clients…' : 'Write your update here…'} />

                <button style={{ ...s.btn, opacity: canSubmit ? 1 : 0.45, cursor: canSubmit ? 'pointer' : 'not-allowed', background: cfg.accent === '#A175FC' ? '#A175FC' : cfg.accent === '#4ade80' ? 'linear-gradient(135deg,#22c55e,#4ade80)' : cfg.accent === '#fbbf24' ? 'linear-gradient(135deg,#f59e0b,#fbbf24)' : '#A175FC', color: cfg.accent === '#fbbf24' ? '#1a0835' : '#fff', boxShadow: `0 4px 16px ${cfg.accent}40` }} type="submit" disabled={broadcastLoading || !canSubmit}>
                  {broadcastLoading ? 'Publishing…' : `Publish ${cfg.label}`}
                </button>
              </form>
            </div>

            {/* ── Post history ── */}
            <div style={s.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
                <div>
                  <div style={s.cardTitle}>Published — {broadcasts.length}</div>
                  <div style={{ ...s.cardSub, marginBottom: 0 }}>Live in the Value Feed</div>
                </div>
              </div>

              {broadcasts.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px 0', color: '#4a7fb5', fontSize: 13 }}>No posts yet. Create your first one.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {broadcasts.map(b => {
                    const tc = TYPE_CFG[b.type] || TYPE_CFG.update
                    const bYtId = b.type === 'video' ? getYtId(b.youtube_url) : null
                    return (
                      <div key={b.id} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', transition: 'background .15s', borderRadius: 8 }}>
                        {/* Video thumbnail or type icon */}
                        {bYtId ? (
                          <div style={{ width: 72, height: 46, borderRadius: 7, overflow: 'hidden', flexShrink: 0, background: '#0d0620', position: 'relative' }}>
                            <img src={`https://img.youtube.com/vi/${bYtId}/mqdefault.jpg`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="rgba(255,255,255,0.8)"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                            </div>
                          </div>
                        ) : (
                          <div style={{ width: 34, height: 34, borderRadius: 8, background: tc.bg, border: `1px solid ${tc.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: tc.accent, flexShrink: 0, marginTop: 2 }}>
                            {tc.icon}
                          </div>
                        )}

                        {/* Content */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                            <span style={{ fontSize: 10, fontWeight: 700, color: tc.accent, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{tc.label}</span>
                            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)' }}>{new Date(b.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                          </div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', lineHeight: 1.3, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.title}</div>
                          {b.body && <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.35)', lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.body}</div>}
                        </div>

                        {/* Delete */}
                        <button onClick={() => deleteBroadcast(b.id)}
                          style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.2)', cursor: 'pointer', padding: '4px 6px', borderRadius: 6, transition: 'color .15s, background .15s', flexShrink: 0 }}
                          onMouseEnter={e => { e.currentTarget.style.color='#f87171'; e.currentTarget.style.background='rgba(248,113,113,0.08)' }}
                          onMouseLeave={e => { e.currentTarget.style.color='rgba(255,255,255,0.2)'; e.currentTarget.style.background='none' }}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

          </div>
        )
      })()}

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

      {activeTab === 'team' && (
        <div style={s.grid}>
          <div style={s.card}>
            <div style={s.cardTitle}>Add team member</div>
            <div style={s.cardSub}>Account is created instantly — no email confirmation required</div>
            {teamSuccess && <div style={s.success}>{teamSuccess}</div>}
            {teamError && <div style={{ background: 'rgba(255,107,138,0.1)', border: '1px solid rgba(255,107,138,0.3)', borderRadius: '8px', padding: '10px 14px', color: '#ff6b8a', fontSize: '13px', marginBottom: '16px' }}>{teamError}</div>}
            <form onSubmit={handleCreateTeamMember}>
              <label style={s.label}>Name</label>
              <input style={s.input} value={teamForm.name} onChange={e => setTeamForm({...teamForm, name: e.target.value})} required placeholder="Jan de Vries" />

              <label style={s.label}>Email</label>
              <input style={s.input} type="email" value={teamForm.email} onChange={e => setTeamForm({...teamForm, email: e.target.value})} required placeholder="jan@lynqagency.com" />

              <label style={s.label}>Password</label>
              <input style={s.input} type="password" value={teamForm.password} onChange={e => setTeamForm({...teamForm, password: e.target.value})} required placeholder="Min. 6 characters" />

              <label style={s.label}>Role</label>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
                {['developer', 'manager'].map(r => (
                  <button key={r} type="button" style={s.typePill(r, teamForm.role)} onClick={() => setTeamForm({...teamForm, role: r})}>
                    {r === 'developer' ? 'Developer' : 'Manager'}
                  </button>
                ))}
              </div>

              <button style={s.btn} type="submit" disabled={teamLoading}>
                {teamLoading ? 'Creating...' : 'Create account'}
              </button>
            </form>
          </div>

          <div style={s.card}>
            <div style={s.cardTitle}>Team — {teamMembers.length}</div>
            <div style={s.cardSub}>These users can log in via /login</div>
            {teamMembers.length === 0 && <div style={{ color: '#4a7fb5', fontSize: '13px' }}>No team members yet.</div>}
            {teamMembers.map(m => (
              <div key={m.id} style={s.clientRow}>
                <div>
                  <div style={{ fontWeight: '600', fontSize: '14px' }}>{m.name}</div>
                  <div style={{ color: '#4a7fb5', fontSize: '12px', marginTop: '2px' }}>{m.email}</div>
                  <div style={{ fontSize: '11px', color: '#4a7fb5', marginTop: '2px' }}>{new Date(m.created_at).toLocaleDateString('en-US')}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ ...s.pill, background: 'rgba(161,117,252,0.12)', color: '#A175FC', border: '1px solid rgba(161,117,252,0.2)' }}>{m.role}</span>
                  <button onClick={() => deleteTeamMember(m.id, m.email)} style={{ background: 'none', border: 'none', color: '#ff6b8a', cursor: 'pointer', fontSize: '14px' }}>✕</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'time' && (() => {
        const fmtSec = (sec) => {
          if (!sec || sec <= 0) return '—'
          const h = Math.floor(sec / 3600), m = Math.round((sec % 3600) / 60)
          return h === 0 ? `${m}m` : m > 0 ? `${h}h ${m}m` : `${h}h`
        }
        const fmtT = (iso) => iso ? new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }) : '—'
        const fmtD = (iso) => iso ? new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : '—'
        const durSec = (s) => s.clocked_out_at
          ? Math.round((new Date(s.clocked_out_at) - new Date(s.clocked_in_at)) / 1000)
          : (s.active_seconds || 0) + (s.idle_seconds || 0)

        const sessions = timeData?.sessions || []
        const members = timeData?.members || []
        const activeCount = timeData?.active_count ?? 0
        const pausedCount = timeData?.paused_count ?? 0
        const workedSec = (s) => {
          if (!s.clocked_out_at) return s.active_seconds || 0
          const total = Math.round((new Date(s.clocked_out_at) - new Date(s.clocked_in_at)) / 1000)
          return Math.max(0, total - (s.paused_seconds || 0))
        }
        const totalSec = sessions.reduce((sum, s) => sum + workedSec(s), 0)

        const exportCSV = () => {
          const rows = [['Name', 'Date', 'Clock In', 'Clock Out', 'Worked (h)', 'Break (h)', 'Report']]
          sessions.forEach(s => {
            const wSec = workedSec(s)
            const worked = s.clocked_out_at ? (wSec / 3600).toFixed(2) : ''
            const brk = s.paused_seconds > 0 ? (s.paused_seconds / 3600).toFixed(2) : '0'
            rows.push([
              s.member_name || '',
              fmtD(s.clocked_in_at),
              fmtT(s.clocked_in_at),
              fmtT(s.clocked_out_at),
              worked,
              brk,
              (s.eod_report || '').replace(/"/g, '""'),
            ])
          })
          const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n')
          const a = document.createElement('a')
          a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
          a.download = `time-tracking-${timeFilter}-${new Date().toISOString().slice(0,10)}.csv`
          a.click()
        }

        return (
          <div>
            {/* Filter + export row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
              <div style={{ display: 'flex', gap: 6 }}>
                {[['today','Today'],['week','This week'],['month','This month']].map(([id, label]) => (
                  <button key={id} onClick={() => { setTimeFilter(id); fetchTimeData(id) }}
                    style={{ padding: '7px 16px', borderRadius: 8, border: '1px solid', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: "'Inter Tight', sans-serif", transition: 'all .15s',
                      borderColor: timeFilter === id ? '#A175FC' : 'rgba(255,255,255,0.08)',
                      background: timeFilter === id ? 'rgba(161,117,252,0.15)' : 'transparent',
                      color: timeFilter === id ? '#A175FC' : '#4a7fb5' }}>
                    {label}
                  </button>
                ))}
              </div>
              <button onClick={exportCSV} style={{ padding: '7px 16px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: "'Inter Tight', sans-serif", transition: 'all .15s' }}>
                Export CSV
              </button>
            </div>

            {/* Summary cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
              {[
                { label: 'Active now', value: activeCount, color: '#4ade80', sub: pausedCount > 0 ? `${pausedCount} on break` : null },
                { label: 'Total worked', value: fmtSec(totalSec), color: '#A175FC', sub: null },
                { label: 'Sessions', value: sessions.filter(s2 => s2.clocked_out_at).length, color: '#60a5fa', sub: null },
                { label: 'Team members', value: members.length, color: '#f59e0b', sub: null },
              ].map(({ label, value, color, sub }) => (
                <div key={label} style={s.statCard}>
                  <div style={{ ...s.statNum, color }}>{value}</div>
                  <div style={s.statLabel}>{label}</div>
                  {sub && <div style={{ fontSize: '11px', color: '#fbbf24', marginTop: '3px', fontWeight: 600 }}>{sub}</div>}
                </div>
              ))}
            </div>

            {timeLoading ? (
              <div style={{ textAlign: 'center', padding: '32px', color: '#4a7fb5', fontSize: 13 }}>Loading…</div>
            ) : sessions.length === 0 ? (
              <div style={{ ...s.card, textAlign: 'center', color: '#4a7fb5', fontSize: 13 }}>No sessions in this period.</div>
            ) : (
              <div style={s.card}>
                {/* Per member summary */}
                {members.length > 0 && (
                  <div style={{ marginBottom: 24 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#4a7fb5', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Per employee</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 12 }}>
                      {members.map(m => (
                        <div key={m.id} style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${m.is_paused ? 'rgba(251,191,36,0.2)' : m.is_active ? 'rgba(74,222,128,0.15)' : 'rgba(255,255,255,0.06)'}`, borderRadius: 10, padding: '14px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                            <div style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, background: m.is_paused ? '#fbbf24' : m.is_active ? '#4ade80' : 'rgba(255,255,255,0.15)', boxShadow: m.is_paused ? '0 0 6px rgba(251,191,36,0.6)' : m.is_active ? '0 0 6px rgba(74,222,128,0.6)' : 'none' }} />
                            <div style={{ fontSize: 12.5, fontWeight: 700, color: '#fff' }}>{m.name}</div>
                            {m.is_paused && <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 600, color: '#fbbf24', background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: 4, padding: '2px 7px' }}>Break</span>}
                            {m.is_active && !m.is_paused && <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 600, color: '#4ade80', background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.2)', borderRadius: 4, padding: '2px 7px' }}>Active</span>}
                          </div>
                          <div style={{ fontSize: 22, fontWeight: 800, color: '#A175FC', letterSpacing: '-0.03em', marginBottom: 4 }}>{fmtSec(m.worked_seconds)}</div>
                          <div style={{ display: 'flex', gap: 10, fontSize: 11, color: '#4a7fb5' }}>
                            <span>{m.sessions_count} session{m.sessions_count !== 1 ? 's' : ''}</span>
                            {m.paused_seconds > 0 && <span style={{ color: 'rgba(251,191,36,0.6)' }}>Break {fmtSec(m.paused_seconds)}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Table header */}
                <div style={{ display: 'grid', gridTemplateColumns: '140px 110px 65px 65px 70px 60px 1fr', gap: 10, padding: '10px 0', borderTop: members.length > 0 ? '1px solid rgba(255,255,255,0.06)' : 'none', borderBottom: '1px solid rgba(255,255,255,0.06)', marginBottom: 4 }}>
                  {['Employee', 'Date', 'In', 'Out', 'Worked', 'Break', 'Report'].map(h => (
                    <div key={h} style={{ fontSize: 10, fontWeight: 700, color: '#4a7fb5', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</div>
                  ))}
                </div>
                {sessions.map(s2 => {
                  const wSec = workedSec(s2)
                  const hrs = wSec > 0 ? (wSec / 3600).toFixed(2) : (s2.clocked_out_at ? '0.00' : '—')
                  const brk = s2.paused_seconds > 0 ? fmtSec(s2.paused_seconds) : '—'
                  return (
                    <div key={s2.id} style={{ display: 'grid', gridTemplateColumns: '140px 110px 65px 65px 70px 60px 1fr', gap: 10, alignItems: 'start', padding: '11px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: 'default' }}>
                      <div>
                        <div style={{ fontSize: 12.5, fontWeight: 600, color: '#fff' }}>{s2.member_name}</div>
                        <div style={{ fontSize: 11, color: '#4a7fb5', marginTop: 1 }}>{s2.member_email}</div>
                      </div>
                      <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.6)' }}>{fmtD(s2.clocked_in_at)}</div>
                      <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.6)', fontVariantNumeric: 'tabular-nums' }}>{fmtT(s2.clocked_in_at)}</div>
                      <div style={{ fontSize: 12.5, color: s2.clocked_out_at ? 'rgba(255,255,255,0.6)' : '#4ade80', fontVariantNumeric: 'tabular-nums' }}>
                        {s2.clocked_out_at ? fmtT(s2.clocked_out_at) : 'Active'}
                      </div>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: '#fff' }}>{hrs}h</div>
                      <div style={{ fontSize: 12.5, color: s2.paused_seconds > 0 ? 'rgba(251,191,36,0.7)' : 'rgba(255,255,255,0.25)' }}>{brk}</div>
                      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', lineHeight: 1.45, wordBreak: 'break-word' }}>
                        {s2.eod_report || <span style={{ color: 'rgba(255,255,255,0.2)', fontStyle: 'italic' }}>No report</span>}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })()}

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
