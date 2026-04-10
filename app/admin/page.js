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
      setNotifSuccess('Notificatie gepushed!')
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
      setBroadcastSuccess('Bericht gepushed naar alle klanten!')
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

    setSuccess(`Client ${form.company_name} aangemaakt!`)
    setForm({ company_name: '', email: '', password: '', gorgias_domain: '', gorgias_api_key: '', shopify_domain: '', shopify_api_key: '', parcel_panel_api_key: '' })
    fetchClients()
    setLoading(false)
  }

  const s = {
    page: { minHeight: '100vh', background: '#1C0F36', fontFamily: 'sans-serif', padding: '40px', color: '#fff' },
    title: { fontSize: '24px', fontWeight: '800', marginBottom: '8px' },
    sub: { color: '#8b7cb3', fontSize: '14px', marginBottom: '40px' },
    grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px', maxWidth: '1100px' },
    card: { background: '#241352', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '28px' },
    cardTitle: { fontSize: '16px', fontWeight: '700', marginBottom: '20px' },
    label: { display: 'block', fontSize: '12px', color: '#8b7cb3', marginBottom: '5px' },
    input: { width: '100%', padding: '10px 14px', background: '#1C0F36', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff', fontSize: '13px', boxSizing: 'border-box', marginBottom: '14px', fontFamily: 'sans-serif' },
    btn: { width: '100%', padding: '12px', background: '#A175FC', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', marginTop: '6px' },
    success: { background: 'rgba(78,204,163,0.15)', border: '1px solid #4ecca3', borderRadius: '8px', padding: '10px 14px', color: '#4ecca3', fontSize: '13px', marginBottom: '16px' },
    clientRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' },
    pill: { padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '600', background: 'rgba(78,204,163,0.15)', color: '#4ecca3' },
    tab: { padding: '8px 20px', borderRadius: '8px', border: 'none', fontSize: '13px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.15s' },
    tabActive: { background: '#A175FC', color: '#fff' },
    tabInactive: { background: 'rgba(255,255,255,0.05)', color: '#8b7cb3' },
    textarea: { width: '100%', padding: '10px 14px', background: '#1C0F36', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff', fontSize: '13px', boxSizing: 'border-box', marginBottom: '14px', fontFamily: 'sans-serif', resize: 'vertical', minHeight: '100px' },
    typePill: (t, selected) => ({ padding: '6px 14px', borderRadius: '20px', border: 'none', fontSize: '12px', fontWeight: '600', cursor: 'pointer', background: selected === t ? '#A175FC' : 'rgba(255,255,255,0.06)', color: selected === t ? '#fff' : '#8b7cb3' }),
    broadcastRow: { padding: '14px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' },
  }

  if (!authorized) return (
    <div style={{ minHeight: '100vh', background: '#1C0F36', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8b7cb3', fontFamily: 'sans-serif' }}>
      Checking access...
    </div>
  )

  return (
    <div style={s.page}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <div style={s.title}>Admin — Lynq & Flow</div>
        <button onClick={async () => { await supabase.auth.signOut(); window.location.href = '/login' }} style={{ padding: '8px 16px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#8b7cb3', fontSize: '13px', cursor: 'pointer' }}>
          Log out
        </button>
      </div>
      <div style={s.sub}>Beheer klanten en hun koppelingen</div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '32px' }}>
        <button style={{ ...s.tab, ...(activeTab === 'clients' ? s.tabActive : s.tabInactive) }} onClick={() => setActiveTab('clients')}>Klanten</button>
        <button style={{ ...s.tab, ...(activeTab === 'broadcasts' ? s.tabActive : s.tabInactive) }} onClick={() => setActiveTab('broadcasts')}>Broadcasts</button>
        <button style={{ ...s.tab, ...(activeTab === 'notifications' ? s.tabActive : s.tabInactive) }} onClick={() => setActiveTab('notifications')}>Notifications</button>
      </div>

      {activeTab === 'broadcasts' && (
        <div style={s.grid}>
          {/* Broadcast schrijven */}
          <div style={s.card}>
            <div style={s.cardTitle}>Nieuw bericht pushen</div>
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
              <label style={s.label}>Titel</label>
              <input style={s.input} value={broadcastForm.title} onChange={e => setBroadcastForm({...broadcastForm, title: e.target.value})} required placeholder="Onderwerp van het bericht" />
              <label style={s.label}>Bericht</label>
              <textarea style={s.textarea} value={broadcastForm.body} onChange={e => setBroadcastForm({...broadcastForm, body: e.target.value})} required placeholder="Schrijf hier je bericht..." />
              <button style={s.btn} type="submit" disabled={broadcastLoading}>
                {broadcastLoading ? 'Pushen...' : '📤 Push naar alle klanten'}
              </button>
            </form>
          </div>

          {/* Broadcast geschiedenis */}
          <div style={s.card}>
            <div style={s.cardTitle}>Verstuurd — {broadcasts.length}</div>
            {broadcasts.length === 0 && <div style={{ color: '#8b7cb3', fontSize: '13px' }}>Nog geen berichten verstuurd.</div>}
            {broadcasts.map(b => (
              <div key={b.id} style={s.broadcastRow}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ ...s.pill, background: b.type === 'tip' ? 'rgba(161,117,252,0.15)' : b.type === 'video' ? 'rgba(255,209,102,0.15)' : 'rgba(78,204,163,0.15)', color: b.type === 'tip' ? '#A175FC' : b.type === 'video' ? '#ffd166' : '#4ecca3' }}>
                        {b.type === 'update' ? '📢 Update' : b.type === 'tip' ? '💡 Tip' : '🎥 Video'}
                      </span>
                      <span style={{ fontSize: '11px', color: '#8b7cb3' }}>{new Date(b.created_at).toLocaleDateString('nl-NL')}</span>
                    </div>
                    <div style={{ fontWeight: '600', fontSize: '14px', marginBottom: '4px' }}>{b.title}</div>
                    <div style={{ fontSize: '12px', color: '#8b7cb3', lineHeight: '1.5' }}>{b.body}</div>
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
            <div style={s.cardTitle}>Nieuwe notificatie pushen</div>
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
              <label style={s.label}>Titel</label>
              <input style={s.input} value={notifForm.title} onChange={e => setNotifForm({...notifForm, title: e.target.value})} required placeholder="Onderwerp van de notificatie" />
              <label style={s.label}>Bericht</label>
              <textarea style={s.textarea} value={notifForm.body} onChange={e => setNotifForm({...notifForm, body: e.target.value})} required placeholder="Schrijf hier de notificatie..." />
              <button style={s.btn} type="submit" disabled={notifLoading}>
                {notifLoading ? 'Pushen...' : '🔔 Push notificatie'}
              </button>
            </form>
          </div>

          {/* Notificaties geschiedenis */}
          <div style={s.card}>
            <div style={s.cardTitle}>Verstuurd — {notifications.length}</div>
            {notifications.length === 0 && <div style={{ color: '#8b7cb3', fontSize: '13px' }}>Nog geen notificaties verstuurd.</div>}
            {notifications.map(n => (
              <div key={n.id} style={s.broadcastRow}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ ...s.pill, background: n.type === 'alert' ? 'rgba(255,107,138,0.15)' : n.type === 'warning' ? 'rgba(255,209,102,0.15)' : 'rgba(78,204,163,0.15)', color: n.type === 'alert' ? '#ff6b8a' : n.type === 'warning' ? '#ffd166' : '#4ecca3' }}>
                        {n.type === 'info' ? '💬 Info' : n.type === 'warning' ? '⚠️ Warning' : '🔴 Alert'}
                      </span>
                      <span style={{ fontSize: '11px', color: '#8b7cb3' }}>{new Date(n.created_at).toLocaleDateString('nl-NL')}</span>
                    </div>
                    <div style={{ fontWeight: '600', fontSize: '14px', marginBottom: '4px' }}>{n.title}</div>
                    <div style={{ fontSize: '12px', color: '#8b7cb3', lineHeight: '1.5' }}>{n.body}</div>
                  </div>
                  <button onClick={() => deleteNotification(n.id)} style={{ background: 'none', border: 'none', color: '#ff6b8a', cursor: 'pointer', fontSize: '14px', marginLeft: '12px', flexShrink: 0 }}>✕</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'clients' && <div style={s.grid}>
        {/* Nieuw klant formulier */}
        <div style={s.card}>
          <div style={s.cardTitle}>Nieuwe klant aanmaken</div>

          {success && <div style={s.success}>{success}</div>}

          <form onSubmit={handleSubmit}>
            <label style={s.label}>Bedrijfsnaam</label>
            <input style={s.input} value={form.company_name} onChange={e => setForm({...form, company_name: e.target.value})} required placeholder="Smith Sisters" />

            <label style={s.label}>Email</label>
            <input style={s.input} type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} required placeholder="client@bedrijf.com" />

            <label style={s.label}>Wachtwoord</label>
            <input style={s.input} type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} required placeholder="Min. 6 tekens" />

            <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', margin: '6px 0 16px' }} />

            <label style={s.label}>Gorgias domein</label>
            <input style={s.input} value={form.gorgias_domain} onChange={e => setForm({...form, gorgias_domain: e.target.value})} placeholder="smithsisters.gorgias.com" />

            <label style={s.label}>Gorgias API key</label>
            <input style={s.input} value={form.gorgias_api_key} onChange={e => setForm({...form, gorgias_api_key: e.target.value})} placeholder="API key" />

            <label style={s.label}>Shopify domein</label>
            <input style={s.input} value={form.shopify_domain} onChange={e => setForm({...form, shopify_domain: e.target.value})} placeholder="smithsisters.myshopify.com" />

            <label style={s.label}>Shopify API key</label>
            <input style={s.input} value={form.shopify_api_key} onChange={e => setForm({...form, shopify_api_key: e.target.value})} placeholder="API key" />

            <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', margin: '6px 0 16px' }} />

            <label style={s.label}>Parcel Panel API key</label>
            <input style={s.input} value={form.parcel_panel_api_key} onChange={e => setForm({...form, parcel_panel_api_key: e.target.value})} placeholder="Parcel Panel API key" />

            <button style={s.btn} type="submit" disabled={loading}>
              {loading ? 'Aanmaken...' : 'Klant aanmaken'}
            </button>
          </form>
        </div>

        {/* Klanten lijst */}
        <div style={s.card}>
          <div style={s.cardTitle}>Klanten — {clients.length}</div>
          {clients.length === 0 && (
            <div style={{ color: '#8b7cb3', fontSize: '13px' }}>Nog geen klanten aangemaakt.</div>
          )}
          {clients.map(client => (
            <div key={client.id} style={s.clientRow}>
              <div>
                <div style={{ fontWeight: '600', fontSize: '14px' }}>{client.company_name}</div>
                <div style={{ color: '#8b7cb3', fontSize: '12px', marginTop: '2px' }}>{client.email}</div>
                {client.gorgias_domain && <div style={{ color: '#8b7cb3', fontSize: '11px', marginTop: '2px' }}>Gorgias: {client.gorgias_domain}</div>}
              </div>
              <span style={s.pill}>{client.status}</span>
            </div>
          ))}
        </div>
      </div>}
    </div>
  )
}
