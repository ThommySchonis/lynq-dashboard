'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import {
  LayoutDashboard, Users, UserPlus, Radio, Bell, MessageSquare,
  UserCheck, Clock, BarChart2, Calendar, ArrowLeft,
} from 'lucide-react'

const ADMIN_EMAIL = 'info@lynqagency.com'

const CSS = `
  @import url('https://api.fontshare.com/v2/css?f[]=switzer@400,500,600,700,800&display=swap');
  .ap-root { font-family:'Switzer',-apple-system,BlinkMacSystemFont,sans-serif; -webkit-font-smoothing:antialiased; box-sizing:border-box; }
  .ap-root *, .ap-root *::before, .ap-root *::after { box-sizing:border-box; margin:0; padding:0; }

  .ap-nav-item {
    display:flex; align-items:center; gap:8px;
    padding:7px 8px; border-radius:6px;
    font-size:12.5px; color:rgba(255,255,255,0.4);
    cursor:pointer; margin-bottom:1px;
    transition:all 0.12s; border:none; background:none;
    width:100%; text-align:left; font-family:'Switzer',-apple-system,BlinkMacSystemFont,sans-serif;
    border-left:2.5px solid transparent;
  }
  .ap-nav-item:hover { background:rgba(255,255,255,0.06); color:rgba(255,255,255,0.7); }
  .ap-nav-item.active {
    background:rgba(139,92,246,0.14); color:#C4B5FD; font-weight:500;
    border-left-color:#8B5CF6; padding-left:5.5px;
  }
  .ap-nav-item.active svg { opacity:1; color:#A175FC; }

  .ap-input {
    height:38px; width:100%;
    border:1px solid rgba(0,0,0,0.10); border-radius:7px;
    font-size:13px; padding:0 12px;
    background:#FFFFFF; color:#0F0F10;
    font-family:'Switzer',-apple-system,BlinkMacSystemFont,sans-serif;
    outline:none; transition:border-color .15s, box-shadow .15s;
    margin-bottom:14px; display:block;
  }
  .ap-input:focus {
    border-color:rgba(139,92,246,0.4);
    box-shadow:0 0 0 3px rgba(139,92,246,0.08);
  }
  .ap-textarea {
    width:100%; border:1px solid rgba(0,0,0,0.10); border-radius:7px;
    font-size:13px; padding:10px 12px;
    background:#FFFFFF; color:#0F0F10;
    font-family:'Switzer',-apple-system,BlinkMacSystemFont,sans-serif;
    outline:none; transition:border-color .15s, box-shadow .15s;
    margin-bottom:14px; display:block; resize:vertical; min-height:100px;
  }
  .ap-textarea:focus {
    border-color:rgba(139,92,246,0.4);
    box-shadow:0 0 0 3px rgba(139,92,246,0.08);
  }
  .ap-btn-primary {
    background:#0F0F10; color:#FFFFFF;
    border:none; border-radius:8px;
    width:100%; height:40px;
    font-size:13px; font-weight:600; cursor:pointer;
    margin-top:4px; transition:background .15s;
    font-family:'Switzer',-apple-system,BlinkMacSystemFont,sans-serif;
  }
  .ap-btn-primary:hover:not(:disabled) { background:#1a1a1a; }
  .ap-btn-primary:disabled { opacity:.45; cursor:not-allowed; }

  .ap-card {
    background:#FFFFFF; border:1px solid rgba(0,0,0,0.07);
    border-radius:10px; overflow:hidden;
  }
  .ap-card-body { padding:24px; }
  .ap-label {
    display:block; font-size:10px; font-weight:600;
    text-transform:uppercase; letter-spacing:.07em;
    color:#9CA3AF; margin-bottom:4px;
  }
  .ap-section-divider {
    border-top:1px solid rgba(0,0,0,0.06);
    padding-top:16px; margin-top:16px;
  }
  .ap-client-row {
    display:flex; align-items:center; gap:12px;
    padding:12px 18px; border-bottom:1px solid rgba(0,0,0,0.05);
    transition:background .12s;
  }
  .ap-client-row:last-child { border-bottom:none; }
  .ap-client-row:hover { background:#F9F9FB; }

  .ap-metric-card {
    background:#FFFFFF; border:1px solid rgba(0,0,0,0.07);
    border-radius:10px; overflow:hidden;
    padding:18px 20px 20px;
  }
  .ap-metric-topbar { height:3px; margin:-18px -20px 16px; }

  .ap-type-pill {
    display:flex; align-items:center; gap:8px;
    padding:11px 14px; border-radius:10px; border:1px solid;
    cursor:pointer; text-align:left; transition:all .15s;
    background:transparent;
    font-family:'Switzer',-apple-system,BlinkMacSystemFont,sans-serif;
  }
  .ap-topic-pill {
    padding:5px 13px; border-radius:100px; border:1px solid rgba(0,0,0,0.10);
    background:transparent; color:#6B7280; font-size:12px; font-weight:600;
    cursor:pointer; transition:all .15s;
    font-family:'Switzer',-apple-system,BlinkMacSystemFont,sans-serif;
  }
  .ap-topic-pill.selected { border-color:rgba(0,0,0,0.3); background:#F5F5F5; color:#0F0F10; }
  .ap-topic-pill:hover { border-color:rgba(0,0,0,0.2); color:#333; }

  .ap-filter-btn {
    padding:7px 16px; border-radius:8px; border:1px solid rgba(0,0,0,0.10);
    font-size:12px; font-weight:600; cursor:pointer;
    background:transparent; color:#6B7280;
    font-family:'Switzer',-apple-system,BlinkMacSystemFont,sans-serif;
    transition:all .15s;
  }
  .ap-filter-btn.active {
    border-color:rgba(139,92,246,0.4);
    background:rgba(139,92,246,0.06);
    color:#7C3AED;
  }

  .ap-success { background:rgba(16,185,129,0.06); border:1px solid rgba(16,185,129,0.2); border-radius:8px; padding:10px 14px; color:#059669; font-size:13px; margin-bottom:16px; }
  .ap-error   { background:rgba(239,68,68,0.06);  border:1px solid rgba(239,68,68,0.2);  border-radius:8px; padding:10px 14px; color:#DC2626; font-size:13px; margin-bottom:16px; }
`

// ─── Nav config ──────────────────────────────────────────────────────────────
const NAV = [
  { group: 'OVERVIEW', items: [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  ]},
  { group: 'CLIENTS', items: [
    { id: 'clients',       label: 'Clients',       icon: Users,    badge: 'clientCount' },
    { id: 'create-client', label: 'Create Client',  icon: UserPlus },
  ]},
  { group: 'COMMUNICATION', items: [
    { id: 'broadcasts',    label: 'Broadcasts',     icon: Radio },
    { id: 'notifications', label: 'Notifications',  icon: Bell },
    { id: 'inquiries',     label: 'Inquiries',      icon: MessageSquare, badge: 'newInquiries' },
  ]},
  { group: 'TEAM', items: [
    { id: 'team', label: 'Team Members', icon: UserCheck },
    { id: 'time', label: 'Time Tracking', icon: Clock },
  ]},
  { group: 'FINANCE', items: [
    { id: 'finance', label: 'Finance',  icon: BarChart2 },
    { id: 'events',  label: 'Events',   icon: Calendar },
  ]},
]

export default function AdminPage() {
  const [clients, setClients]             = useState([])
  const [broadcasts, setBroadcasts]       = useState([])
  const [notifications, setNotifications] = useState([])
  const [teamMembers, setTeamMembers]     = useState([])
  const [loading, setLoading]             = useState(false)
  const [broadcastLoading, setBroadcastLoading] = useState(false)
  const [notifLoading, setNotifLoading]   = useState(false)
  const [teamLoading, setTeamLoading]     = useState(false)
  const [success, setSuccess]             = useState('')
  const [broadcastSuccess, setBroadcastSuccess] = useState('')
  const [notifSuccess, setNotifSuccess]   = useState('')
  const [teamSuccess, setTeamSuccess]     = useState('')
  const [teamError, setTeamError]         = useState('')
  const [authorized, setAuthorized]       = useState(false)
  const [activeTab, setActiveTab]         = useState('dashboard')
  const [teamForm, setTeamForm]           = useState({ name: '', email: '', password: '', role: 'developer' })
  const [finance, setFinance]             = useState(null)
  const [financeLoading, setFinanceLoading] = useState(false)
  const [timeData, setTimeData]           = useState(null)
  const [timeLoading, setTimeLoading]     = useState(false)
  const [timeFilter, setTimeFilter]       = useState('week')
  const [broadcastForm, setBroadcastForm] = useState({ title: '', body: '', type: 'update', youtube_url: '', topic: '' })
  const [broadcastReactions, setBroadcastReactions] = useState([])
  const [masterclasses, setMasterclasses] = useState([])
  const [mcForm, setMcForm]               = useState({ title: '', speaker: '', description: '', scheduled_at: '', zoom_url: '' })
  const [mcLoading, setMcLoading]         = useState(false)
  const [mcSuccess, setMcSuccess]         = useState('')
  const [mcError, setMcError]             = useState('')
  const [editingZoom, setEditingZoom]     = useState(null)
  const [inquiries, setInquiries]         = useState([])
  const [notifForm, setNotifForm]         = useState({ title: '', body: '', type: 'info' })
  const [form, setForm] = useState({
    company_name: '', email: '', password: '',
    gorgias_domain: '', gorgias_api_key: '',
    shopify_domain: '', shopify_api_key: '',
    parcel_panel_api_key: '',
  })

  useEffect(() => {
    async function checkAuth() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || user.email !== ADMIN_EMAIL) { window.location.href = '/admin/login'; return }
      setAuthorized(true)
      fetchClients(); fetchBroadcasts(); fetchNotifications()
      fetchTeamMembers(); fetchMasterclasses(); fetchBroadcastReactions(); fetchInquiries()
    }
    checkAuth()
  }, [])

  async function fetchInquiries() {
    const { data } = await supabase.from('service_inquiries').select('*').order('created_at', { ascending: false })
    if (data) setInquiries(data)
  }
  async function markInquiryRead(id) {
    await supabase.from('service_inquiries').update({ status: 'read' }).eq('id', id)
    setInquiries(prev => prev.map(i => i.id === id ? { ...i, status: 'read' } : i))
  }
  async function fetchBroadcastReactions() {
    const { data } = await supabase.from('broadcast_reactions').select('broadcast_id, emoji')
    if (data) setBroadcastReactions(data)
  }
  async function togglePin(id, isPinned) {
    if (!isPinned) await supabase.from('broadcasts').update({ is_pinned: false }).eq('is_pinned', true)
    await supabase.from('broadcasts').update({ is_pinned: !isPinned }).eq('id', id)
    fetchBroadcasts()
  }
  async function fetchMasterclasses() {
    const { data } = await supabase.from('masterclasses').select('*').order('scheduled_at', { ascending: false })
    if (data) setMasterclasses(data)
  }
  async function handleCreateMasterclass(e) {
    e.preventDefault(); setMcLoading(true); setMcSuccess(''); setMcError('')
    const { error } = await supabase.from('masterclasses').insert({
      title: mcForm.title, speaker: mcForm.speaker?.trim() || null,
      description: mcForm.description?.trim() || null,
      scheduled_at: new Date(mcForm.scheduled_at).toISOString(),
      zoom_url: mcForm.zoom_url?.trim() || null,
    })
    if (error) setMcError(error.message)
    else { setMcSuccess('Masterclass scheduled!'); setMcForm({ title:'', speaker:'', description:'', scheduled_at:'', zoom_url:'' }); fetchMasterclasses() }
    setMcLoading(false)
  }
  async function deleteMasterclass(id) {
    if (!confirm('Delete this masterclass?')) return
    await supabase.from('masterclasses').delete().eq('id', id)
    fetchMasterclasses()
  }
  async function updateZoomUrl(id, url) {
    await supabase.from('masterclasses').update({ zoom_url: url?.trim() || null }).eq('id', id)
    setEditingZoom(null); fetchMasterclasses()
  }
  async function fetchTeamMembers() {
    const { data } = await supabase.from('team_members').select('*').order('created_at', { ascending: false })
    if (data) setTeamMembers(data)
  }
  async function fetchTimeData(f = timeFilter) {
    setTimeLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch(`/api/time?filter=${f}`, { headers: { Authorization: `Bearer ${session.access_token}` } })
    if (res.ok) setTimeData(await res.json())
    setTimeLoading(false)
  }
  async function handleCreateTeamMember(e) {
    e.preventDefault(); setTeamLoading(true); setTeamSuccess(''); setTeamError('')
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/admin/create-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify(teamForm),
    })
    const d = await res.json()
    if (!res.ok) setTeamError(d.error || 'Something went wrong')
    else { setTeamSuccess(`${teamForm.name} can now log in with ${teamForm.email}`); setTeamForm({ name:'', email:'', password:'', role:'developer' }); fetchTeamMembers() }
    setTeamLoading(false)
  }
  async function deleteTeamMember(id, email) {
    if (!confirm(`Remove ${email}? They will no longer be able to log in.`)) return
    const { data: { session } } = await supabase.auth.getSession()
    await fetch(`/api/admin/delete-user?id=${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${session.access_token}` } })
    fetchTeamMembers()
  }
  async function fetchFinance() {
    setFinanceLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/admin/finance', { headers: { Authorization: `Bearer ${session.access_token}`, 'x-admin-email': ADMIN_EMAIL } })
    if (res.ok) setFinance(await res.json())
    setFinanceLoading(false)
  }
  async function fetchNotifications() {
    const { data } = await supabase.from('notifications').select('*').order('created_at', { ascending: false })
    if (data) setNotifications(data)
  }
  async function handleNotification(e) {
    e.preventDefault(); setNotifLoading(true); setNotifSuccess('')
    const { error } = await supabase.from('notifications').insert({ title: notifForm.title, body: notifForm.body, type: notifForm.type })
    if (error) alert('Error: ' + error.message)
    else { setNotifSuccess('Notification pushed!'); setNotifForm({ title:'', body:'', type:'info' }); fetchNotifications() }
    setNotifLoading(false)
  }
  async function deleteNotification(id) {
    await supabase.from('notifications').delete().eq('id', id); fetchNotifications()
  }
  async function fetchBroadcasts() {
    const { data } = await supabase.from('broadcasts').select('*').order('created_at', { ascending: false })
    if (data) setBroadcasts(data)
  }
  async function handleBroadcast(e) {
    e.preventDefault(); setBroadcastLoading(true); setBroadcastSuccess('')
    const { error } = await supabase.from('broadcasts').insert({
      title: broadcastForm.title, body: broadcastForm.body, type: broadcastForm.type,
      youtube_url: broadcastForm.youtube_url?.trim() || null,
      topic: broadcastForm.topic?.trim() || null,
    })
    if (error) alert('Error: ' + error.message)
    else { setBroadcastSuccess('Message pushed to all clients!'); setBroadcastForm({ title:'', body:'', type:'update', youtube_url:'', topic:'' }); fetchBroadcasts(); fetchBroadcastReactions() }
    setBroadcastLoading(false)
  }
  async function deleteBroadcast(id) {
    await supabase.from('broadcasts').delete().eq('id', id); fetchBroadcasts(); fetchBroadcastReactions()
  }
  async function fetchClients() {
    const { data } = await supabase.from('clients').select('*').order('created_at', { ascending: false })
    if (data) setClients(data)
  }
  async function handleSubmit(e) {
    e.preventDefault(); setLoading(true); setSuccess('')
    const { data: authData, error: authError } = await supabase.auth.signUp({ email: form.email, password: form.password })
    if (authError) { alert('Error: ' + authError.message); setLoading(false); return }
    const { error: dbError } = await supabase.from('clients').insert({
      company_name: form.company_name, email: form.email,
      gorgias_domain: form.gorgias_domain, gorgias_api_key: form.gorgias_api_key,
      shopify_domain: form.shopify_domain, shopify_api_key: form.shopify_api_key,
      parcel_panel_api_key: form.parcel_panel_api_key, status: 'active',
    })
    if (dbError) { alert('DB Error: ' + dbError.message); setLoading(false); return }
    setSuccess(`Client ${form.company_name} created!`)
    setForm({ company_name:'', email:'', password:'', gorgias_domain:'', gorgias_api_key:'', shopify_domain:'', shopify_api_key:'', parcel_panel_api_key:'' })
    fetchClients(); setLoading(false)
  }

  const newInquiriesCount = inquiries.filter(i => i.status === 'new').length
  const activeClients = clients.filter(c => c.status === 'active').length

  // ─── Tab meta ──────────────────────────────────────────────────────────────
  const TAB_META = {
    dashboard:       { title: 'Dashboard',      sub: 'Overview of your platform' },
    clients:         { title: 'Clients',         sub: `${clients.length} total` },
    'create-client': { title: 'Create Client',   sub: 'Add a new client account' },
    broadcasts:      { title: 'Broadcasts',      sub: `${broadcasts.length} published` },
    notifications:   { title: 'Notifications',   sub: `${notifications.length} sent` },
    inquiries:       { title: 'Inquiries',        sub: newInquiriesCount > 0 ? `${newInquiriesCount} new` : 'All read' },
    team:            { title: 'Team Members',     sub: `${teamMembers.length} members` },
    time:            { title: 'Time Tracking',    sub: 'Session overview' },
    finance:         { title: 'Finance',          sub: 'P&L and AI costs' },
    events:          { title: 'Events',           sub: `${masterclasses.length} masterclasses` },
  }
  const meta = TAB_META[activeTab] || { title: 'Admin', sub: '' }

  if (!authorized) return (
    <div style={{ minHeight:'100vh', background:'#F9F9FB', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Switzer,sans-serif', fontSize:13, color:'#6B7280' }}>
      Checking access…
    </div>
  )

  return (
    <div className="ap-root" style={{ display:'flex', height:'100vh', background:'#F9F9FB', overflow:'hidden' }}>
      <style>{CSS}</style>

      {/* ── Admin Sidebar ── */}
      <div style={{ width:220, background:'#0D0F14', display:'flex', flexDirection:'column', flexShrink:0, height:'100vh' }}>

        {/* Header */}
        <div style={{ padding:'18px 16px', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ fontSize:9, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.12em', color:'rgba(255,255,255,0.25)', marginBottom:2 }}>ADMIN</div>
          <div style={{ fontSize:13, fontWeight:600, color:'#FFFFFF' }}>Lynq &amp; Flow</div>
        </div>

        {/* Nav */}
        <div style={{ padding:'8px 8px', flex:1, overflowY:'auto' }}>
          {NAV.map(({ group, items }) => (
            <div key={group}>
              <div style={{ fontSize:9, textTransform:'uppercase', letterSpacing:'0.1em', color:'rgba(255,255,255,0.2)', padding:'12px 8px 4px' }}>{group}</div>
              {items.map(({ id, label, icon: Icon, badge }) => {
                const badgeCount = badge === 'clientCount' ? clients.length : badge === 'newInquiries' ? newInquiriesCount : 0
                return (
                  <button
                    key={id}
                    className={`ap-nav-item${activeTab === id ? ' active' : ''}`}
                    onClick={() => {
                      setActiveTab(id)
                      if (id === 'finance' && !finance) fetchFinance()
                      if (id === 'time') fetchTimeData(timeFilter)
                    }}
                  >
                    <Icon size={15} strokeWidth={1.75} style={{ opacity: activeTab === id ? 1 : 0.5, flexShrink:0 }} />
                    <span style={{ flex:1 }}>{label}</span>
                    {badgeCount > 0 && (
                      <span style={{ fontSize:10, fontWeight:700, background: badge === 'newInquiries' ? '#f87171' : 'rgba(255,255,255,0.1)', color: badge === 'newInquiries' ? '#fff' : 'rgba(255,255,255,0.5)', borderRadius:100, padding:'1px 6px', lineHeight:1.5 }}>
                        {badgeCount}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ padding:'12px 10px', borderTop:'1px solid rgba(255,255,255,0.06)' }}>
          <a href="/home" style={{ display:'flex', alignItems:'center', gap:6, textDecoration:'none', color:'rgba(255,255,255,0.35)', fontSize:12, transition:'color .15s' }}
            onMouseEnter={e => e.currentTarget.style.color='rgba(255,255,255,0.6)'}
            onMouseLeave={e => e.currentTarget.style.color='rgba(255,255,255,0.35)'}>
            <ArrowLeft size={13} strokeWidth={1.75} />
            Back to Dashboard
          </a>
        </div>
      </div>

      {/* ── Main Content ── */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>

        {/* Topbar */}
        <div style={{ height:46, background:'#FFFFFF', borderBottom:'1px solid rgba(0,0,0,0.07)', padding:'0 24px', display:'flex', alignItems:'center', gap:12, flexShrink:0 }}>
          <div style={{ fontSize:14, fontWeight:600, color:'#0F0F10' }}>{meta.title}</div>
          {meta.sub && <div style={{ fontSize:13, color:'#6B7280' }}>{meta.sub}</div>}
          <div style={{ flex:1 }} />
          <button
            onClick={async () => { await supabase.auth.signOut(); window.location.href = '/admin/login' }}
            style={{ padding:'5px 14px', background:'#F5F5F5', border:'1px solid rgba(0,0,0,0.08)', borderRadius:7, fontSize:12, fontWeight:600, color:'#555', cursor:'pointer', fontFamily:'inherit' }}
          >
            Log out
          </button>
        </div>

        {/* Scrollable body */}
        <div style={{ flex:1, overflowY:'auto', padding:24 }}>

          {/* ── DASHBOARD ── */}
          {activeTab === 'dashboard' && (
            <div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:24 }}>
                {[
                  { label:'TOTAL CLIENTS', value:clients.length, icon:Users, topGrad:'linear-gradient(90deg,#8B5CF6,#A78BFA)', iconBg:'rgba(139,92,246,0.08)', iconColor:'#8B5CF6' },
                  { label:'ACTIVE CLIENTS', value:activeClients, icon:UserCheck, topGrad:'linear-gradient(90deg,#10B981,#34D399)', iconBg:'rgba(16,185,129,0.08)', iconColor:'#10B981' },
                  { label:'BROADCASTS', value:broadcasts.length, icon:Radio, topGrad:'linear-gradient(90deg,#3B82F6,#60A5FA)', iconBg:'rgba(59,130,246,0.08)', iconColor:'#3B82F6' },
                  { label:'NOTIFICATIONS', value:notifications.length, icon:Bell, topGrad:'linear-gradient(90deg,#F59E0B,#FCD34D)', iconBg:'rgba(245,158,11,0.08)', iconColor:'#F59E0B' },
                ].map(({ label, value, icon:Icon, topGrad, iconBg, iconColor }) => (
                  <div key={label} className="ap-metric-card">
                    <div className="ap-metric-topbar" style={{ background:topGrad }} />
                    <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:12 }}>
                      <div style={{ width:36, height:36, borderRadius:8, background:iconBg, display:'flex', alignItems:'center', justifyContent:'center' }}>
                        <Icon size={18} strokeWidth={1.75} color={iconColor} />
                      </div>
                    </div>
                    <div style={{ fontSize:28, fontWeight:800, color:'#0F0F10', letterSpacing:'-0.03em', lineHeight:1, marginBottom:4 }}>{value}</div>
                    <div style={{ fontSize:10, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.07em', color:'#9CA3AF' }}>{label}</div>
                  </div>
                ))}
              </div>

              {/* Recent clients */}
              {clients.length > 0 && (
                <div className="ap-card">
                  <div style={{ padding:'14px 18px', borderBottom:'1px solid rgba(0,0,0,0.06)', fontSize:13, fontWeight:600, color:'#0F0F10' }}>Recent Clients</div>
                  {clients.slice(0,5).map(c => (
                    <div key={c.id} className="ap-client-row">
                      <div style={{ width:32, height:32, borderRadius:'50%', background:'#F0F0F0', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:600, color:'#555', flexShrink:0 }}>
                        {(c.company_name||'?')[0].toUpperCase()}
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:13, fontWeight:500, color:'#0F0F10' }}>{c.company_name}</div>
                        <div style={{ fontSize:12, color:'#6B7280' }}>{c.email}</div>
                      </div>
                      <span style={{ fontSize:11, fontWeight:600, padding:'3px 9px', borderRadius:100, background: c.status==='active' ? 'rgba(16,185,129,0.08)' : '#F5F5F5', color: c.status==='active' ? '#059669' : '#9CA3AF', border:`1px solid ${c.status==='active' ? 'rgba(16,185,129,0.15)' : 'rgba(0,0,0,0.06)'}` }}>
                        {c.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── CLIENTS LIST ── */}
          {activeTab === 'clients' && (
            <div className="ap-card">
              <div style={{ padding:'14px 18px', borderBottom:'1px solid rgba(0,0,0,0.06)', fontSize:13, fontWeight:600, color:'#0F0F10' }}>
                Clients — {clients.length}
              </div>
              {clients.length === 0 && <div style={{ padding:'32px 18px', fontSize:13, color:'#9CA3AF' }}>No clients yet.</div>}
              {clients.map(c => (
                <div key={c.id} className="ap-client-row">
                  <div style={{ width:32, height:32, borderRadius:'50%', background:'#F0F0F0', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:600, color:'#555', flexShrink:0 }}>
                    {(c.company_name||'?')[0].toUpperCase()}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:13, fontWeight:500, color:'#0F0F10' }}>{c.company_name}</div>
                    <div style={{ fontSize:12, color:'#6B7280' }}>{c.email}</div>
                    {c.gorgias_domain && <div style={{ fontSize:11, color:'#9CA3AF', marginTop:1 }}>Gorgias: {c.gorgias_domain}</div>}
                  </div>
                  <span style={{ fontSize:11, fontWeight:600, padding:'3px 9px', borderRadius:100, background: c.status==='active' ? 'rgba(16,185,129,0.08)' : '#F5F5F5', color: c.status==='active' ? '#059669' : '#9CA3AF', border:`1px solid ${c.status==='active' ? 'rgba(16,185,129,0.15)' : 'rgba(0,0,0,0.06)'}` }}>
                    {c.status}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* ── CREATE CLIENT ── */}
          {activeTab === 'create-client' && (
            <div style={{ display:'grid', gridTemplateColumns:'42% 58%', gap:16, alignItems:'start' }}>
              {/* Form */}
              <div className="ap-card">
                <div className="ap-card-body">
                  <div style={{ fontSize:15, fontWeight:600, color:'#0F0F10', marginBottom:2 }}>Create client</div>
                  <div style={{ fontSize:13, color:'#6B7280', marginBottom:20 }}>Create account + configure API integrations</div>
                  {success && <div className="ap-success">{success}</div>}
                  <form onSubmit={handleSubmit}>
                    <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em', color:'#9CA3AF', marginBottom:8 }}>ACCOUNT DETAILS</div>
                    <label className="ap-label">Company Name</label>
                    <input className="ap-input" value={form.company_name} onChange={e => setForm({...form, company_name:e.target.value})} required placeholder="Smith Sisters" />
                    <label className="ap-label">Email</label>
                    <input className="ap-input" type="email" value={form.email} onChange={e => setForm({...form, email:e.target.value})} required placeholder="client@company.com" />
                    <label className="ap-label">Password</label>
                    <input className="ap-input" type="password" value={form.password} onChange={e => setForm({...form, password:e.target.value})} required placeholder="Min. 6 characters" />

                    <div className="ap-section-divider">
                      <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em', color:'#9CA3AF', marginBottom:8 }}>INTEGRATIONS</div>
                    </div>
                    <label className="ap-label">Gorgias Domain</label>
                    <input className="ap-input" value={form.gorgias_domain} onChange={e => setForm({...form, gorgias_domain:e.target.value})} placeholder="store.gorgias.com" />
                    <label className="ap-label">Gorgias API Key</label>
                    <input className="ap-input" value={form.gorgias_api_key} onChange={e => setForm({...form, gorgias_api_key:e.target.value})} placeholder="API key" />
                    <label className="ap-label">Shopify Domain</label>
                    <input className="ap-input" value={form.shopify_domain} onChange={e => setForm({...form, shopify_domain:e.target.value})} placeholder="store.myshopify.com" />
                    <label className="ap-label">Shopify API Key</label>
                    <input className="ap-input" value={form.shopify_api_key} onChange={e => setForm({...form, shopify_api_key:e.target.value})} placeholder="API key" />

                    <div className="ap-section-divider" />
                    <label className="ap-label">Parcel Panel API Key</label>
                    <input className="ap-input" value={form.parcel_panel_api_key} onChange={e => setForm({...form, parcel_panel_api_key:e.target.value})} placeholder="Parcel Panel API key" />
                    <button className="ap-btn-primary" type="submit" disabled={loading}>{loading ? 'Creating…' : 'Create Client'}</button>
                  </form>
                </div>
              </div>

              {/* Client list preview */}
              <div className="ap-card">
                <div style={{ padding:'14px 18px', borderBottom:'1px solid rgba(0,0,0,0.06)', fontSize:13, fontWeight:600, color:'#0F0F10' }}>
                  Clients — {clients.length}
                </div>
                {clients.length === 0 && <div style={{ padding:'32px 18px', fontSize:13, color:'#9CA3AF' }}>No clients yet.</div>}
                {clients.map(c => (
                  <div key={c.id} className="ap-client-row">
                    <div style={{ width:32, height:32, borderRadius:'50%', background:'#F0F0F0', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:600, color:'#555', flexShrink:0 }}>
                      {(c.company_name||'?')[0].toUpperCase()}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:13, fontWeight:500, color:'#0F0F10' }}>{c.company_name}</div>
                      <div style={{ fontSize:12, color:'#6B7280' }}>{c.email}</div>
                    </div>
                    <span style={{ fontSize:11, fontWeight:600, padding:'3px 9px', borderRadius:100, background: c.status==='active' ? 'rgba(16,185,129,0.08)' : '#F5F5F5', color: c.status==='active' ? '#059669' : '#9CA3AF', border:`1px solid ${c.status==='active' ? 'rgba(16,185,129,0.15)' : 'rgba(0,0,0,0.06)'}` }}>
                      {c.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── BROADCASTS ── */}
          {activeTab === 'broadcasts' && (() => {
            const getYtId = (url) => {
              if (!url) return null
              const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
              return m ? m[1] : null
            }
            const TYPE_CFG = {
              update:   { label:'Update',   desc:'News or announcements', accent:'#16A34A', bg:'rgba(22,163,74,0.06)',   border:'rgba(22,163,74,0.2)',   icon:<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg> },
              tip:      { label:'Tip',      desc:'Strategy or trick',     accent:'#D97706', bg:'rgba(217,119,6,0.06)',   border:'rgba(217,119,6,0.2)',   icon:<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg> },
              video:    { label:'Video',    desc:'Embed a YouTube video',  accent:'#7C3AED', bg:'rgba(124,58,237,0.06)',  border:'rgba(124,58,237,0.2)', icon:<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg> },
              industry: { label:'Industry', desc:'Market insights',        accent:'#2563EB', bg:'rgba(37,99,235,0.06)',   border:'rgba(37,99,235,0.2)',  icon:<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M2 20h20M4 20V10l8-6 8 6v10"/><path d="M10 20v-6h4v6"/></svg> },
            }
            const cfg = TYPE_CFG[broadcastForm.type] || TYPE_CFG.update
            const ytId = broadcastForm.type === 'video' ? getYtId(broadcastForm.youtube_url) : null
            const canSubmit = broadcastForm.title.trim() && (broadcastForm.type === 'video' ? true : broadcastForm.body.trim())

            return (
              <div style={{ display:'grid', gridTemplateColumns:'42% 58%', gap:16, alignItems:'start' }}>
                {/* Create form */}
                <div className="ap-card">
                  <div className="ap-card-body">
                    <div style={{ fontSize:15, fontWeight:600, color:'#0F0F10', marginBottom:2 }}>New post</div>
                    <div style={{ fontSize:13, color:'#6B7280', marginBottom:20 }}>Published to the Value Feed of all clients</div>
                    {broadcastSuccess && <div className="ap-success">{broadcastSuccess}</div>}
                    <form onSubmit={handleBroadcast}>
                      <label className="ap-label">Content type</label>
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:16 }}>
                        {Object.entries(TYPE_CFG).map(([id, t]) => (
                          <button key={id} type="button" className="ap-type-pill"
                            onClick={() => setBroadcastForm({...broadcastForm, type:id})}
                            style={{ borderColor: broadcastForm.type === id ? t.border : 'rgba(0,0,0,0.10)', background: broadcastForm.type === id ? t.bg : 'transparent' }}>
                            <span style={{ color: broadcastForm.type === id ? t.accent : '#9CA3AF' }}>{t.icon}</span>
                            <div>
                              <div style={{ fontSize:12.5, fontWeight:600, color: broadcastForm.type === id ? '#0F0F10' : '#6B7280' }}>{t.label}</div>
                              <div style={{ fontSize:10.5, color:'#9CA3AF', marginTop:1 }}>{t.desc}</div>
                            </div>
                          </button>
                        ))}
                      </div>

                      <label className="ap-label">Topic <span style={{ fontWeight:400, textTransform:'none', letterSpacing:0, color:'#9CA3AF' }}>(optional)</span></label>
                      <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:16 }}>
                        {['Media Buying','Creative Strategy','Supply Chain','Customer Service','Email Marketing','Analytics'].map(t => (
                          <button key={t} type="button" className={`ap-topic-pill${broadcastForm.topic===t?' selected':''}`}
                            onClick={() => setBroadcastForm({...broadcastForm, topic: broadcastForm.topic===t?'':t})}>
                            {t}
                          </button>
                        ))}
                      </div>

                      {broadcastForm.type === 'video' && (
                        <div style={{ marginBottom:14 }}>
                          <label className="ap-label">YouTube URL</label>
                          <input className="ap-input" value={broadcastForm.youtube_url} onChange={e => setBroadcastForm({...broadcastForm, youtube_url:e.target.value})} placeholder="https://youtube.com/watch?v=..." style={{ marginBottom: ytId ? 8 : 14 }} />
                          {ytId && (
                            <div style={{ borderRadius:8, overflow:'hidden', position:'relative', paddingTop:'36%', marginBottom:14 }}>
                              <img src={`https://img.youtube.com/vi/${ytId}/maxresdefault.jpg`} alt="thumb" style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover' }} />
                            </div>
                          )}
                        </div>
                      )}

                      <label className="ap-label">Title</label>
                      <input className="ap-input" style={{ fontSize:14, fontWeight:600 }} value={broadcastForm.title} onChange={e => setBroadcastForm({...broadcastForm, title:e.target.value})} required placeholder={broadcastForm.type==='tip' ? 'Your tip in one sentence…' : 'Post title…'} />

                      <label className="ap-label">{broadcastForm.type==='video' ? 'Description' : 'Content'}</label>
                      <textarea className="ap-textarea" value={broadcastForm.body} onChange={e => setBroadcastForm({...broadcastForm, body:e.target.value})} required={broadcastForm.type!=='video'} placeholder="Write your content here…" />

                      <button className="ap-btn-primary" type="submit" disabled={broadcastLoading || !canSubmit}>
                        {broadcastLoading ? 'Publishing…' : `Publish ${cfg.label}`}
                      </button>
                    </form>
                  </div>
                </div>

                {/* List */}
                <div className="ap-card">
                  <div style={{ padding:'14px 18px', borderBottom:'1px solid rgba(0,0,0,0.06)', fontSize:13, fontWeight:600, color:'#0F0F10' }}>
                    Published — {broadcasts.length}
                  </div>
                  {broadcasts.length === 0 && <div style={{ padding:'32px 18px', fontSize:13, color:'#9CA3AF' }}>No posts yet.</div>}
                  {broadcasts.map(b => {
                    const tc = TYPE_CFG[b.type] || TYPE_CFG.update
                    const bYtId = b.type==='video' ? getYtId(b.youtube_url) : null
                    const tu = broadcastReactions.filter(r => r.broadcast_id===b.id && r.emoji==='thumbs_up').length
                    const fi = broadcastReactions.filter(r => r.broadcast_id===b.id && r.emoji==='fire').length
                    return (
                      <div key={b.id} style={{ display:'flex', gap:12, alignItems:'flex-start', padding:'12px 18px', borderBottom:'1px solid rgba(0,0,0,0.05)' }}>
                        {bYtId ? (
                          <div style={{ width:60, height:38, borderRadius:6, overflow:'hidden', flexShrink:0, background:'#F0F0F0' }}>
                            <img src={`https://img.youtube.com/vi/${bYtId}/mqdefault.jpg`} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                          </div>
                        ) : (
                          <div style={{ width:30, height:30, borderRadius:7, background:tc.bg, border:`1px solid ${tc.border}`, display:'flex', alignItems:'center', justifyContent:'center', color:tc.accent, flexShrink:0, marginTop:2 }}>
                            {tc.icon}
                          </div>
                        )}
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:2 }}>
                            <span style={{ fontSize:10, fontWeight:700, color:tc.accent, textTransform:'uppercase', letterSpacing:'0.06em' }}>{tc.label}</span>
                            {b.is_pinned && <span style={{ fontSize:10, fontWeight:600, color:'#D97706', background:'rgba(217,119,6,0.08)', border:'1px solid rgba(217,119,6,0.2)', borderRadius:4, padding:'1px 5px' }}>Pinned</span>}
                            <span style={{ fontSize:10, color:'#9CA3AF' }}>{new Date(b.created_at).toLocaleDateString('en-US',{month:'short',day:'numeric'})}</span>
                          </div>
                          <div style={{ fontSize:13, fontWeight:500, color:'#0F0F10', lineHeight:1.3, marginBottom:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{b.title}</div>
                          {b.body && <div style={{ fontSize:11.5, color:'#6B7280', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{b.body}</div>}
                          {(tu>0||fi>0) && (
                            <div style={{ display:'flex', gap:8, marginTop:4 }}>
                              {tu>0 && <span style={{ fontSize:11, fontWeight:600, color:'#2563EB' }}>👍 {tu}</span>}
                              {fi>0 && <span style={{ fontSize:11, fontWeight:600, color:'#EA580C' }}>🔥 {fi}</span>}
                            </div>
                          )}
                        </div>
                        <button onClick={() => togglePin(b.id, b.is_pinned)} title={b.is_pinned?'Unpin':'Pin'}
                          style={{ background:'none', border:'none', color: b.is_pinned ? '#D97706' : '#9CA3AF', cursor:'pointer', padding:'4px', borderRadius:5, flexShrink:0 }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill={b.is_pinned?'currentColor':'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V17z"/></svg>
                        </button>
                        <button onClick={() => deleteBroadcast(b.id)}
                          style={{ background:'none', border:'none', color:'#9CA3AF', cursor:'pointer', padding:'4px', borderRadius:5, flexShrink:0 }}
                          onMouseEnter={e => e.currentTarget.style.color='#EF4444'}
                          onMouseLeave={e => e.currentTarget.style.color='#9CA3AF'}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })()}

          {/* ── NOTIFICATIONS ── */}
          {activeTab === 'notifications' && (
            <div style={{ display:'grid', gridTemplateColumns:'42% 58%', gap:16, alignItems:'start' }}>
              <div className="ap-card">
                <div className="ap-card-body">
                  <div style={{ fontSize:15, fontWeight:600, color:'#0F0F10', marginBottom:2 }}>Push notification</div>
                  <div style={{ fontSize:13, color:'#6B7280', marginBottom:20 }}>Appears in the notification icon of all clients</div>
                  {notifSuccess && <div className="ap-success">{notifSuccess}</div>}
                  <form onSubmit={handleNotification}>
                    <label className="ap-label">Type</label>
                    <div style={{ display:'flex', gap:8, marginBottom:14 }}>
                      {[['info','💬 Info'],['warning','⚠️ Warning'],['alert','🔴 Alert']].map(([t,label]) => (
                        <button key={t} type="button"
                          onClick={() => setNotifForm({...notifForm, type:t})}
                          style={{ padding:'6px 12px', borderRadius:7, border:`1px solid ${notifForm.type===t ? 'rgba(139,92,246,0.4)' : 'rgba(0,0,0,0.10)'}`, background: notifForm.type===t ? 'rgba(139,92,246,0.06)' : 'transparent', fontSize:12, fontWeight:600, cursor:'pointer', color: notifForm.type===t ? '#7C3AED' : '#6B7280', fontFamily:'inherit' }}>
                          {label}
                        </button>
                      ))}
                    </div>
                    <label className="ap-label">Title</label>
                    <input className="ap-input" value={notifForm.title} onChange={e => setNotifForm({...notifForm, title:e.target.value})} required placeholder="Notification subject" />
                    <label className="ap-label">Message</label>
                    <textarea className="ap-textarea" value={notifForm.body} onChange={e => setNotifForm({...notifForm, body:e.target.value})} required placeholder="Write your notification here…" />
                    <button className="ap-btn-primary" type="submit" disabled={notifLoading}>{notifLoading ? 'Pushing…' : 'Push notification'}</button>
                  </form>
                </div>
              </div>
              <div className="ap-card">
                <div style={{ padding:'14px 18px', borderBottom:'1px solid rgba(0,0,0,0.06)', fontSize:13, fontWeight:600, color:'#0F0F10' }}>Sent — {notifications.length}</div>
                {notifications.length === 0 && <div style={{ padding:'32px 18px', fontSize:13, color:'#9CA3AF' }}>No notifications sent yet.</div>}
                {notifications.map(n => (
                  <div key={n.id} style={{ padding:'12px 18px', borderBottom:'1px solid rgba(0,0,0,0.05)', display:'flex', gap:12, alignItems:'flex-start' }}>
                    <div style={{ flex:1 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                        <span style={{ fontSize:10, fontWeight:600, padding:'2px 8px', borderRadius:100, background: n.type==='alert'?'rgba(239,68,68,0.08)':n.type==='warning'?'rgba(245,158,11,0.08)':'rgba(59,130,246,0.08)', color: n.type==='alert'?'#DC2626':n.type==='warning'?'#D97706':'#2563EB', border:`1px solid ${n.type==='alert'?'rgba(239,68,68,0.2)':n.type==='warning'?'rgba(245,158,11,0.2)':'rgba(59,130,246,0.2)'}` }}>
                          {n.type}
                        </span>
                        <span style={{ fontSize:11, color:'#9CA3AF' }}>{new Date(n.created_at).toLocaleDateString('en-US')}</span>
                      </div>
                      <div style={{ fontSize:13, fontWeight:500, color:'#0F0F10', marginBottom:2 }}>{n.title}</div>
                      <div style={{ fontSize:12, color:'#6B7280', lineHeight:1.5 }}>{n.body}</div>
                    </div>
                    <button onClick={() => deleteNotification(n.id)} style={{ background:'none', border:'none', color:'#9CA3AF', cursor:'pointer', fontSize:14, flexShrink:0 }}
                      onMouseEnter={e => e.currentTarget.style.color='#EF4444'}
                      onMouseLeave={e => e.currentTarget.style.color='#9CA3AF'}>✕</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── INQUIRIES ── */}
          {activeTab === 'inquiries' && (() => {
            const SERVICE_COLORS = {
              'Customer Service Agent':'#7C3AED','Dispute Manager':'#059669',
              'Supply Chain Manager':'#2563EB','Senior Backend Manager':'#D97706',
              'Train Your Existing Team':'#EA580C','General Inquiry':'#7C3AED',
            }
            const unread = inquiries.filter(i => i.status==='new')
            const read   = inquiries.filter(i => i.status==='read')
            return (
              <div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, maxWidth:420, marginBottom:20 }}>
                  {[{label:'Total',value:inquiries.length,color:'#7C3AED'},{label:'New',value:unread.length,color:'#EF4444'},{label:'Read',value:read.length,color:'#059669'}].map(({label,value,color}) => (
                    <div key={label} className="ap-metric-card" style={{ padding:'16px 18px' }}>
                      <div style={{ fontSize:24, fontWeight:800, color, letterSpacing:'-0.03em', lineHeight:1, marginBottom:4 }}>{value}</div>
                      <div style={{ fontSize:10, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.07em', color:'#9CA3AF' }}>{label}</div>
                    </div>
                  ))}
                </div>
                {inquiries.length === 0 ? (
                  <div className="ap-card"><div style={{ padding:'32px 18px', fontSize:13, color:'#9CA3AF' }}>No inquiries yet.</div></div>
                ) : (
                  <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                    {inquiries.map(inq => {
                      const color = SERVICE_COLORS[inq.service] || '#7C3AED'
                      const isNew = inq.status === 'new'
                      return (
                        <div key={inq.id} style={{ background:'#FFFFFF', border:`1px solid ${isNew?'rgba(239,68,68,0.15)':'rgba(0,0,0,0.07)'}`, borderRadius:10, padding:'16px 18px', display:'flex', gap:14, alignItems:'flex-start' }}>
                          <div style={{ width:8, height:8, borderRadius:'50%', background:color, flexShrink:0, marginTop:5 }} />
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', marginBottom:6 }}>
                              <span style={{ fontSize:11, fontWeight:700, color, background:`${color}14`, border:`1px solid ${color}2e`, borderRadius:100, padding:'2px 9px', textTransform:'uppercase', letterSpacing:'0.05em' }}>{inq.service}</span>
                              {isNew && <span style={{ fontSize:10, fontWeight:700, color:'#DC2626', background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.2)', borderRadius:100, padding:'2px 8px', textTransform:'uppercase', letterSpacing:'0.05em' }}>New</span>}
                              <span style={{ fontSize:11, color:'#9CA3AF', marginLeft:'auto' }}>{new Date(inq.created_at).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</span>
                            </div>
                            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:4, flexWrap:'wrap' }}>
                              <span style={{ fontSize:13, fontWeight:500, color:'#0F0F10' }}>{inq.client_email||'—'}</span>
                              {inq.phone_number && (
                                <a href={`https://wa.me/${inq.phone_number.replace(/\D/g,'')}`} target="_blank" rel="noopener noreferrer"
                                  style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'3px 10px', borderRadius:100, background:'rgba(37,211,102,0.08)', border:'1px solid rgba(37,211,102,0.2)', color:'#16A34A', fontSize:11.5, fontWeight:600, textDecoration:'none' }}>
                                  {inq.phone_number}
                                </a>
                              )}
                            </div>
                            {inq.message
                              ? <p style={{ fontSize:13, color:'#6B7280', lineHeight:1.6, whiteSpace:'pre-wrap', wordBreak:'break-word' }}>{inq.message}</p>
                              : <p style={{ fontSize:12.5, color:'#9CA3AF', fontStyle:'italic' }}>No specific question</p>}
                          </div>
                          {isNew && (
                            <button onClick={() => markInquiryRead(inq.id)}
                              style={{ flexShrink:0, padding:'6px 12px', borderRadius:7, border:'1px solid rgba(16,185,129,0.25)', background:'rgba(16,185,129,0.06)', color:'#059669', fontSize:11.5, fontWeight:600, cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap' }}>
                              Mark read
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })()}

          {/* ── TEAM ── */}
          {activeTab === 'team' && (
            <div style={{ display:'grid', gridTemplateColumns:'42% 58%', gap:16, alignItems:'start' }}>
              <div className="ap-card">
                <div className="ap-card-body">
                  <div style={{ fontSize:15, fontWeight:600, color:'#0F0F10', marginBottom:2 }}>Add team member</div>
                  <div style={{ fontSize:13, color:'#6B7280', marginBottom:20 }}>Account created instantly — no email confirmation required</div>
                  {teamSuccess && <div className="ap-success">{teamSuccess}</div>}
                  {teamError && <div className="ap-error">{teamError}</div>}
                  <form onSubmit={handleCreateTeamMember}>
                    <label className="ap-label">Name</label>
                    <input className="ap-input" value={teamForm.name} onChange={e => setTeamForm({...teamForm, name:e.target.value})} required placeholder="Jan de Vries" />
                    <label className="ap-label">Email</label>
                    <input className="ap-input" type="email" value={teamForm.email} onChange={e => setTeamForm({...teamForm, email:e.target.value})} required placeholder="jan@lynqagency.com" />
                    <label className="ap-label">Password</label>
                    <input className="ap-input" type="password" value={teamForm.password} onChange={e => setTeamForm({...teamForm, password:e.target.value})} required placeholder="Min. 6 characters" />
                    <label className="ap-label">Role</label>
                    <div style={{ display:'flex', gap:8, marginBottom:20 }}>
                      {['developer','manager'].map(r => (
                        <button key={r} type="button"
                          onClick={() => setTeamForm({...teamForm, role:r})}
                          style={{ padding:'7px 16px', borderRadius:7, border:`1px solid ${teamForm.role===r?'rgba(139,92,246,0.4)':'rgba(0,0,0,0.10)'}`, background: teamForm.role===r?'rgba(139,92,246,0.06)':'transparent', fontSize:12.5, fontWeight:600, cursor:'pointer', color: teamForm.role===r?'#7C3AED':'#6B7280', fontFamily:'inherit' }}>
                          {r.charAt(0).toUpperCase()+r.slice(1)}
                        </button>
                      ))}
                    </div>
                    <button className="ap-btn-primary" type="submit" disabled={teamLoading}>{teamLoading?'Creating…':'Create account'}</button>
                  </form>
                </div>
              </div>
              <div className="ap-card">
                <div style={{ padding:'14px 18px', borderBottom:'1px solid rgba(0,0,0,0.06)', fontSize:13, fontWeight:600, color:'#0F0F10' }}>Team — {teamMembers.length}</div>
                {teamMembers.length === 0 && <div style={{ padding:'32px 18px', fontSize:13, color:'#9CA3AF' }}>No team members yet.</div>}
                {teamMembers.map(m => (
                  <div key={m.id} className="ap-client-row">
                    <div style={{ width:32, height:32, borderRadius:'50%', background:'#F0F0F0', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:600, color:'#555', flexShrink:0 }}>
                      {(m.name||'?')[0].toUpperCase()}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:13, fontWeight:500, color:'#0F0F10' }}>{m.name}</div>
                      <div style={{ fontSize:12, color:'#6B7280' }}>{m.email}</div>
                      <div style={{ fontSize:11, color:'#9CA3AF', marginTop:1 }}>{new Date(m.created_at).toLocaleDateString('en-US')}</div>
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <span style={{ fontSize:11, fontWeight:600, padding:'3px 9px', borderRadius:100, background:'rgba(139,92,246,0.08)', color:'#7C3AED', border:'1px solid rgba(139,92,246,0.15)' }}>{m.role}</span>
                      <button onClick={() => deleteTeamMember(m.id, m.email)} style={{ background:'none', border:'none', color:'#9CA3AF', cursor:'pointer', fontSize:14 }}
                        onMouseEnter={e => e.currentTarget.style.color='#EF4444'}
                        onMouseLeave={e => e.currentTarget.style.color='#9CA3AF'}>✕</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── TIME TRACKING ── */}
          {activeTab === 'time' && (() => {
            const fmtSec = (sec) => { if (!sec||sec<=0) return '—'; const h=Math.floor(sec/3600),m=Math.round((sec%3600)/60); return h===0?`${m}m`:m>0?`${h}h ${m}m`:`${h}h` }
            const fmtT = (iso) => iso?new Date(iso).toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit',hour12:false}):'—'
            const fmtD = (iso) => iso?new Date(iso).toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'}):'—'
            const workedSec = (s) => { if (!s.clocked_out_at) return s.active_seconds||0; const total=Math.round((new Date(s.clocked_out_at)-new Date(s.clocked_in_at))/1000); return Math.max(0,total-(s.paused_seconds||0)) }
            const sessions = timeData?.sessions||[]
            const members  = timeData?.members||[]
            const activeCount = timeData?.active_count??0
            const pausedCount = timeData?.paused_count??0
            const totalSec = sessions.reduce((sum,s)=>sum+workedSec(s),0)
            const exportCSV = () => {
              const rows=[['Name','Date','Clock In','Clock Out','Worked (h)','Break (h)','Report']]
              sessions.forEach(s=>{
                const wSec=workedSec(s),worked=s.clocked_out_at?(wSec/3600).toFixed(2):'',brk=s.paused_seconds>0?(s.paused_seconds/3600).toFixed(2):'0'
                rows.push([s.member_name||'',fmtD(s.clocked_in_at),fmtT(s.clocked_in_at),fmtT(s.clocked_out_at),worked,brk,(s.eod_report||'').replace(/"/g,'""')])
              })
              const csv=rows.map(r=>r.map(c=>`"${c}"`).join(',')).join('\n')
              const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download=`time-tracking-${timeFilter}-${new Date().toISOString().slice(0,10)}.csv`;a.click()
            }
            return (
              <div>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20, gap:12 }}>
                  <div style={{ display:'flex', gap:6 }}>
                    {[['today','Today'],['week','This week'],['month','This month']].map(([id,label])=>(
                      <button key={id} className={`ap-filter-btn${timeFilter===id?' active':''}`} onClick={()=>{setTimeFilter(id);fetchTimeData(id)}}>{label}</button>
                    ))}
                  </div>
                  <button onClick={exportCSV} style={{ padding:'7px 16px', borderRadius:8, border:'1px solid rgba(0,0,0,0.10)', background:'#FFFFFF', color:'#0F0F10', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
                    Export CSV
                  </button>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:20 }}>
                  {[
                    {label:'Active now',value:activeCount,color:'#059669',sub:pausedCount>0?`${pausedCount} on break`:null},
                    {label:'Total worked',value:fmtSec(totalSec),color:'#7C3AED',sub:null},
                    {label:'Sessions',value:sessions.filter(s=>s.clocked_out_at).length,color:'#2563EB',sub:null},
                    {label:'Team members',value:members.length,color:'#D97706',sub:null},
                  ].map(({label,value,color,sub})=>(
                    <div key={label} className="ap-metric-card">
                      <div style={{ fontSize:24, fontWeight:800, color, letterSpacing:'-0.03em', lineHeight:1, marginBottom:4 }}>{value}</div>
                      <div style={{ fontSize:10, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.07em', color:'#9CA3AF' }}>{label}</div>
                      {sub && <div style={{ fontSize:11, color:'#D97706', marginTop:3, fontWeight:600 }}>{sub}</div>}
                    </div>
                  ))}
                </div>
                {timeLoading ? (
                  <div style={{ padding:'32px', textAlign:'center', fontSize:13, color:'#9CA3AF' }}>Loading…</div>
                ) : sessions.length===0 ? (
                  <div className="ap-card"><div style={{ padding:'32px 18px', textAlign:'center', fontSize:13, color:'#9CA3AF' }}>No sessions in this period.</div></div>
                ) : (
                  <div className="ap-card">
                    {members.length>0 && (
                      <div style={{ padding:'18px 18px 0' }}>
                        <div style={{ fontSize:10, fontWeight:700, color:'#9CA3AF', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:12 }}>Per employee</div>
                        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:10, marginBottom:18 }}>
                          {members.map(m=>(
                            <div key={m.id} style={{ background:'#F9F9FB', border:`1px solid ${m.is_paused?'rgba(217,119,6,0.2)':m.is_active?'rgba(16,185,129,0.15)':'rgba(0,0,0,0.07)'}`, borderRadius:9, padding:'12px 14px' }}>
                              <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:8 }}>
                                <div style={{ width:7, height:7, borderRadius:'50%', flexShrink:0, background:m.is_paused?'#F59E0B':m.is_active?'#10B981':'#D1D5DB' }} />
                                <div style={{ fontSize:12.5, fontWeight:600, color:'#0F0F10' }}>{m.name}</div>
                                {m.is_paused&&<span style={{ marginLeft:'auto', fontSize:10, fontWeight:600, color:'#D97706', background:'rgba(217,119,6,0.08)', border:'1px solid rgba(217,119,6,0.2)', borderRadius:4, padding:'1px 6px' }}>Break</span>}
                                {m.is_active&&!m.is_paused&&<span style={{ marginLeft:'auto', fontSize:10, fontWeight:600, color:'#059669', background:'rgba(16,185,129,0.08)', border:'1px solid rgba(16,185,129,0.2)', borderRadius:4, padding:'1px 6px' }}>Active</span>}
                              </div>
                              <div style={{ fontSize:22, fontWeight:800, color:'#7C3AED', letterSpacing:'-0.03em', marginBottom:4 }}>{fmtSec(m.worked_seconds)}</div>
                              <div style={{ display:'flex', gap:10, fontSize:11, color:'#9CA3AF' }}>
                                <span>{m.sessions_count} session{m.sessions_count!==1?'s':''}</span>
                                {m.paused_seconds>0&&<span style={{ color:'#D97706' }}>Break {fmtSec(m.paused_seconds)}</span>}
                              </div>
                            </div>
                          ))}
                        </div>
                        <div style={{ borderTop:'1px solid rgba(0,0,0,0.06)', marginBottom:4 }} />
                      </div>
                    )}
                    <div style={{ padding:'0 18px' }}>
                      <div style={{ display:'grid', gridTemplateColumns:'140px 110px 65px 65px 70px 60px 1fr', gap:10, padding:'10px 0', borderBottom:'1px solid rgba(0,0,0,0.06)' }}>
                        {['Employee','Date','In','Out','Worked','Break','Report'].map(h=>(
                          <div key={h} style={{ fontSize:10, fontWeight:700, color:'#9CA3AF', textTransform:'uppercase', letterSpacing:'0.06em' }}>{h}</div>
                        ))}
                      </div>
                      {sessions.map(s2=>{
                        const wSec=workedSec(s2),hrs=wSec>0?(wSec/3600).toFixed(2):(s2.clocked_out_at?'0.00':'—'),brk=s2.paused_seconds>0?fmtSec(s2.paused_seconds):'—'
                        return (
                          <div key={s2.id} style={{ display:'grid', gridTemplateColumns:'140px 110px 65px 65px 70px 60px 1fr', gap:10, alignItems:'start', padding:'10px 0', borderBottom:'1px solid rgba(0,0,0,0.04)' }}>
                            <div>
                              <div style={{ fontSize:12.5, fontWeight:500, color:'#0F0F10' }}>{s2.member_name}</div>
                              <div style={{ fontSize:11, color:'#9CA3AF', marginTop:1 }}>{s2.member_email}</div>
                            </div>
                            <div style={{ fontSize:12.5, color:'#6B7280' }}>{fmtD(s2.clocked_in_at)}</div>
                            <div style={{ fontSize:12.5, color:'#6B7280', fontVariantNumeric:'tabular-nums' }}>{fmtT(s2.clocked_in_at)}</div>
                            <div style={{ fontSize:12.5, color:s2.clocked_out_at?'#6B7280':'#059669', fontVariantNumeric:'tabular-nums' }}>{s2.clocked_out_at?fmtT(s2.clocked_out_at):'Active'}</div>
                            <div style={{ fontSize:12.5, fontWeight:600, color:'#0F0F10' }}>{hrs}h</div>
                            <div style={{ fontSize:12.5, color:s2.paused_seconds>0?'#D97706':'#9CA3AF' }}>{brk}</div>
                            <div style={{ fontSize:12, color:'#6B7280', lineHeight:1.45, wordBreak:'break-word' }}>
                              {s2.eod_report||<span style={{ color:'#9CA3AF', fontStyle:'italic' }}>No report</span>}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )
          })()}

          {/* ── FINANCE ── */}
          {activeTab === 'finance' && (
            <div>
              {financeLoading && <div style={{ padding:'32px', textAlign:'center', fontSize:13, color:'#9CA3AF' }}>Loading…</div>}
              {!financeLoading && !finance && (
                <div style={{ textAlign:'center', padding:'32px' }}>
                  <button className="ap-btn-primary" style={{ width:'auto', padding:'10px 24px' }} onClick={fetchFinance}>Load finance data</button>
                </div>
              )}
              {finance && (() => {
                const f=finance.finance, ai=finance.ai
                const fmt=(n)=>n==null?'—':`$${n.toFixed(4)}`
                const fmtE=(n)=>n==null?'—':`€${n.toFixed(0)}`
                const fmtN=(n)=>(n||0).toLocaleString()
                return (
                  <div>
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:20 }}>
                      {[
                        {label:'MRR',value:fmtE(f.mrr),color:'#059669',sub:`${f.activeClients} active clients`},
                        {label:'Costs this month',value:fmtE(f.totalCostMonth),color:'#D97706',sub:`Fixed €${f.fixedCosts} + AI $${f.aiCostMonth.toFixed(4)}`},
                        {label:'Net margin',value:fmtE(f.netMargin),color:f.netMargin>=0?'#059669':'#EF4444',sub:`${f.marginPct}% of MRR`},
                        {label:'AI costs today',value:fmt(ai.today.cost),color:'#7C3AED',sub:`${ai.today.calls} calls`},
                      ].map(({label,value,color,sub})=>(
                        <div key={label} className="ap-metric-card">
                          <div style={{ fontSize:24, fontWeight:800, color, letterSpacing:'-0.03em', lineHeight:1, marginBottom:4 }}>{value}</div>
                          <div style={{ fontSize:10, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.07em', color:'#9CA3AF', marginBottom:2 }}>{label}</div>
                          <div style={{ fontSize:11, color:'#9CA3AF' }}>{sub}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:16 }}>
                      <div className="ap-card">
                        <div className="ap-card-body">
                          <div style={{ fontSize:15, fontWeight:600, color:'#0F0F10', marginBottom:2 }}>AI Credits usage</div>
                          <div style={{ fontSize:13, color:'#6B7280', marginBottom:16 }}>Claude Haiku 4.5</div>
                          {[{label:'Today',cost:ai.today.cost,calls:ai.today.calls},{label:'Last 7 days',cost:ai.week.cost,calls:ai.week.calls,tokens:ai.week.input_tokens+ai.week.output_tokens},{label:'This month',cost:ai.month.cost,calls:ai.month.calls,tokens:ai.month.input_tokens+ai.month.output_tokens},{label:'Last month',cost:ai.lastMonth.cost}].map(({label,cost,calls,tokens})=>(
                            <div key={label} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 0', borderBottom:'1px solid rgba(0,0,0,0.05)' }}>
                              <div>
                                <div style={{ fontSize:13, fontWeight:500, color:'#0F0F10' }}>{label}</div>
                                {tokens!=null&&<div style={{ fontSize:11, color:'#9CA3AF', marginTop:1 }}>{fmtN(tokens)} tokens · {calls} calls</div>}
                                {tokens==null&&calls!=null&&<div style={{ fontSize:11, color:'#9CA3AF', marginTop:1 }}>{calls} calls</div>}
                              </div>
                              <div style={{ fontWeight:700, color:'#7C3AED', fontSize:14 }}>{fmt(cost)}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="ap-card">
                        <div className="ap-card-body">
                          <div style={{ fontSize:15, fontWeight:600, color:'#0F0F10', marginBottom:2 }}>Usage by route</div>
                          <div style={{ fontSize:13, color:'#6B7280', marginBottom:16 }}>This month</div>
                          {Object.entries(ai.byRoute).length===0 && <div style={{ fontSize:13, color:'#9CA3AF' }}>No AI calls logged.</div>}
                          {Object.entries(ai.byRoute).sort(([,a],[,b])=>b.cost-a.cost).map(([route,v])=>(
                            <div key={route} style={{ padding:'10px 0', borderBottom:'1px solid rgba(0,0,0,0.05)' }}>
                              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                                <span style={{ fontSize:13, fontWeight:500, color:'#0F0F10', textTransform:'capitalize' }}>{route}</span>
                                <span style={{ fontWeight:700, color:'#7C3AED', fontSize:13 }}>{fmt(v.cost)}</span>
                              </div>
                              <div style={{ fontSize:11, color:'#9CA3AF', marginBottom:6 }}>{fmtN(v.calls)} calls · {fmtN(v.input_tokens)} in · {fmtN(v.output_tokens)} out</div>
                              <div style={{ height:3, background:'#F0F0F0', borderRadius:2 }}>
                                <div style={{ height:3, background:'#7C3AED', borderRadius:2, width:`${Math.min(100,(v.calls/Math.max(...Object.values(ai.byRoute).map(r=>r.calls)))*100)}%`, opacity:.6 }} />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
                      <div className="ap-card">
                        <div className="ap-card-body">
                          <div style={{ fontSize:15, fontWeight:600, color:'#0F0F10', marginBottom:2 }}>Fixed subscriptions</div>
                          <div style={{ fontSize:13, color:'#6B7280', marginBottom:16 }}>Monthly fixed costs</div>
                          {finance.subscriptions.map(sub=>(
                            <div key={sub.name} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 0', borderBottom:'1px solid rgba(0,0,0,0.05)' }}>
                              <div>
                                <div style={{ fontSize:13, fontWeight:500, color:'#0F0F10' }}>{sub.name}</div>
                                {sub.note && <div style={{ fontSize:11, color:'#9CA3AF', marginTop:1 }}>{sub.note}</div>}
                              </div>
                              <div style={{ fontWeight:700, color:sub.cost>0?'#D97706':'#9CA3AF', fontSize:13 }}>{sub.cost>0?`$${sub.cost}/mo`:'—'}</div>
                            </div>
                          ))}
                          <div style={{ display:'flex', justifyContent:'space-between', padding:'12px 0 0' }}>
                            <span style={{ fontSize:13, fontWeight:600, color:'#0F0F10' }}>Total</span>
                            <span style={{ fontWeight:800, color:'#D97706', fontSize:14 }}>${f.fixedCosts}/mo</span>
                          </div>
                        </div>
                      </div>
                      <div className="ap-card">
                        <div className="ap-card-body">
                          <div style={{ fontSize:15, fontWeight:600, color:'#0F0F10', marginBottom:2 }}>AI costs per day</div>
                          <div style={{ fontSize:13, color:'#6B7280', marginBottom:16 }}>This month</div>
                          {ai.daily.length===0 && <div style={{ fontSize:13, color:'#9CA3AF' }}>No data yet.</div>}
                          <div style={{ maxHeight:260, overflowY:'auto' }}>
                            {[...ai.daily].reverse().map(({date,cost,calls})=>{
                              const maxCost=Math.max(...ai.daily.map(d=>d.cost),0.0001),pct=Math.min(100,(cost/maxCost)*100)
                              return (
                                <div key={date} style={{ padding:'7px 0', borderBottom:'1px solid rgba(0,0,0,0.04)' }}>
                                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                                    <span style={{ fontSize:12, color:'#9CA3AF' }}>{new Date(date).toLocaleDateString('en-US',{day:'numeric',month:'short'})}</span>
                                    <span style={{ fontSize:12, fontWeight:600, color:'#7C3AED' }}>{fmt(cost)} <span style={{ color:'#9CA3AF', fontWeight:400 }}>· {calls}x</span></span>
                                  </div>
                                  <div style={{ height:3, background:'#F0F0F0', borderRadius:2 }}>
                                    <div style={{ height:3, background:'#7C3AED', borderRadius:2, width:`${pct}%`, opacity:.6 }} />
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                          <button className="ap-btn-primary" style={{ marginTop:16 }} onClick={fetchFinance}>Refresh</button>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })()}
            </div>
          )}

          {/* ── EVENTS ── */}
          {activeTab === 'events' && (() => {
            const fmtDT=(iso)=>new Date(iso).toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})
            const isPast=(iso)=>new Date(iso)<new Date()
            return (
              <div style={{ display:'grid', gridTemplateColumns:'42% 58%', gap:16, alignItems:'start' }}>
                <div className="ap-card">
                  <div className="ap-card-body">
                    <div style={{ fontSize:15, fontWeight:600, color:'#0F0F10', marginBottom:2 }}>Schedule masterclass</div>
                    <div style={{ fontSize:13, color:'#6B7280', marginBottom:20 }}>Appears in the Value Feed of all clients</div>
                    {mcSuccess && <div className="ap-success">{mcSuccess}</div>}
                    {mcError && <div className="ap-error">{mcError}</div>}
                    <form onSubmit={handleCreateMasterclass}>
                      <label className="ap-label">Title</label>
                      <input className="ap-input" value={mcForm.title} onChange={e=>setMcForm({...mcForm,title:e.target.value})} required placeholder="How to scale Meta Ads…" />
                      <label className="ap-label">Speaker <span style={{ fontWeight:400, textTransform:'none', letterSpacing:0, color:'#9CA3AF' }}>(optional)</span></label>
                      <input className="ap-input" value={mcForm.speaker} onChange={e=>setMcForm({...mcForm,speaker:e.target.value})} placeholder="Name · Role or company" />
                      <label className="ap-label">Description <span style={{ fontWeight:400, textTransform:'none', letterSpacing:0, color:'#9CA3AF' }}>(optional)</span></label>
                      <textarea className="ap-textarea" style={{ minHeight:80 }} value={mcForm.description} onChange={e=>setMcForm({...mcForm,description:e.target.value})} placeholder="What will attendees learn?" />
                      <label className="ap-label">Date &amp; time</label>
                      <input className="ap-input" type="datetime-local" value={mcForm.scheduled_at} onChange={e=>setMcForm({...mcForm,scheduled_at:e.target.value})} required />
                      <label className="ap-label">Zoom link <span style={{ fontWeight:400, textTransform:'none', letterSpacing:0, color:'#9CA3AF' }}>(add before session)</span></label>
                      <input className="ap-input" value={mcForm.zoom_url} onChange={e=>setMcForm({...mcForm,zoom_url:e.target.value})} placeholder="https://zoom.us/j/…" />
                      <button className="ap-btn-primary" type="submit" disabled={mcLoading}>{mcLoading?'Scheduling…':'Schedule masterclass'}</button>
                    </form>
                  </div>
                </div>
                <div className="ap-card">
                  <div style={{ padding:'14px 18px', borderBottom:'1px solid rgba(0,0,0,0.06)', fontSize:13, fontWeight:600, color:'#0F0F10' }}>Masterclasses — {masterclasses.length}</div>
                  {masterclasses.length===0 && <div style={{ padding:'32px 18px', fontSize:13, color:'#9CA3AF' }}>No masterclasses scheduled yet.</div>}
                  {masterclasses.map(mc=>{
                    const past=isPast(mc.scheduled_at)
                    return (
                      <div key={mc.id} style={{ padding:'14px 18px', borderBottom:'1px solid rgba(0,0,0,0.05)', display:'flex', gap:14, alignItems:'flex-start' }}>
                        <div style={{ flexShrink:0, width:40, textAlign:'center', background:past?'#F5F5F5':'rgba(139,92,246,0.08)', border:`1px solid ${past?'rgba(0,0,0,0.07)':'rgba(139,92,246,0.2)'}`, borderRadius:9, padding:'7px 4px' }}>
                          <div style={{ fontSize:18, fontWeight:800, color:past?'#9CA3AF':'#7C3AED', lineHeight:1 }}>{new Date(mc.scheduled_at).getDate()}</div>
                          <div style={{ fontSize:9, fontWeight:700, color:past?'#9CA3AF':'rgba(124,58,237,0.7)', textTransform:'uppercase', letterSpacing:'.05em', marginTop:2 }}>{new Date(mc.scheduled_at).toLocaleDateString('en-US',{month:'short'})}</div>
                        </div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:3 }}>
                            <span style={{ fontSize:11, fontWeight:600, color:past?'#9CA3AF':'#7C3AED', textTransform:'uppercase', letterSpacing:'.05em' }}>{past?'Past':'Upcoming'}</span>
                            <span style={{ fontSize:11, color:'#9CA3AF' }}>{fmtDT(mc.scheduled_at)}</span>
                          </div>
                          <div style={{ fontSize:13.5, fontWeight:600, color:past?'#9CA3AF':'#0F0F10', lineHeight:1.3, marginBottom:2 }}>{mc.title}</div>
                          {mc.speaker && <div style={{ fontSize:11.5, color:'#6B7280' }}>with {mc.speaker}</div>}
                          {editingZoom?.id===mc.id ? (
                            <div style={{ marginTop:6, display:'flex', gap:6, alignItems:'center' }}>
                              <input value={editingZoom.url} onChange={e=>setEditingZoom({...editingZoom,url:e.target.value})} placeholder="https://zoom.us/j/…"
                                onKeyDown={e=>{if(e.key==='Enter')updateZoomUrl(mc.id,editingZoom.url);if(e.key==='Escape')setEditingZoom(null)}}
                                autoFocus style={{ flex:1, padding:'5px 9px', border:'1px solid rgba(139,92,246,0.3)', borderRadius:6, fontSize:11.5, fontFamily:'inherit', outline:'none', background:'#fff', color:'#0F0F10' }} />
                              <button onClick={()=>updateZoomUrl(mc.id,editingZoom.url)} style={{ padding:'5px 10px', background:'#7C3AED', border:'none', borderRadius:6, color:'#fff', fontSize:11, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>Save</button>
                              <button onClick={()=>setEditingZoom(null)} style={{ padding:'5px 10px', background:'#F5F5F5', border:'1px solid rgba(0,0,0,0.10)', borderRadius:6, color:'#6B7280', fontSize:11, cursor:'pointer', fontFamily:'inherit' }}>✕</button>
                            </div>
                          ) : (
                            <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:4 }}>
                              {mc.zoom_url
                                ? <span style={{ fontSize:11, color:'#059669' }}>✓ Zoom link set</span>
                                : <span style={{ fontSize:11, color:'#9CA3AF' }}>No Zoom link yet</span>}
                              <button onClick={()=>setEditingZoom({id:mc.id,url:mc.zoom_url||''})} style={{ background:'none', border:'none', color:'#9CA3AF', cursor:'pointer', fontSize:10, padding:'2px 4px', borderRadius:4 }}
                                onMouseEnter={e=>e.currentTarget.style.color='#7C3AED'}
                                onMouseLeave={e=>e.currentTarget.style.color='#9CA3AF'}>Edit</button>
                            </div>
                          )}
                        </div>
                        <button onClick={()=>deleteMasterclass(mc.id)} style={{ background:'none', border:'none', color:'#9CA3AF', cursor:'pointer', padding:'4px', borderRadius:5, flexShrink:0 }}
                          onMouseEnter={e=>e.currentTarget.style.color='#EF4444'}
                          onMouseLeave={e=>e.currentTarget.style.color='#9CA3AF'}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })()}

        </div>
      </div>
    </div>
  )
}
